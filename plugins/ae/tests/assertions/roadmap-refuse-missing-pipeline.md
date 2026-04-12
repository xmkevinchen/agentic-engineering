---
id: roadmap-refuse-missing-pipeline
target: ae:roadmap
layer: 1
source: generated
---

## Expected Behavior

### MUST
- [text:contains] Pre-check step confirms `.claude/pipeline.yml` exists
- [text:contains] Missing pipeline.yml produces output containing "No pipeline.yml found"
- [behavior] Execution stops when pipeline.yml is missing (no clustering, no output)

### MUST_NOT
- [behavior] No clustering algorithm runs when pipeline.yml is absent
- [behavior] No discussion/plan/backlog scanning when pipeline.yml is missing

### SHOULD
- [text:contains] Error message suggests `/ae:setup` to configure the project
