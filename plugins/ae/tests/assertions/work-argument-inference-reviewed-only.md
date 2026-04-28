---
id: work-argument-inference-reviewed-only
target: ae:work
layer: 1
source: generated
---

## Expected Behavior

### MUST
- Argument Inference MUST scan BOTH `.ae/features/active/F-*/plan.md` (primary, Plan 051+) AND `output.plans/*.md` (legacy fallback) for the most recent plan with `status: reviewed` AND uncompleted steps (`- [ ]`)
- Both conditions MUST be satisfied: `status: reviewed` AND presence of `- [ ]` uncompleted steps
- Tiebreaker MUST work across the union of both locations (cross-location ordering by absolute date / id)

### MUST_NOT
- MUST NOT match plans with `status: draft` during Argument Inference
- MUST NOT match plans with `status: draft` even if they contain uncompleted steps (`- [ ]`)
- MUST NOT match plans with missing `status` frontmatter during Argument Inference
- MUST NOT scan only one location and ignore the other (Plan 051+ requires union scan)

### SHOULD
- SHOULD fall through to checking conversation context if no `status: reviewed` plan with uncompleted steps is found in EITHER location, rather than selecting a draft plan
