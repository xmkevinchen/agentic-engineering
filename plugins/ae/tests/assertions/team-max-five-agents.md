---
id: team-max-five-agents
target: ae:team
layer: 1
source: generated
---

## Expected Behavior

### MUST
- [behavior] For a complex multi-domain task, selects at most 5 core agents (excluding cross-family proxies)

### MUST_NOT
- [behavior] MUST NOT spawn more than 5 core agents

### SHOULD
- [behavior] Explains the prioritization logic for which agents were selected
