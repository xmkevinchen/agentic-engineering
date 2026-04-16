---
id: think-auto-fallback-no-agent-teams
target: ae:think
layer: 1
source: generated
---

## Context
- `~/.claude/settings.json` does NOT contain `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS` key, or it is set to `"0"`
- `.claude/pipeline.yml` exists in the project

## Prompt
/ae:think "should we switch to event-driven architecture for the notification system?"

## Prompt Variants
- /ae:think "what is the best caching strategy for our API?"
