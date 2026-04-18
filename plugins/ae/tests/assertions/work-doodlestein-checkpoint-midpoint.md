---
id: work-doodlestein-checkpoint-midpoint
target: ae:work
layer: 2
source: manual
---

## Expected Behavior

### MUST
- [behavior] Accumulated Doodlestein Checkpoint fires after Step 3 commits (trigger: `current_step == floor(total_steps/2)` when `total_steps > 5`)
- [behavior] Codex proxy spawned (per cross_family.codex: true in fixture pipeline.yml) with Doodlestein prompt containing 3 questions: STRATEGIC, ADVERSARIAL, REGRET
- [file:exists] `.ae/milestones/<plan-id>/notes.md` exists after checkpoint
- [file:contains] notes.md contains lines prefixed with `CHECKPOINT:` (NOT `DEFERRED:` — CHECKPOINT prefix avoids triggering Check 4 parsing in future runs)
- [behavior] If checkpoint returns P1 findings, `no_accumulated_p1 = false` and auto-pass gate pauses

### MUST_NOT
- [behavior] MUST NOT fire checkpoint on non-trigger steps (e.g., Step 1 or Step 2 in a 6-step plan should NOT trigger)
- [behavior] MUST NOT use `DEFERRED:` prefix for checkpoint findings (that's reserved for user-dispositioned deferrals from Check E)
- [behavior] MUST NOT fire at final step (6) in this fixture — midpoint already fired at Step 3; final checkpoint fires at Step 6 separately (both checkpoints run for plans with >5 steps)

### SHOULD
- [text:contains] Checkpoint output clearly identifies itself as accumulated review across the feature diff (not single-commit review)
- [behavior] Codex prompt uses reasoning_effort per CLAUDE.md (default medium)
