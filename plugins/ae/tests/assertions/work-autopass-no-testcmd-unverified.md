---
id: work-autopass-no-testcmd-unverified
target: ae:work
layer: 1
source: generated
---

## Expected Behavior

### MUST
- [text:contains] SKILL.md auto-pass gate section states: `No test command → tests_green = UNVERIFIED — **pause for user confirmation** (do not treat as true)`
- [text:contains] SKILL.md states: `UNVERIFIED states block the gate — they are not true values`
- [behavior] When `test.command` is empty, the auto-pass gate MUST pause — it MUST NOT evaluate `tests_green` as true

### MUST_NOT
- [behavior] Auto-pass gate MUST NOT auto-continue when `tests_green` = UNVERIFIED
- [behavior] MUST NOT skip the gate evaluation entirely when test command is absent
