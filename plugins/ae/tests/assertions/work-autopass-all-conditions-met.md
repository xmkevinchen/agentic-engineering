---
id: work-autopass-all-conditions-met
target: ae:work
layer: 2
source: generated
---

## Expected Behavior

### MUST
- [behavior] When all four conditions are true (`tests_green AND no_p1 AND (no_drift OR drift_approved) AND (NOT cross_family_degraded)`), the gate auto-continues without pausing
- [text:contains] Output includes confirmation text matching: `✅ Auto-pass: tests green, no P1, no drift, review complete. Continuing to Step`
- [behavior] Execution proceeds to the next pending plan step (`- [ ]`) automatically

### MUST_NOT
- [behavior] MUST NOT pause for user confirmation when all four gate conditions are satisfied
- [behavior] MUST NOT prompt for any manual input between steps when gate passes

### SHOULD
- [text:contains] Output explicitly states which step it is continuing to (e.g. "Continuing to Step 2")
