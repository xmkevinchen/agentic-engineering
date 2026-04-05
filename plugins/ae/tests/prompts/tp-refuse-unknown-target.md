---
id: tp-refuse-unknown-target
target: ae:test-plugin
layer: 1
source: generated
---

## Context
- Agent Teams enabled
- `.claude/pipeline.yml` exists with valid config
- Skill name `ae:ghost` does not exist in plugins/ae/skills/

## Prompt
/ae:test-plugin ae:ghost

## Prompt Variants
- /ae:test-plugin ae:nonexistent
- /ae:test-plugin ae:fakeagent
