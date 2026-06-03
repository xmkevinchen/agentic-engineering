---
id: work-autopass-plain-language
target: ae:work
layer: 1
source: regression
---

## Expected Behavior

### MUST
- [text:contains] The auto-continue line reads: `✅ Ready to continue: tests pass, no blockers, no unresolved drift. Continuing to Step N+1.`
- [text:contains] The gate expression line is intact: `gate = tests_green AND no_p1 AND no_accumulated_p1 AND deferred_resolved AND (no_drift OR drift_approved) AND (NOT cross_family_degraded)`
- [text:contains] TRUE SENTINEL guard — `Actual files` field name still present in the step-summary template and the Check 2 overlap heuristic
- [text:contains] The pause path leads with a plain-language blocker message, codes in parentheses (e.g. `Pausing: 1 blocker finding (P1) needs a fix before continuing.`)

### MUST_NOT
- [structure] The user-facing `✅` auto-continue display line does NOT contain the internal code string `no P1` (the gate expression's `no_p1` variable on its own spec line is allowed and required)

### SHOULD
- [text:contains] A note marks the gate's internal variables as spec-not-display (referencing output-standards Rule A)
