---
id: review-refuse-plan-not-done
target: ae:review
layer: 1
source: generated
---

## Expected Behavior

### MUST
- [behavior] SKILL.md Check 2 refuses when plan has pending steps (`- [ ]`)
- [text:contains] SKILL.md suggests running /ae:work as the corrective action
- [behavior] Execution stops — review does not proceed past Check 2

### MUST_NOT
- [behavior] MUST NOT call TeamCreate when plan has uncompleted steps
- [behavior] MUST NOT call Agent
- [file:exists] MUST NOT write any review file

### SHOULD
- [text:contains] Error identifies which steps are still pending
