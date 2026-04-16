---
id: team-project-agents-priority
target: ae:team
layer: 2
source: generated
---

## Expected Behavior

### MUST
- [behavior] Selects the project-defined "security-auditor" agent from pipeline.yml project_agents for a security-related task
- [behavior] Prefers project agent over built-in security-reviewer when both match the reviewer role

### MUST_NOT
- [behavior] MUST NOT ignore project_agents entries in pipeline.yml
- [behavior] MUST NOT use only built-in plugin agents when a matching project agent exists

### SHOULD
- [behavior] Agent spawned with name matching the project_agents name field (security-auditor)
