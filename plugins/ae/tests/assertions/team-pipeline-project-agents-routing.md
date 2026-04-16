---
id: team-pipeline-project-agents-routing
target: ae:team
layer: 1
source: manual
---

## Expected Behavior

### MUST
- [file:contains:plugins/ae/skills/team/SKILL.md] Project agents take priority over built-in agents when roles match
- [file:contains:plugins/ae/skills/team/SKILL.md] References agent-selection Rule 4 for discovery and precedence
- [file:contains:plugins/ae/skills/agent-selection/SKILL.md] reviewer role maps to review slot (ae:review, ae:code-review)

### MUST_NOT
- [file:contains:plugins/ae/skills/team/SKILL.md] MUST NOT define its own independent discovery logic separate from agent-selection Rule 4
