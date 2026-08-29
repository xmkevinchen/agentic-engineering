#!/bin/sh
# test-cross-family-probe-parsing.sh — F-083 AC1/AC2, the compatibility half.
#
# Quoting the gemini seat's `probe:` scalar is what made its frontmatter parse. It also broke
# the consumer: `check-cross-family.sh` reads that line with `sed`, not with a YAML parser, so
# the value arrives with its quote bytes attached and `bash -c` runs the whole scalar as one
# command name (exit 127, reported as "this family will report unavailable"). Fixing the
# metadata would have silently disabled the probe it describes.
#
# This test drives the real SessionStart hook against runtime-built seats, because the thing
# worth proving is not that a decoder function returns a string — it is that the hook runs the
# command the author wrote, and does not run anything the author did not.
#
# Each seat's probe touches a sentinel. Sentinel present = that text was executed. That makes
# the two negative cases sharp: for a malformed scalar the assertion is not "an error was
# printed", it is "the leftover bytes never ran".
#
# Cases: quoted, legacy plain, an escaped '' quote, an unterminated quote, and material after
# the closing quote.
#
# Run: sh plugins/ae/tests/scripts/test-cross-family-probe-parsing.sh
# Exit 0 = every assertion held. Exit 1 = at least one did not.

set -u
THIS="$(cd "$(dirname "$0")" && pwd)"
REPO="$(git -C "$THIS" rev-parse --show-toplevel 2>/dev/null || (cd "$THIS/../../../.." && pwd))"
SUBJECT="$REPO/plugins/ae/scripts/check-cross-family.sh"
fail=0
ok()  { echo "  ok: $1"; }
bad() { echo "  FAIL: $1" >&2; fail=1; }

[ -f "$SUBJECT" ] || { bad "subject missing: $SUBJECT"; echo "test-cross-family-probe-parsing: FAIL" >&2; exit 1; }

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT INT TERM
AGENTS="$TMP/agents/workflow"
SENT="$TMP/sentinels"
mkdir -p "$AGENTS" "$SENT"

# The hook reads seats from $CLAUDE_PLUGIN_ROOT/agents/workflow and entries from $AE_PIPELINE,
# so a staged root exercises the real code path without touching the repository's own seats.
seat() { # $1 = seat name, $2 = the raw text to put after `probe:`
  cat > "$AGENTS/$1-proxy.md" <<EOF
---
name: $1-proxy
description: staged seat for probe parsing
tools: Read
requires:
probe: $2
---
staged
EOF
}

# `$SENT` is exported, so a probe that runs at all can record it. Nothing here needs a backend.
seat quoted   "'touch \"\$SENT/quoted\"'"
seat legacy   "touch \"\$SENT/legacy\""
seat escaped  "'[ ''x'' = \"x\" ] && touch \"\$SENT/escaped\"'"
seat unterm   "'touch \"\$SENT/unterm\""
seat trailing "'true' ; touch \"\$SENT/trailing\""

cat > "$TMP/pipeline.yml" <<'EOF'
cross_family:
  quoted:   { seat: quoted, family: fam-quoted }
  legacy:   { seat: legacy, family: fam-legacy }
  escaped:  { seat: escaped, family: fam-escaped }
  unterm:   { seat: unterm, family: fam-unterm }
  trailing: { seat: trailing, family: fam-trailing }
EOF

export SENT
CLAUDE_PLUGIN_ROOT="$TMP" AE_PIPELINE="$TMP/pipeline.yml" \
  sh "$SUBJECT" >"$TMP/out" 2>"$TMP/err"
hook_rc=$?

# The hook is never fatal — a session must start with no backend at all. If that changed, every
# assertion below would still pass while SessionStart broke for everyone.
if [ "$hook_rc" -eq 0 ]; then
  ok "the hook stays non-fatal (exit 0) whatever the probes do"
else
  bad "the hook exited $hook_rc; SessionStart must not be blocked by a probe"
fi

ran()      { [ -e "$SENT/$1" ]; }
reported() { grep -q "^\[ae\] WARNING: $1:" "$TMP/err"; }

if ran quoted; then
  ok "a YAML single-quoted probe is decoded and its command runs"
else
  bad "the single-quoted probe never ran — the quoting repair would disable the probe it describes"
fi

if ran legacy; then
  ok "the legacy plain probe form still runs unchanged"
else
  bad "the legacy plain probe form stopped working"
fi

if ran escaped; then
  ok "an escaped '' inside a single-quoted probe decodes to one literal quote"
else
  bad "the '' escape was not decoded; the probe did not run"
fi

# The two negatives. Rejection is only worth asserting alongside non-execution: a decoder that
# reported an error AND ran the leftover text would satisfy half of this and be the worse bug.
if ran unterm; then
  bad "an unterminated quote was repaired by guessing, and the guess was executed"
elif reported unterm; then
  ok "an unterminated probe scalar is rejected, and nothing from it is executed"
else
  bad "an unterminated probe scalar did not run and was not reported — it reads as available"
fi

if ran trailing; then
  bad "text after the closing quote was executed — the exact injection this decoder must refuse"
elif reported trailing; then
  ok "material after the closing quote is rejected, and none of it is executed"
else
  bad "a probe with trailing material was neither run nor reported — it reads as available"
fi

# A rejected scalar and a working one must be distinguishable in the report, or the operator
# cannot tell an unavailable family from an unreadable declaration.
if reported quoted || reported legacy || reported escaped; then
  bad "a probe that ran successfully was still reported as an issue"
else
  ok "seats whose probes ran clean are not reported"
fi

# Decoding must not re-parse the thing it is about to execute. Scoped to the probe: the hook
# also evals a `printf`-shaped line built from the pipeline entry, which is a different subject
# and predates this. What must never happen is an eval reaching the probe scalar or the command
# decoded from it, because then every assertion above would hold by accident.
if grep -nE '(^|[^_[:alnum:]])eval[[:space:]]' "$SUBJECT" | grep -qE 'probe|\$\{?command'; then
  bad "the subject evals probe text; decoding must not re-parse what is about to run"
else
  ok "no eval reaches the probe scalar or the command decoded from it"
fi

if [ "$fail" -eq 0 ]; then
  echo "test-cross-family-probe-parsing: PASS"
else
  echo "--- hook stderr ---" >&2; cat "$TMP/err" >&2
  echo "test-cross-family-probe-parsing: FAIL" >&2
fi
exit "$fail"
