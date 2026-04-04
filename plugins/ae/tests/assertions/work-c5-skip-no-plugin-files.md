---
id: work-c5-skip-no-plugin-files
target: ae:work
layer: 1
source: generated
---

## Expected Behavior

### MUST
- C.5 is skipped when no plugin files are in the diff
- A skip message is present in output

### MUST_NOT
- C.5 does not always run regardless of diff contents

### SHOULD
- Skip message explains why C.5 was skipped (no plugin files changed)
