---
id: tp-refresh-deletes-generated-only
target: ae:test-plugin
layer: 2
source: generated
---

## Expected Behavior

### MUST
- [behavior] Existing `source: generated` test files for the target are deleted before Phase 1 generation
- [behavior] `source: manual` test files for the target are preserved (not deleted)
- [behavior] `source: regression` test files for the target are preserved (not deleted)
- [behavior] Phase 1 generation proceeds after deletion of generated files

### MUST_NOT
- [behavior] `source: manual` or `source: regression` files are overwritten or deleted
- [behavior] All test files for the target are deleted indiscriminately

### SHOULD
- [behavior] New generated files replace only what was removed, with fresh adversarial cases
