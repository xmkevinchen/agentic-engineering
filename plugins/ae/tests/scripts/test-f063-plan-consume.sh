#!/bin/sh
# F-063 AC2 — plan/SKILL.md explicitly CONSUMES the analyze table + records divergence.
# Distinctive post-change markers only (architect-pr Consider).
set -u
ROOT=$(cd "$(dirname "$0")/../../../.." && pwd)
SKILL="$ROOT/plugins/ae/skills/plan/SKILL.md"
fail=0
check() {
  if grep -qiE -- "$2" "$SKILL"; then
    echo "ok: $1"
  else
    echo "FAIL: $1 (marker absent: $2)"
    fail=1
  fi
}
# explicit consume instruction in Step-1 Research (challenger binding condition)
check "explicit consume instruction" 'consume the analyze verification'
check "verify_by STARTING POINT framing" 'starting point'
# brownfield graceful degrade
check "brownfield absent -> warn + derive from scratch" 'derive .*from scratch|non-blocking warning'
# inline conventions
check "override convention (downgrade)" '# verify_by override'
check "dropped-dimension convention" '# dimension dropped'
# honest framing (strong convention, not enforced mapping)
check "strong-convention + Check 7 backstop framing" 'strong convention with review Check 7'
[ "$fail" -eq 0 ] && echo "ALL PASS (F-063 AC2)" || echo "FAILURES (F-063 AC2)"
exit $fail
