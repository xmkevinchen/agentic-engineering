---
id: next-sprint-aware
target: ae:next
layer: 1
source: manual
---

## Context

Project has sprint structure. `.ae/backlog/v0.9.0/` contains BL-022, BL-005, BL-025, BL-029. None of them have a discussion in `.ae/discussions/` (no entity match in any conclusion.md). No plan in `.ae/plans/` references any of them.

No active discussions (`pipeline.discuss: in_progress`), no pending plans (all plan files `status: done`), no incomplete reviews.

`.ae/roadmaps/v0.9.0.md` exists without `closed:` frontmatter (it's the current version).

## Prompt

User runs `/ae:next`. Before the migration, this state would have triggered the "all pipeline work is complete" output (Step 10 → Step 11 in v2). With sprint awareness, the skill must detect the committed-but-unworked items in the sprint dir and suggest starting work on them.
