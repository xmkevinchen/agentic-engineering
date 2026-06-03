---
id: work-autopass-all-conditions-met
target: ae:work
layer: 2
source: generated
---

## Expected Behavior

### MUST
- [behavior] When all gate conditions hold (tests pass, no blockers, drift resolved/approved, cross-family intact), the gate auto-continues
- [text:contains] Output includes confirmation text matching: `✅ Ready to continue: tests pass, no blockers, no unresolved drift. Continuing to Step`
- [behavior] Execution proceeds to the next pending plan step (`- [ ]`) automatically

### MUST_NOT
- [behavior] MUST NOT pause for user confirmation when all four gate conditions are satisfied
- [behavior] MUST NOT prompt for any manual input between steps when gate passes

### SHOULD
- [text:contains] Output explicitly states which step it is continuing to (e.g. "Continuing to Step 2")
