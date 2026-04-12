---
id: review-deferred-findings-blocks-unresolved
target: ae:review
layer: 1
source: generated
---

## Expected Behavior

### MUST
- [behavior] SKILL.md Check 4 detects UNRESOLVED deferred findings (no Disposition: line) and blocks the review verdict
- [text:contains] Output lists UNRESOLVED deferred items with descriptions
- [text:contains] SKILL.md presents 3 options: Fix now, Waive, Move to backlog

### MUST_NOT
- [behavior] MUST NOT write a review file with a verdict while UNRESOLVED entries exist
- [behavior] MUST NOT silently skip deferred findings audit

### SHOULD
- [text:contains] Output references "DEFERRED" classification and "UNRESOLVED" state
- [text:contains] Output distinguishes FIXED, WAIVED, and UNRESOLVED disposition states
