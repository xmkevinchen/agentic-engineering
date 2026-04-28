---
id: plugin-stats-compare-same-id-error
target: ae:plugin-stats
layer: 1
source: generated
---

## Expected Behavior

### MUST
- [behavior] SKILL.md edge case: same ID provided twice → error output
- [text:contains] Output contains "比较失败：两个 ID 相同" or equivalent "same ID" error message
- [behavior] Execution stops — no comparison report written

### MUST_NOT
- [behavior] MUST NOT attempt to compare a report against itself
- [file:exists] MUST NOT write any comparison report file

### SHOULD
- [text:contains] Error tells user to specify different report IDs
