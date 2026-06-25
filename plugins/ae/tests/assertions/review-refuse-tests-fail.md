---
id: review-refuse-tests-fail
target: ae:review
layer: 1
source: generated
---

## Expected Behavior

### MUST
- [behavior] SKILL.md Check 3 refuses when test command exits with failure
- [text:contains] SKILL.md requires fixing tests before proceeding with review
- [behavior] Execution stops — review does not proceed past Check 3

### MUST_NOT
- [behavior] MUST NOT spawn any teammates via the Agent tool when tests are failing
- [behavior] MUST NOT call Agent
- [file:exists] MUST NOT write any review file

### SHOULD
- [text:contains] Output states "fix first" or equivalent guidance before running /ae:review again
