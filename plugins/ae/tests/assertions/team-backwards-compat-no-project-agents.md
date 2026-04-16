---
id: team-backwards-compat-no-project-agents
target: ae:team
layer: 1
source: manual
---

## Expected Behavior

### MUST
- [file:contains:plugins/ae/skills/agent-selection/SKILL.md] Rule 4 reads `project_agents` from pipeline.yml with graceful handling if absent
- [file:contains:plugins/ae/skills/team/SKILL.md] ae:team functions correctly using built-in agents when no project agents exist

### MUST_NOT
- [file:contains:plugins/ae/skills/agent-selection/SKILL.md] MUST NOT error or refuse when pipeline.yml lacks project_agents section
- [file:contains:plugins/ae/skills/team/SKILL.md] MUST NOT require project_agents section to be present
