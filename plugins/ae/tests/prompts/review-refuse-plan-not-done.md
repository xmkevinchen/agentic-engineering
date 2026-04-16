---
id: review-refuse-plan-not-done
target: ae:review
layer: 1
source: generated
---

## Context
- `~/.claude/settings.json` contains `"CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS": "1"` (Agent Teams enabled)
- A plan file exists with at least one step still pending (`- [ ]`)
- Tests are green (or no test command configured)

## Prompt
/ae:review .ae/plans/001-example-plan.md

## Prompt Variants
- /ae:review docs/plans/002-in-progress.md
