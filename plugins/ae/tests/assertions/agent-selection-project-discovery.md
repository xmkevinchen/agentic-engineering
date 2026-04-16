---
id: agent-selection-project-discovery
target: ae:agent-selection
layer: 1
source: manual
---

## Expected Behavior

### MUST
- [file:contains:plugins/ae/skills/agent-selection/SKILL.md] Rule 4 includes scanning `.claude/agents/*.md` for project agents
- [file:contains:plugins/ae/skills/agent-selection/SKILL.md] Rule 4 includes reading `project_agents` from pipeline.yml
- [file:contains:plugins/ae/skills/agent-selection/SKILL.md] Rule 4 specifies project agent preferred over built-in when role matches

### MUST_NOT
- [file:contains:plugins/ae/skills/agent-selection/SKILL.md] MUST NOT describe Rule 4 as only a text guideline without concrete discovery steps
