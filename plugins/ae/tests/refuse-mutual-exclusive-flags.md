---
id: refuse-mutual-exclusive-flags
target: ae:test-plugin
layer: 1
source: generated
---

## Context
- Agent Teams enabled
- `.claude/pipeline.yml` exists with valid config
- Both `--regression` and `--refresh` flags passed simultaneously

## Prompt
/ae:test-plugin --regression --refresh ae:discuss

## Prompt Variants
- /ae:test-plugin --refresh --regression ae:plan
- /ae:test-plugin --regression --refresh ae:work

## Expected Behavior

### MUST
- Error message about mutually exclusive flags

### MUST_NOT
- No TeamCreate tool call
- No test files written (no Write tool call to tests/ directory)

### SHOULD
- Error message names both `--regression` and `--refresh` flags
