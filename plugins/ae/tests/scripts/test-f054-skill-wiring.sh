#!/bin/sh
# test-f054-skill-wiring.sh — F-054 Phase-1 AC3/AC4/AC5: DAG SKILL wiring + honest bounds (L1 fixture).
set -eu
ROOT="$(CDPATH= cd "$(dirname "$0")/../../../.." && pwd)"
S="$ROOT/plugins/ae/skills"
fail=0
has(){ if grep -Fq -- "$3" "$2"; then echo "  ok: $1"; else echo "  FAIL: $1 — missing in $2" >&2; fail=1; fi; }

# AC3 — work DAG-drive contract
has "work: DAG mode opt-in"          "$S/work/SKILL.md" 'DAG mode (F-054 Phase-1 — opt-in)'
has "work: ready-set frontier"       "$S/work/SKILL.md" 'ready-set frontier'
has "work: commit-before-execute"    "$S/work/SKILL.md" 'Commit-before-execute'
has "work: NODE_STATE not verdict"   "$S/work/SKILL.md" 'check-node.sh` NEVER reads `NODE_STATE`'
has "work: legacy unchanged"         "$S/work/SKILL.md" "no silent DAG interpretation of legacy plans"

# AC4 — plan schema doc + plan-review gate
has "plan: dag opt-in schema"        "$S/plan/SKILL.md" '`dag: true` + per-node `id:`/`depends:`'
has "plan: Phase-1 scope excludes later fields" "$S/plan/SKILL.md" 'NOT in Phase-1'
has "plan-review: check-dag validate gate" "$S/plan-review/SKILL.md" 'DAG well-formedness (F-054 Phase-1)'
has "plan-review: check-dag command" "$S/plan-review/SKILL.md" 'check-dag.sh <plan> validate'

# AC5 — honest bounds, no overclaim
has "plan: goal-driven reversal bound" "$S/plan/SKILL.md" 'goal-driven*'
has "plan: Phase-1 serial not parallel" "$S/plan/SKILL.md" 'Phase-1 is SERIAL, not parallel'
has "plan: growth is later phase"    "$S/plan/SKILL.md" 'DAG is fixed at plan time in Phase-1'
has "plan: Potemkin residual"        "$S/plan/SKILL.md" 'semantic-depth Potemkin remains uncloseable'

[ "$fail" = 0 ] && echo "ok test-f054-skill-wiring" || { echo "test-f054-skill-wiring FAILED" >&2; exit 1; }
