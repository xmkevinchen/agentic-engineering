#!/bin/sh
# test-family-reachability.sh — F-082 AC8.
#
# Asserts the reachability preconditions hold for every configured family AND that they hold
# for the right reason. The number alone is gameable: hardcoding a fourth per-family block into
# check-cross-family.sh would raise the score and defeat the point, so the structural
# assertions below are the load-bearing half.
#
# Deliberately does NOT invoke ae-run-tests.sh — that runner invokes this file, and a suite
# that runs itself is a hang, not a check. The suite's own greenness is the runner's job.
#
# Run: sh plugins/ae/tests/scripts/test-family-reachability.sh

set -u
THIS="$(cd "$(dirname "$0")" && pwd)"
REPO="$(git -C "$THIS" rev-parse --show-toplevel 2>/dev/null || (cd "$THIS/../../../.." && pwd))"
SCRIPTS="$REPO/plugins/ae/scripts"
fail=0
ok()  { echo "  ok: $1"; }
bad() { echo "  FAIL: $1" >&2; fail=1; }

# 1. Every enabled entry meets every precondition.
out="$("$SCRIPTS/check-family-reachability.sh" 2>&1)"
if [ $? -eq 0 ] && printf '%s' "$out" | grep -q '0 missed'; then
  ok "reachability: $(printf '%s' "$out" | grep -o '[0-9]* precondition(s) met, 0 missed')"
else
  bad "check-family-reachability.sh did not report 0 missed:"
  printf '%s\n' "$out" | sed 's/^/       /' >&2
fi

# 2. The score must not have been bought with per-family blocks in the scripts. Generality is
#    the thing under test; a literal family or seat name in an executable line means the next
#    one costs an edit there.
#
#    BOTH scripts are checked. An earlier version of this test looked only at the probe script,
#    and the reachability script meanwhile carried `case "$seat" in openai-compat) …; *) report
#    ok` — so every seat but one was certified complete without being checked, and this test
#    called that clean. A test that inspects one of two scripts is a test that can be satisfied
#    by moving the hardcoding into the other.
for s in check-cross-family.sh check-family-reachability.sh; do
  f="$SCRIPTS/$s"
  hits="$(grep -nE '\b(codex|gemini|omlx|openai-compat|deepseek|qwen)\b' "$f" \
          | grep -v '^[0-9]*:[[:space:]]*#' | grep -v 'GEMINI_API_KEY')"
  if [ -z "$hits" ]; then
    ok "$s names no family or seat outside comments — it is table-driven"
  else
    bad "$s still names families/seats in executable lines — the next one costs an edit there:"
    printf '%s\n' "$hits" | sed 's/^/       /' >&2
  fi
done

# 2b. Each seat states what an entry must supply. Without this the completeness check has
#     nothing to check against and silently certifies anything.
for def in "$REPO"/plugins/ae/agents/workflow/*-proxy.md; do
  [ -f "$def" ] || continue
  grep -q '^requires:' "$def" \
    || bad "$(basename "$def") declares no requires: line — the reachability check would certify an empty entry for this seat"
done

# 3. Each seat declares its own probe, which is what let the script stop knowing about them.
for def in "$REPO"/plugins/ae/agents/workflow/*-proxy.md; do
  [ -f "$def" ] || continue
  grep -q '^probe:' "$def" \
    || bad "$(basename "$def") declares no probe: line — its availability reads as unknown, which is indistinguishable from available"
done
[ "$fail" -eq 0 ] && ok "every seat definition declares a probe"

# 4. No skill hardcodes a proxy in a spawn. This is the concrete half of "adding a family
#    touches no skill file" that survived the conclusion's objection to file counting.
n_hard="$(grep -rc 'subagent_type: *"ae:workflow:[a-z-]*-proxy"' "$REPO/plugins/ae/skills/" 2>/dev/null | awk -F: '{s+=$2} END{print s+0}')"
if [ "$n_hard" -eq 0 ]; then
  ok "no skill hardcodes a proxy subagent_type in a spawn"
else
  bad "$n_hard hardcoded proxy spawn(s) remain in skills/ — a family added to the table cannot reach them"
fi

if [ "$fail" -eq 0 ]; then echo "test-family-reachability.sh: PASS"; else echo "test-family-reachability.sh: FAIL" >&2; fi
exit "$fail"
