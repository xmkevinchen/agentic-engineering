---
id: work-c5-trigger-on-plugin-files
target: ae:work
layer: 1
source: generated
---

## Expected Behavior

### MUST
- C.5 triggers when git diff includes files under `plugins/ae/skills/` or `plugins/ae/agents/`
- C.5 reads all layer:1 test cases when triggered
- A C.5 failure is treated as P1 severity

### MUST_NOT
- C.5 does not run unconditionally on every work execution
