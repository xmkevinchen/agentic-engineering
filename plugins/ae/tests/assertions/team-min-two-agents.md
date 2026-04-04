---
id: team-min-two-agents
target: ae:team
layer: 1
source: generated
---

## Expected Behavior

### MUST
- [text:contains] SKILL.md Rules section states: `Minimum 2, maximum 5`
- [behavior] Even for a minimal task, at least 2 core agents are created

### MUST_NOT
- [behavior] MUST NOT create only 1 agent

### SHOULD
- [behavior] Explains which agents were selected and why
