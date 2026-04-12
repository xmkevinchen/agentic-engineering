---
id: review-deferred-findings-blocks-unresolved
target: ae:review
layer: 1
source: generated
---

## Context
- `~/.claude/settings.json` contains `"CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS": "1"` (Agent Teams enabled)
- All plan steps are `[x]` completed; tests pass
- `output.milestones/<plan-id>/notes.md` exists with a `DEFERRED [Step N]:` entry that has NO `Disposition:` line (UNRESOLVED state)

## Prompt
/ae:review .ae/plans/001-example-plan.md

## Prompt Variants
- /ae:review docs/plans/001-example.md
