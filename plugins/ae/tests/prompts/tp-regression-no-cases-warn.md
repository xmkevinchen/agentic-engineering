---
id: tp-regression-no-cases-warn
target: ae:test-plugin
layer: 1
source: generated
---

## Context
- Agent Teams enabled
- `.claude/pipeline.yml` exists with valid config
- No test files exist in `plugins/ae/tests/` for target skill `ae:discuss` with `source: manual` or `source: regression`
- (Only `source: generated` files exist, or no files at all)

## Prompt
/ae:test-plugin --regression ae:discuss

## Prompt Variants
- /ae:test-plugin --regression ae:foobar-with-no-cases
