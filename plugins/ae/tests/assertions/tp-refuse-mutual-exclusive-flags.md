---
id: tp-refuse-mutual-exclusive-flags
target: ae:test-plugin
layer: 1
source: generated
---

## Expected Behavior

### MUST
- [behavior] Skill exits with an error before any test activity
- [text:contains] Error message references mutually exclusive flags

### MUST_NOT
- [behavior] No TeamCreate call issued
- [behavior] No test files written to plugins/ae/tests/

### SHOULD
- [text:contains] Error message names both `--regression` and `--refresh` explicitly
