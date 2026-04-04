---
id: work-c5-exists-and-positioned
target: ae:work
layer: 1
source: generated
---

## Expected Behavior

### MUST
- "C.5 Protocol Invariant Check" heading exists in ae:work SKILL.md
- C.5 is positioned between Check C and Check D
- C.5 delegates to `/ae:test-plugin --regression` for Layer 1 protocol checks

### MUST_NOT
- C.5 is not positioned after Check D
- C.5 is not positioned before Check C
