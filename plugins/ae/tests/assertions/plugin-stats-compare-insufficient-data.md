---
id: plugin-stats-compare-insufficient-data
target: ae:plugin-stats
layer: 1
source: generated
---

## Expected Behavior

### MUST
- [behavior] SKILL.md pre-check: when either ID not found → error output
- [text:contains] Output contains "ID not found" error message (e.g., "comparison failed: ID not found")
- [behavior] Execution stops — no comparison report written

### MUST_NOT
- [behavior] MUST NOT attempt partial comparison when one or both IDs are not found
- [file:exists] MUST NOT write any comparison report file in this error case

### SHOULD
- [text:contains] Error tells user to confirm which report IDs exist in the analyses directory
