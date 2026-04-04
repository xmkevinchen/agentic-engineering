---
id: work-c5-failure-is-p1
target: ae:work
layer: 1
source: generated
---

## Expected Behavior

### MUST
- A Layer 1 assertion failure is classified as P1 severity
- Failure report format includes the case id and the failing assertion
- Pass report format exists for successful checks

### MUST_NOT
- Failure is not classified as P2 or lower
- Commit is not allowed to proceed when a C.5 failure exists
