---
id: roadmap-close-batch-action
target: ae:roadmap
layer: 1
source: manual
---

## Context

- F-035 (Option B) added a human-confirmed CLOSE action to section (a)'s batch-approval block that moves Tier-1 CLOSE BLs to `.ae/backlog/closed/`.
- HARD CONSTRAINT: the move never auto-runs, Tier-2 advisory CLOSEs are never actionable, and CLOSE confirmation is independent of PROMOTE approval.

## Prompt

How does the batch-approval block handle CLOSE confirmation and the Apply CLOSEs move — what fires the block, what is actionable, and what safeguards gate the file move?
