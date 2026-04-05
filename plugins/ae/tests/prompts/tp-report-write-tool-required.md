---
id: tp-report-write-tool-required
target: ae:test-plugin
layer: 2
source: generated
---

## Context
- Agent Teams enabled
- `.claude/pipeline.yml` exists with valid config and `output.reviews` path set
- At least one test case has been evaluated in Phase 2

## Prompt
/ae:test-plugin ae:discuss

## Prompt Variants
- /ae:test-plugin ae:plan
- /ae:test-plugin --regression ae:work
