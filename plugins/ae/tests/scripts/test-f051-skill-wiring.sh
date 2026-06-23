#!/bin/sh
# test-f051-skill-wiring.sh — F-051 AC5/AC6: consumer SKILL wiring + honest-bound persist (L1 static fixture).
set -eu
ROOT="$(CDPATH= cd "$(dirname "$0")/../../../.." && pwd)"
S="$ROOT/plugins/ae/skills"
fail=0
has() { # <label> <file> <fixed-string>
  if grep -Fq -- "$3" "$2"; then echo "  ok: $1"; else echo "  FAIL: $1 — missing in $2" >&2; fail=1; fi
}

# AC5 — plan/SKILL.md documents the node_check schema
has "plan: node_check schema documented" "$S/plan/SKILL.md" 'node_check: <template-id> k=v'
has "plan: catalog reference"            "$S/plan/SKILL.md" 'check-templates.catalog'
has "plan: red-before-green probe named" "$S/plan/SKILL.md" 'red-before-green probe'

# AC5 — plan-review recognizes node_check as a runnable check + validates it
has "plan-review: node_check is runnable form" "$S/plan-review/SKILL.md" 'no `node_check:`'
has "plan-review: node_check validity rule"     "$S/plan-review/SKILL.md" '`node_check:` validity (F-051)'

# AC5 — work references the redcheck/nonce probe
has "work: redcheck probe wired" "$S/work/SKILL.md" 'red-before-green probe (`redcheck`)'

# AC5 — review Check 7 names node_check
has "review: Check 7 node_check awareness" "$S/review/SKILL.md" '`node_check:` step (F-051)'

# AC6 — honest bound states BOTH residuals, no overclaim
has "plan: semantic-depth residual named"   "$S/plan/SKILL.md" 'semantic-depth Potemkin'
has "plan: param-selection residual named"  "$S/plan/SKILL.md" 'param-selection theater'
has "plan: falsifiability-vs-relevance"     "$S/plan/SKILL.md" 'falsifiability'

[ "$fail" = 0 ] && echo "ok test-f051-skill-wiring" || { echo "test-f051-skill-wiring FAILED" >&2; exit 1; }
