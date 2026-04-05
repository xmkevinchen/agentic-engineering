---
id: tp-classb-teamdelete-rebuild
target: ae:test-plugin
layer: 2
source: generated
---

## Context
- Agent Teams enabled
- `.claude/pipeline.yml` exists with valid config
- ae:test-plugin itself is the target (Class B: contains TeamCreate + Agent patterns)

## Prompt
/ae:test-plugin ae:test-plugin

## Prompt Variants
- /ae:test-plugin ae:plan
- /ae:test-plugin ae:discuss
