#!/bin/sh
# test-f067-floor.sh — F-067 AC5: the always-on generalist floor is encoded structurally
# in review/SKILL.md (challenger + code-reviewer, unconditional, → baseline_lenses).
# Deterministic regression guard: goes red if the floor instruction or either floor agent
# is removed. (The behavioral guarantee that the LLM obeys it is the judge AC; this guards
# that the instruction EXISTS and names both non-overlapping roles — the never-drop basis.)
set -u
HERE=$(cd "$(dirname "$0")" && pwd)
SKILL="$HERE/../../skills/review/SKILL.md"
fail=0

check() { # label  pattern
  if grep -qiE "$2" "$SKILL"; then echo "ok: $1"; else echo "FAIL: $1 — pattern not found: $2"; fail=1; fi
}

# The floor section exists and is tied to baseline_lenses
check "floor section names baseline_lenses"        'Always-on generalist floor.*baseline_lenses'
# Both floor agents named as the unconditional floor
check "challenger is a floor agent"                '\*\*.?challenger.?\*\* .* attacks decisions'
check "code-reviewer is a floor agent"             '\*\*.?code-reviewer.?\*\* .* implementation-correctness'
# Unconditional / structural wording (not signal-chosen)
check "floor is unconditional/structural"          'UNCONDITIONALLY spawn the two-agent floor'
check "never-drop tied to structural floor"        'never-drop invariant.*deterministically true'

[ "$fail" -eq 0 ] && echo "ALL PASS" || { echo "SOME FAILED"; exit 1; }
