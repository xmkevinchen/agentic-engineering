#!/bin/sh
# F-063 AC1 — analyze/SKILL.md emits a GATED per-dimension verification table.
# Amended by F-086: the table is the acceptance criteria, not a sketch of them.
# Greps are anchored to DISTINCTIVE post-change markers (architect-pr Consider):
# NOT the pre-existing "Verification considerations" heading, which matches before the edit.
set -u
ROOT=$(cd "$(dirname "$0")/../../../.." && pwd)
SKILL="$ROOT/plugins/ae/skills/analyze/SKILL.md"
fail=0
check() {
  if grep -qiE -- "$2" "$SKILL"; then
    echo "ok: $1"
  else
    echo "FAIL: $1 (marker absent: $2)"
    fail=1
  fi
}
# (a) table header carrying the 3 columns (distinctive: a literal table row)
# F-086 widened this table: it carries the criterion itself now — an id, the property,
# and the falsifier — because the criteria are settled in analyze rather than sketched
# here and authored in plan. `verify_by` stays, and stays plan's decision; what moved is
# the criterion, not the method. The header assertion tracks that.
check "verification table header (id | property | falsifier | verify_by | ...)" '\| *id *\| *property *\| *falsifier *\| *verify_by'
# (b) exit-gate STOP in the Synthesize step (distinctive phrase)
check "analyze exit-gate STOP (do NOT finish analysis.md without the table)" 'do NOT finish'
# (c) honest framing that the producer-gate is the weak self-graded half
check "honest self-graded-half framing" 'self-graded'
[ "$fail" -eq 0 ] && echo "ALL PASS (F-063 AC1)" || echo "FAILURES (F-063 AC1)"
exit $fail
