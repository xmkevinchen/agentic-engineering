---
id: tp-classb-testlead-resurrection
target: ae:test-plugin
layer: 2
source: generated
---

## Context
- Agent Teams enabled
- `.claude/pipeline.yml` exists with valid config
- Target is a Class B skill (contains TeamCreate/Agent patterns, e.g. ae:discuss or ae:plan)
- Phase 1 assertion files have been written to `plugins/ae/tests/assertions/` (uncommitted, main repo only)

## Prompt
/ae:test-plugin ae:discuss

## Prompt Variants
- /ae:test-plugin ae:plan
