---
id: plugin-stats-refuse-no-review-data
target: ae:plugin-stats
layer: 1
source: generated
---

## Expected Behavior

### MUST
- [behavior] SKILL.md pre-check stops with insufficient data message when no review files found
- [text:contains] Output contains "insufficient data" message
- [text:contains] Message tells user to complete at least one /ae:review first

### MUST_NOT
- [behavior] MUST NOT generate a retrospect report when no Outcome Statistics data exists
- [behavior] MUST NOT proceed to Step 1 collection when no data is available

### SHOULD
- [text:contains] Output references "Outcome Statistics" as the required data source
