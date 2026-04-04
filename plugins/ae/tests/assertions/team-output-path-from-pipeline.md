---
id: team-output-path-from-pipeline
target: ae:team
layer: 2
source: generated
---

## Expected Behavior

### MUST
- [behavior] Reads output.analyses path from pipeline.yml to determine write destination
- [file:exists] Output file is written under the pipeline.yml-specified custom path (e.g., "docs/custom-analyses/")

### MUST_NOT
- [behavior] MUST NOT hardcode "docs/analyses/" as the output path when pipeline.yml specifies a different directory
