---
id: all-sendmessage-to-tl
target: ae:consensus, ae:review, ae:analyze, ae:plan, ae:plan-review, ae:think, ae:trace, ae:testgen, ae:team
layer: 1
source: generated
---

## Expected Behavior

### MUST
- Every Agent() prompt routes final findings to "Lead (TL)"

### MUST_NOT
- No agent sends findings ONLY to another agent (bypassing TL)

### SHOULD
- Consistent use of "Lead (TL)" label across all skills
