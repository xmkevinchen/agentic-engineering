---
id: refuse-unknown-target
target: ae:test-plugin
layer: 1
source: generated
---

## Expected Behavior

### MUST
- "not found" message referencing the exact skill name provided
- References the exact skill name the user typed

### MUST_NOT
- No TeamCreate tool call
- No Phase 1 (generation) or Phase 2 (execution) activity

### SHOULD
- Suggests valid skill names the user may have intended
