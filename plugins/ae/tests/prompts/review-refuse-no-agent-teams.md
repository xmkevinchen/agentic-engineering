---
id: review-refuse-no-agent-teams
target: ae:review
layer: 1
source: generated
---

## Context
- `~/.claude/settings.json` does NOT contain `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS` key, or it is set to `"0"`
- A valid plan file exists with all steps `[x]` completed
- Tests are green (or no test command configured)

## Prompt
/ae:review .ae/plans/001-example-plan.md

## Prompt Variants
- /ae:review docs/plans/001-example.md
