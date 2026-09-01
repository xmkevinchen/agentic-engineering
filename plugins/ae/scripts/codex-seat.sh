#!/usr/bin/env bash
# Run one Codex seat call and emit a receipt the caller can check against disk.
#
# The flags below are the ones that are silently wrong when a call is assembled by hand, which
# is why the invocation lives here and not in the agent's prose —
#   codex exec        the subcommand; plain `codex` forwards to the interactive CLI
#   < /dev/null       exec reads stdin to EOF even with a prompt argument, so an inherited
#                     open stdin hangs the call with no error, and piped stdin is appended
#                     to the prompt as a <stdin> block
#   --sandbox         `exec resume` has no such flag and defaults to workspace-write
#
# Usage: codex-seat.sh <low|medium|high> <prompt-file> [timeout-seconds]
# Prompt comes from a file so no quoting can mangle it. Default bound 300s.
# Exit 0 with a receipt on stdout, or non-zero having said why.

set -uo pipefail

EFFORT="${1:?usage: codex-seat.sh <low|medium|high> <prompt-file> [timeout-seconds]}"
PROMPT_FILE="${2:?usage: codex-seat.sh <low|medium|high> <prompt-file> [timeout-seconds]}"
BOUND="${3:-300}"

case "$EFFORT" in low|medium|high) ;; *) echo "[RECEIPT] call failed: bad effort '$EFFORT'" >&2; exit 2 ;; esac
[ -r "$PROMPT_FILE" ] || { echo "[RECEIPT] call failed: unreadable prompt file" >&2; exit 2; }
command -v codex >/dev/null 2>&1 || { echo "[RECEIPT] call failed: codex not on PATH" >&2; exit 3; }

D=$(mktemp -d) || exit 2
trap 'rm -rf "$D"' EXIT

# The bound is enforced here because neither `timeout` nor `gtimeout` is present everywhere.
codex exec -c model_reasoning_effort="$EFFORT" --sandbox read-only --json \
  -o "$D/answer.txt" < /dev/null "$(cat "$PROMPT_FILE")" > "$D/events.jsonl" 2> "$D/err" &
CODEX_PID=$!
( sleep "$BOUND"; kill -0 "$CODEX_PID" 2>/dev/null && kill -TERM "$CODEX_PID" 2>/dev/null ) & WATCHDOG=$!
wait "$CODEX_PID"; RC=$?
kill -TERM "$WATCHDOG" 2>/dev/null; wait "$WATCHDOG" 2>/dev/null

if [ "$RC" -ne 0 ]; then
  echo "[RECEIPT] call failed: exit $RC after up to ${BOUND}s"
  echo "--- stderr ---"; tail -5 "$D/err"
  exit 4
fi

THREAD=$(sed -n 's/.*"thread_id":"\([^"]*\)".*/\1/p' "$D/events.jsonl" | head -1)
[ -n "$THREAD" ] && [ -s "$D/answer.txt" ] || { echo "[RECEIPT] call failed: no thread id or empty answer"; exit 5; }

# Any error item means the turn is not certifiable — a model reroute arrives this way and
# never reaches the rollout, so refuse on the item's presence, not on matching its wording.
if grep -q '"type":"error"' "$D/events.jsonl"; then
  echo "[RECEIPT] call failed: stdout carried an error item, turn not certifiable, thread=$THREAD"
  grep -o '"message":"[^"]*"' "$D/events.jsonl" | head -3
  exit 6
fi

ROLLOUT=$(find "$HOME/.codex/sessions" -name "rollout-*-$THREAD.jsonl" 2>/dev/null | head -1)
[ -n "$ROLLOUT" ] || { echo "[RECEIPT] call failed: no rollout resolves thread=$THREAD"; exit 7; }

# turn_context is the requested model, written at turn start — never the serving one.
read -r RMODEL REFFORT RORIG < <(python3 - "$ROLLOUT" <<'PY'
import sys, json
model = effort = orig = ""
for line in open(sys.argv[1]):
    try: d = json.loads(line)
    except ValueError: continue
    p = d.get("payload", {})
    if d.get("type") == "session_meta": orig = p.get("originator", "")
    if d.get("type") == "turn_context":
        model, effort = p.get("model", ""), p.get("effort", "")
print(model or "not-exposed", effort or "not-exposed", orig or "not-exposed")
PY
)

[ "$RORIG" = "codex_exec" ] || { echo "[RECEIPT] call failed: rollout originator=$RORIG, not codex_exec"; exit 8; }
[ "$REFFORT" = "$EFFORT" ] || { echo "[RECEIPT] call failed: asked effort=$EFFORT, rollout says $REFFORT"; exit 9; }

echo "[RECEIPT] model_requested=$RMODEL effort=$REFFORT thread=$THREAD call ok"
echo "[RECEIPT] rollout=$ROLLOUT"
echo "--- backend answer ---"
cat "$D/answer.txt"
