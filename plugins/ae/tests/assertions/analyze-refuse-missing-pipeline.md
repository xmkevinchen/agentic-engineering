---
id: analyze-refuse-missing-pipeline
target: ae:analyze
layer: 1
source: generated
---

## Expected Behavior

### MUST
- [text:contains] Output contains a clear error about pipeline.yml being missing or unreadable
- [behavior] Execution stops before spawning teammates (no Agent tool call)

### MUST_NOT
- [behavior] No Agent tool call (no teammates spawned)
- [file:exists] No analysis.md written to any output directory

### SHOULD
- [text:contains] Error message is actionable (tells user how to create pipeline.yml or run /ae:setup)
