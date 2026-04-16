---
id: team-backwards-compat-no-project-agents
target: ae:team
layer: 1
source: manual
---

## Context

- pipeline.yml exists but has NO `project_agents` section (pre-v0.8.0 format)
- No `.claude/agents/` directory exists

## Prompt

ae:team is invoked on a project with a pre-v0.8.0 pipeline.yml that has no project_agents section. Does it still work?
