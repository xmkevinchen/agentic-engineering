---
id: review-refuse-tests-fail
target: ae:review
layer: 1
source: generated
---

## Context
- `~/.claude/settings.json` contains `"CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS": "1"` (Agent Teams enabled)
- All plan steps are `[x]` completed
- `pipeline.yml` has a `test.command` configured
- Running the test command produces a failure (non-zero exit code)

## Prompt
/ae:review .ae/plans/001-example-plan.md

## Prompt Variants
- /ae:review docs/plans/001-example.md
