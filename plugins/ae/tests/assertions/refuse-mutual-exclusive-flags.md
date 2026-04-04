---
id: refuse-mutual-exclusive-flags
target: ae:test-plugin
layer: 1
source: generated
---

## Expected Behavior

### MUST
- Error message about mutually exclusive flags

### MUST_NOT
- No TeamCreate tool call
- No test files written (no Write tool call to tests/ directory)

### SHOULD
- Error message names both `--regression` and `--refresh` flags
