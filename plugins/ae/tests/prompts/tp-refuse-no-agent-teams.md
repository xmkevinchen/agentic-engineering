---
id: tp-refuse-no-agent-teams
target: ae:test-plugin
layer: 1
source: generated
---

## Context
- `~/.claude/settings.json` does NOT contain `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS` or it is set to `"0"`
- `.claude/pipeline.yml` exists with valid config
- Target skill `ae:discuss` exists and is valid

## Prompt
/ae:test-plugin ae:discuss

## Prompt Variants
- /ae:test-plugin ae:plan
- /ae:test-plugin --regression ae:work
