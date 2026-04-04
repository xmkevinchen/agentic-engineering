---
id: refuse-no-agent-teams
target: ae:plan
layer: 1
source: manual
---

## Expected Behavior

### MUST
- Output contains refusal message (refuses to execute)
- Output mentions "Agent Teams" as the reason
- Output contains instructions to enable (JSON snippet or settings path)

### MUST_NOT
- No TeamCreate tool call
- No Agent tool call
- No plan file created in output.plans directory

### SHOULD
- Refusal message is actionable (user knows exactly what to do)
