---
id: work-argument-inference-reviewed-only
target: ae:work
layer: 1
source: generated
---

## Expected Behavior

### MUST
- Argument Inference step 1 MUST check `output.plans` for the most recent plan with `status: reviewed` AND uncompleted steps (`- [ ]`)
- Both conditions MUST be satisfied: `status: reviewed` AND presence of `- [ ]` uncompleted steps

### MUST_NOT
- MUST NOT match plans with `status: draft` during Argument Inference step 1
- MUST NOT match plans with `status: draft` even if they contain uncompleted steps (`- [ ]`)
- MUST NOT match plans with missing `status` frontmatter during Argument Inference

### SHOULD
- SHOULD fall through to step 3 (check conversation context) if no `status: reviewed` plan with uncompleted steps is found, rather than selecting a draft plan
