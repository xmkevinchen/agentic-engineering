---
id: team-agent-selection-reference-used
target: ae:team
layer: 1
source: generated
---

## Expected Behavior

### MUST
- [text:contains] SKILL.md Step 1 states: `Refer to the **Agent Selection Reference** skill`
- [behavior] Selected agents are relevant to the task domain (e.g., investigation/CI/testing agents for a CI debugging task)

### MUST_NOT
- [behavior] MUST NOT select agents randomly or without regard to task context
