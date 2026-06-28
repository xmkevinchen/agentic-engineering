#!/bin/sh
# F-063 AC1 — analyze/SKILL.md emits a GATED per-dimension verification table.
# Greps are anchored to DISTINCTIVE post-change markers (architect-pr Consider):
# NOT the pre-existing "Verification considerations" heading, which matches before the edit.
set -u
ROOT=$(cd "$(dirname "$0")/../../../.." && pwd)
SKILL="$ROOT/plugins/ae/skills/analyze/SKILL.md"
fail=0
check() {
  if grep -qiE -- "$2" "$SKILL"; then
    echo "PASS: $1"
  else
    echo "FAIL: $1 (marker absent: $2)"
    fail=1
  fi
}
# (a) table header carrying the 3 columns (distinctive: a literal table row)
check "verification table header (dimension | verify_by | ...)" '\| *dimension *\| *verify_by'
# (b) exit-gate STOP in the Synthesize step (distinctive phrase)
check "analyze exit-gate STOP (do NOT finish analysis.md without the table)" 'do NOT finish'
# (c) honest framing that the producer-gate is the weak self-graded half
check "honest self-graded-half framing" 'self-graded'
[ "$fail" -eq 0 ] && echo "ALL PASS (F-063 AC1)" || echo "FAILURES (F-063 AC1)"
exit $fail
