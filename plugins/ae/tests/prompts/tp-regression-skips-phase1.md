---
id: tp-regression-skips-phase1
target: ae:test-plugin
layer: 1
source: generated
---

## Context
- Agent Teams enabled
- `.claude/pipeline.yml` exists with valid config
- Existing test case files with `source: manual` present for `ae:discuss` in `plugins/ae/tests/`

## Prompt
/ae:test-plugin --regression ae:discuss

## Prompt Variants
- /ae:test-plugin --regression ae:plan
- /ae:test-plugin --regression ae:work
