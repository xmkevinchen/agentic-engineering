---
id: think-auto-setup-missing-pipeline
target: ae:think
layer: 1
source: generated
---

## Context
- No `.claude/pipeline.yml` exists in the project
- `~/.claude/settings.json` contains `"CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS": "1"` (Agent Teams enabled)

## Prompt
/ae:think "should we migrate to microservices?"

## Prompt Variants
- /ae:think "what database should we use?"
