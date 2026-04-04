---
id: work-autopass-no-expected-files-pause
target: ae:work
layer: 1
source: generated
---

## Expected Behavior

### MUST
- [text:contains] SKILL.md auto-pass gate section states: `No "Expected files:" in plan step → drift = UNKNOWN — **pause for user confirmation** (do not skip)`
- [text:contains] SKILL.md states: `UNVERIFIED states block the gate — they are not true values`
- [behavior] When plan step has no "Expected files:" line, auto-pass gate MUST pause for user confirmation

### MUST_NOT
- [behavior] Auto-pass gate MUST NOT auto-continue when drift = UNKNOWN
- [behavior] MUST NOT treat missing "Expected files:" as "no drift" (passing value) in the gate
