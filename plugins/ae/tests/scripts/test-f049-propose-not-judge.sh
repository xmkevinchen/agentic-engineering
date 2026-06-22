#!/bin/sh
# test-f049-propose-not-judge.sh — F-049 AC7: L1 static guard (deterministic).
# Asserts the self-grading guard prose (propose≠judge + boundary-param) is present in
# plan/SKILL.md — the static complement to Step 6's live behavioral dogfood.
set -u
HERE=$(dirname "$0")
PLAN="$HERE/../../skills/plan/SKILL.md"
fail=0
check() { # desc fixed-string
  if grep -Fq "$2" "$PLAN"; then echo "ok: $1"; else echo "FAIL: $1 — missing: $2"; fail=1; fi
}
check "propose != judge separation documented" "propose ≠ judge"
check "self-grading guard stated"               "self-grading guard"
check "boundary-param instantiation instruction" "boundary values, not"
check "verify_by: contract documented"           "verify_by: contract"
if [ "$fail" -eq 0 ]; then echo "ALL PASS"; else echo "SOME FAILED"; exit 1; fi
