#!/bin/sh
# F-063 AC4 — no new machinery (re-freeze + scope guard).
# Asserts ABSENCE: no new frontmatter field, no new verify_by menu, no new runtime script.
set -u
ROOT=$(cd "$(dirname "$0")/../../../.." && pwd)
ANALYZE="$ROOT/plugins/ae/skills/analyze/SKILL.md"
PLAN="$ROOT/plugins/ae/skills/plan/SKILL.md"
fail=0
absent() { # $1 desc, $2 pattern, $3 file
  if grep -qiE -- "$2" "$3"; then
    echo "FAIL: $1 (forbidden marker present: $2 in $(basename "$3"))"
    fail=1
  else
    echo "PASS: $1"
  fi
}
# no new frontmatter field introduced by F-063
absent "no verify_method: field (analyze)"      'verify_method:' "$ANALYZE"
absent "no verify_method: field (plan)"          'verify_method:' "$PLAN"
absent "no harness_selection: field (analyze)"   'harness_selection:' "$ANALYZE"
absent "no harness_selection: field (plan)"       'harness_selection:' "$PLAN"
# no new method menu (the F-063-rejected TDD/BDD/agent-automation vocabulary)
absent "no new TDD/BDD method menu (analyze)"     'agent-automation|screenshot\+visual' "$ANALYZE"
absent "no new TDD/BDD method menu (plan)"         'agent-automation|screenshot\+visual' "$PLAN"
# the canonical 6-kind verify_by enum is intact in plan
if grep -qE 'unit.{0,3}integration.{0,3}e2e.{0,3}contract.{0,3}judge.{0,3}manual' "$PLAN"; then
  echo "PASS: canonical 6-kind verify_by enum intact"
else
  echo "FAIL: canonical verify_by enum not found intact in plan/SKILL.md"
  fail=1
fi
# no new NON-TEST f063 runtime script (only tests/ may carry f063 files)
if ls "$ROOT"/plugins/ae/scripts/*f063* "$ROOT"/plugins/ae/bin/*f063* >/dev/null 2>&1; then
  echo "FAIL: a new non-test f063 script exists under scripts/ or bin/"
  fail=1
else
  echo "PASS: no new non-test f063 runtime script"
fi
[ "$fail" -eq 0 ] && echo "ALL PASS (F-063 AC4)" || echo "FAILURES (F-063 AC4)"
exit $fail
