---
id: analyze-refuse-missing-pipeline
target: ae:analyze
layer: 1
source: generated
---

## Context
- `~/.claude/settings.json` contains `"CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS": "1"` (Agent Teams enabled)
- No `pipeline.yml` exists in the project root or any expected location
- Codebase is otherwise functional

## Prompt
/ae:analyze "test topic"

## Prompt Variants
- /ae:analyze "authentication flow"
- /ae:analyze "database connection pooling"
