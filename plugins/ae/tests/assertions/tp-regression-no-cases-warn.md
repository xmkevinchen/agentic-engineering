---
id: tp-regression-no-cases-warn
target: ae:test-plugin
layer: 1
source: generated
---

## Expected Behavior

### MUST
- [text:contains] Output contains "No manual/regression cases found"
- [text:contains] Output mentions the target skill name
- [behavior] Skill exits cleanly after warning — no test execution occurs

### MUST_NOT
- [behavior] No TeamCreate call issued
- [behavior] No Phase 1 generation proceeds (must not silently generate new cases in --regression mode)

### SHOULD
- [behavior] Warning is explicit that nothing ran, not just silent exit
