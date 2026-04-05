---
id: analyze-refuse-no-agent-teams
target: ae:analyze
layer: 1
source: generated
---

## Context
- `~/.claude/settings.json` does NOT contain `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS` key, or the key is set to `"0"` or absent entirely
- Project has a valid `pipeline.yml` in the expected location
- Codebase is otherwise functional

## Prompt
/ae:analyze "error handling patterns"

## Prompt Variants
- /ae:analyze "logging strategy"
- /ae:analyze "dependency injection patterns"
