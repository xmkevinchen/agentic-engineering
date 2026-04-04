---
id: refuse-unknown-target
target: ae:test-plugin
layer: 1
source: generated
---

## Context
- Agent Teams enabled
- `.claude/pipeline.yml` exists with valid config
- Target skill name does not exist in the plugin

## Prompt
/ae:test-plugin ae:nonexistent-skill

## Prompt Variants
- /ae:test-plugin ae:foobar
- /ae:test-plugin ae:deploy
