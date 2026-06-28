#!/bin/sh
# test-f067-never-drop.sh — F-067 AC2: the never-drop invariant is encoded structurally in
# review/SKILL.md — final_lenses = union(baseline, risk_floor, soft_added), ALWAYS ⊇ baseline
# and ⊇ risk_floor, and selection is ADDITIVE (never prune from a full set). Deterministic
# regression guard: goes red if the union formula or the additive rule is weakened.
set -u
HERE=$(cd "$(dirname "$0")" && pwd)
SKILL="$HERE/../../skills/review/SKILL.md"
fail=0

check() { # label  pattern
  if grep -qiE -- "$2" "$SKILL"; then echo "ok: $1"; else echo "FAIL: $1 — pattern not found: $2"; fail=1; fi
}
absent() { # label  pattern  (must NOT appear)
  if grep -qiE -- "$2" "$SKILL"; then echo "FAIL: $1 — forbidden pattern present: $2"; fail=1; else echo "ok: $1"; fi
}

# the union formula is stated
check  "final_lenses = union of the three sources"   'final_lenses = union\(baseline_lenses, risk_floor_lenses, soft_added_lenses\)'
# the two superset invariants are stated
check  "final ⊇ baseline (floor never dropped)"      'ALWAYS .*baseline_lenses'
check  "final ⊇ risk_floor (forced lens never vetoed)" 'risk_floor_lenses .*forced lens cannot be vetoed|cannot be vetoed by the soft-add'
# selection is additive, never prune
check  "selection is ADDITIVE not prune"             'additive.* you ADD lenses to the floor on evidence'
check  "explicitly never start-from-full-and-prune"  'NEVER start from the full specialist set and prune'
# "no lens" framed as absence-of-trigger, not a drop
check  "omission = absence of trigger, not a drop"   'absence of a trigger.*NOT a dropped lens|NOT a dropped lens'
# F4 fixup: the --reviewer override must NOT drop the floor (was the iter-0 P1 contradiction).
# The SKILL must explicitly state the floor survives --reviewer and ceremony:minimal is the sole drop.
check  "floor survives --reviewer (F4)"              'Floor survives .--reviewer|floor .*STILL spawns'
check  "--reviewer overrides specialists only"       '--reviewer. overrides only the .specialist'
check  "ceremony:minimal still sole floor-drop"      'ceremony: minimal. stays the .*ONLY. path that drops the floor|never .--reviewer'

[ "$fail" -eq 0 ] && echo "ALL PASS" || { echo "SOME FAILED"; exit 1; }
