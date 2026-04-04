---
id: team-project-agents-priority
target: ae:team
layer: 2
source: generated
---

## Expected Behavior

### MUST
- [behavior] Selects the project-defined "security-reviewer" agent from pipeline.yml for a security-related task

### MUST_NOT
- [behavior] MUST NOT ignore project-defined agents and only use built-in plugin agents

### SHOULD
- [behavior] Agent subagent_type matches the type defined in pipeline.yml for project-specific agents
