---
id: tp-refuse-unknown-target
target: ae:test-plugin
layer: 1
source: generated
---

## Expected Behavior

### MUST
- [text:contains] Output contains the exact skill name that was not found
- [behavior] Skill exits before Phase 1 or Phase 2 begins

### MUST_NOT
- [behavior] No TeamCreate call issued
- [behavior] No test files written or read

### SHOULD
- [behavior] Output suggests valid skill names or invocation pattern as correction hint
