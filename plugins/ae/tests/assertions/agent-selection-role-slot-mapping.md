---
id: agent-selection-role-slot-mapping
target: ae:agent-selection
layer: 1
source: manual
---

## Expected Behavior

### MUST
- [file:contains:plugins/ae/skills/agent-selection/SKILL.md] reviewer role maps to review slot (ae:review, ae:code-review)
- [file:contains:plugins/ae/skills/agent-selection/SKILL.md] developer role maps to work slot (ae:work)
- [file:contains:plugins/ae/skills/agent-selection/SKILL.md] domain-expert role maps to analysis slot (ae:analyze, ae:discuss, ae:team)

### MUST_NOT
- [file:contains:plugins/ae/skills/agent-selection/SKILL.md] MUST NOT leave role-to-slot mapping undefined or vague
