---
id: work-draft-plan-refused
target: ae:work
layer: 1
source: generated
---

## Expected Behavior

### MUST
- Check 1 heading contains "Reviewed" (e.g. "Plan Exists & Reviewed")
- Check 1 reads plan frontmatter `status`
- Check 1 refuses execution when status is `draft`
- Check 1 refuses execution when status field is missing
- Refusal message suggests `/ae:plan-review`

### MUST_NOT
- Check 1 accepts `status: draft` plans for execution
- Argument Inference searches for `status: draft` plans
