---
id: agent-selection-project-discovery
target: ae:agent-selection
layer: 1
source: manual
---

## Context

- agent-selection SKILL.md Rule 4 defines project agent discovery
- Project has `.claude/agents/security-auditor.md` with `description: "Reviews code for security vulnerabilities"`
- pipeline.yml has no `project_agents` section

## Prompt

A skill needs to select agents for a security review task. How does agent-selection Rule 4 discover and prefer the project agent?
