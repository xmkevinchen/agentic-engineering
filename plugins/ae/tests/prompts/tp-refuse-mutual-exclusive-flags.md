---
id: tp-refuse-mutual-exclusive-flags
target: ae:test-plugin
layer: 1
source: generated
---

## Context
- Agent Teams enabled
- `.claude/pipeline.yml` exists with valid config
- Both `--regression` and `--refresh` flags are provided simultaneously

## Prompt
/ae:test-plugin --regression --refresh ae:discuss

## Prompt Variants
- /ae:test-plugin --refresh --regression ae:plan
- /ae:test-plugin --regression --refresh ae:work
