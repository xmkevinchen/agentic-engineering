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
- [file:contains:plugins/ae/skills/agent-selection/SKILL.md] The 'Project-agent precedence' section specifies project/user/builtin/library agents form a SINGLE POOL where source is metadata NOT priority — `project_agents` reach a slot only via `required:true` / priority hint / role-fit, never by source-preference; "preferred over built-ins" is explicitly called an incorrect framing (BL-005 Phase 1)

### MUST_NOT
- [file:contains:plugins/ae/skills/agent-selection/SKILL.md] MUST NOT describe Rule 4 as only a text guideline without concrete discovery steps
