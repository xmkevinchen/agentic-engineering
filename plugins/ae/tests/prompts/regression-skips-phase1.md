---
id: regression-skips-phase1
target: ae:test-plugin
layer: 1
source: generated
---

## Context
- Agent Teams enabled
- `.claude/pipeline.yml` exists with valid config
- Existing test case files present in `plugins/ae/tests/` for the target skill

## Prompt
/ae:test-plugin --regression ae:discuss

## Prompt Variants
- /ae:test-plugin --regression ae:plan
- /ae:test-plugin --regression ae:work
