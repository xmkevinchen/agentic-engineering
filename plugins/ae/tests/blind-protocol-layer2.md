---
id: blind-protocol-layer2
target: ae:test-plugin
layer: 2
source: generated
---

## Context
- Agent Teams enabled
- `.claude/pipeline.yml` exists with `test.judge` configured and reachable
- At least one Layer 2 test case exists for the target skill

## Prompt
/ae:test-plugin ae:plan

## Prompt Variants
- /ae:test-plugin ae:discuss
- /ae:test-plugin ae:work

## Expected Behavior

### MUST
- TL reads test case files from `plugins/ae/tests/`
- Raw execution output is sent to judge without TL assessment (LLM-judge)

### MUST_NOT
- Expected Behavior content from test case not included in messages sent before judge evaluation (LLM-judge)
- No self-assessment by TL of pass/fail before judge sees output (LLM-judge)

### SHOULD
- Judge receives only raw output and assertion criteria separately
