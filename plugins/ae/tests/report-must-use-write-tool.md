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
- [file:exists] Report file created under `output.reviews` directory
- [file:contains] Written file contains a Summary section
- [file:contains] Written file contains a results table

### MUST_NOT
- [behavior] Report only appears in conversation without being persisted to file

### SHOULD
- [text:regex] Filename includes date pattern (\d{4}-\d{2}-\d{2})
- [file:contains] Summary section includes pass/fail counts
