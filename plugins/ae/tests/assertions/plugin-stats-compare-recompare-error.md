---
id: plugin-stats-compare-recompare-error
target: ae:plugin-stats
layer: 1
source: generated
---

## Expected Behavior

### MUST
- [behavior] SKILL.md pre-check: when either ID matches a `type: retrospect-comparison` file → error output
- [text:contains] Output contains "比较失败：不支持对比较报告再次比较" or equivalent "cannot compare a comparison report" message
- [behavior] Execution stops — no further comparison attempted

### MUST_NOT
- [behavior] MUST NOT proceed with comparison when one of the IDs is a retrospect-comparison type
- [file:exists] MUST NOT write any comparison report file in this error case

### SHOULD
- [text:contains] Error tells user to specify reports with `type: retrospect`, not `type: retrospect-comparison`
