#!/bin/sh
# test-f052-cross-family-review.sh — F-052: cross-family bite-review of project node_checks (L1 fixture).
set -eu
ROOT="$(CDPATH= cd "$(dirname "$0")/../../../.." && pwd)"
S="$ROOT/plugins/ae/skills"
fail=0
has() { if grep -Fq -- "$3" "$2"; then echo "  ok: $1"; else echo "  FAIL: $1 — missing in $2" >&2; fail=1; fi; }

# AC1 — plan-review escalates project node_checks to cross-family bite-review
has "plan-review: F-052 cross-family bite-review item" "$S/plan-review/SKILL.md" 'Cross-family bite-review of `project` node_checks (F-052)'
has "plan-review: bite question"                        "$S/plan-review/SKILL.md" 'would this check FAIL a plausible broken implementation'

# AC2 — stakes-scaling + honest bound
has "plan-review: per-feature exemption (cost scales)" "$S/plan-review/SKILL.md" 'per-feature`/temp node_checks are NOT cross-family-reviewed'
has "plan-review: relevance-not-proven honest bound"   "$S/plan-review/SKILL.md" 'bounds *relevance*'

# AC3 — review-stage backstop
has "review: F-052 project backstop" "$S/review/SKILL.md" '`project` node_check cross-family backstop (F-052)'

[ "$fail" = 0 ] && echo "ok test-f052-cross-family-review" || { echo "test-f052-cross-family-review FAILED" >&2; exit 1; }
