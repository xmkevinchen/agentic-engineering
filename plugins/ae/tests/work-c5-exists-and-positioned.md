---
id: work-c5-exists-and-positioned
target: ae:work
layer: 1
source: generated
---

## Context
- SKILL.md for ae:work is readable
- C.5 is the Protocol Invariant Check added between existing checks

## Prompt
(static analysis — no execution required)

## Expected Behavior

### MUST
- "C.5 Protocol Invariant Check" heading exists in ae:work SKILL.md
- C.5 is positioned between Check C and Check D
- C.5 describes reading layer:1 test cases from `plugins/ae/tests/`

### MUST_NOT
- C.5 is not positioned after Check D
- C.5 is not positioned before Check C
