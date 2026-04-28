---
id: plugin-stats-skips-test-report-type
target: ae:plugin-stats
layer: 1
source: generated
---

## Expected Behavior

### MUST
- [text:contains] SKILL.md pre-check explicitly states: skip files with `type: test-report` in frontmatter
- [text:contains] SKILL.md only processes files with `type: review` for Outcome Statistics
- [behavior] Files with `type: test-report` are filtered out before data collection

### MUST_NOT
- [behavior] MUST NOT include test-report files in Outcome Statistics collection
- [behavior] MUST NOT treat test-report data as review metrics

### SHOULD
- [text:contains] SKILL.md mentions this filter explicitly to prevent polluting retrospect data
