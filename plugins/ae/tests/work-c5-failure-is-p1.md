---
id: work-c5-failure-is-p1
target: ae:work
layer: 1
source: generated
---

## Context
- SKILL.md for ae:work is readable
- C.5 Protocol Invariant Check has run and evaluated layer:1 cases

## Prompt
(static analysis — no execution required)

## Expected Behavior

### MUST
- A Layer 1 assertion failure is classified as P1 severity
- Failure report format includes the case id and the failing assertion
- Pass report format exists for successful checks

### MUST_NOT
- Failure is not classified as P2 or lower
- Commit is not allowed to proceed when a C.5 failure exists
