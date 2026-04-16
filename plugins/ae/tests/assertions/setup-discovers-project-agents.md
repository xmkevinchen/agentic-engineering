---
id: setup-discovers-project-agents
target: ae:setup
layer: 1
source: manual
---

## Expected Behavior

### MUST
- [file:contains:plugins/ae/skills/setup/SKILL.md] Initialize mode scans `.claude/agents/*.md` for project agents
- [file:contains:plugins/ae/skills/setup/SKILL.md] Shows discovered agents with inferred roles to user
- [file:contains:plugins/ae/skills/setup/SKILL.md] Does NOT write agent lists to pipeline.yml — discovery is runtime

### MUST_NOT
- [file:contains:plugins/ae/skills/setup/SKILL.md] MUST NOT auto-populate project_agents section in pipeline.yml during initialization
