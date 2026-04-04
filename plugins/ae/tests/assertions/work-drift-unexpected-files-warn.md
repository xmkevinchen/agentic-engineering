---
id: work-drift-unexpected-files-warn
target: ae:work
layer: 2
source: generated
---

## Expected Behavior

### MUST
- [text:contains] Output contains `⚠️ Drift detected:`
- [text:contains] Output lists `Expected:`, `Actual:`, and `Unexpected:` sections
- [text:contains] Output presents 3 options: Fix (revert unexpected changes), Approve drift (explain why), Rollback
- [behavior] Gate pauses — does not auto-continue when drift is detected but not approved

### MUST_NOT
- [behavior] Auto-pass gate auto-continues with unapproved drift
- [behavior] Drift check silently passes when extra files exist outside expected list

### SHOULD
- [text:contains] Approve drift option notes that the reason will be recorded in the commit message
