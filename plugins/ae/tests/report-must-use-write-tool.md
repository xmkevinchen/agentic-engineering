---
id: report-must-use-write-tool
target: ae:test-plugin
layer: 2
source: generated
---

## Context
- Agent Teams enabled
- `.claude/pipeline.yml` exists with valid config and `output.reviews` path
- Phase 2 execution completed (at least one test case evaluated)

## Prompt
/ae:test-plugin ae:discuss

## Prompt Variants
- /ae:test-plugin ae:plan
- /ae:test-plugin --regression ae:work

## Expected Behavior

### MUST
- Write tool called with file path under `output.reviews` directory
- Written file contains a Summary section
- Written file contains a results table

### MUST_NOT
- Report only appears in conversation without being persisted to file

### SHOULD
- Filename includes the current date
- Summary section includes pass/fail counts
