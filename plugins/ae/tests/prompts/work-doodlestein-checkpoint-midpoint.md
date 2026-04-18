---
id: work-doodlestein-checkpoint-midpoint
target: ae:work
layer: 2
source: manual
---

## Context

Fixture state (in worktree):
- `.claude/pipeline.yml` exists, Agent Teams enabled, `cross_family.codex: true`
- A plan file at `.ae/plans/999-test-plan.md` with 6 steps (total_steps = 6)
- Steps 1, 2, 3 already `[x]` marked done with fake commit hashes; Steps 4, 5, 6 pending
- Current step to execute: Step 3 (about to become Step 3 done → triggering midpoint: current=3 == floor(6/2)=3)

## Prompt

Execute:
```
/ae:work .ae/plans/999-test-plan.md
```

Per ae:work's Post-commit section, when current_step == floor(total_steps/2) AND total_steps > 5, the Accumulated Doodlestein Checkpoint MUST fire after the commit.
