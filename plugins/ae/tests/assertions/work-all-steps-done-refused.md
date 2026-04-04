---
id: work-all-steps-done-refused
target: ae:work
layer: 1
source: generated
---

## Expected Behavior

### MUST
- [text:contains] SKILL.md Check 2 states: `All done → suggest /ae:review, **refuse to execute**`
- [behavior] When all plan steps are `- [x]`, the skill refuses to execute and suggests `/ae:review`
- [behavior] Refusal occurs at Check 2 (Locate Current Step), before any execution or Agent Teams spawning

### MUST_NOT
- [behavior] MUST NOT proceed to Check 3 (Agent Teams) or any execution when all steps are done
- [behavior] MUST NOT create Agent Teams or start TDD cycle when there are no pending steps
- [behavior] MUST NOT re-execute already-completed steps
