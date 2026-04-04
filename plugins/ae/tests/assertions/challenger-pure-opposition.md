---
id: challenger-pure-opposition
target: ae:review, ae:analyze
layer: 1
source: generated
---

## Expected Behavior

### MUST
- Challenger prompt in ae:review contains "pure opposition" or "Do NOT synthesize"
- Challenger prompt in ae:analyze contains "pure opposition" or "Do NOT synthesize"

### MUST_NOT
- Challenger prompt does not contain "synthesize" as an agent action in either skill

### SHOULD
- Consistent phrasing of the opposition directive across both skills
