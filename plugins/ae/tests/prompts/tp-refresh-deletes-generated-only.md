---
id: tp-refresh-deletes-generated-only
target: ae:test-plugin
layer: 2
source: generated
---

## Context
- Agent Teams enabled
- `.claude/pipeline.yml` exists with valid config
- `plugins/ae/tests/` contains a mix of files for `ae:discuss`:
  - One file with `source: generated`
  - One file with `source: manual`
  - One file with `source: regression`

## Prompt
/ae:test-plugin --refresh ae:discuss

## Prompt Variants
- /ae:test-plugin --refresh ae:plan
