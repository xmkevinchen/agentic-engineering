---
id: team-project-agents-priority
target: ae:team
layer: 2
source: generated
---

## Context

- Agent Teams enabled in `~/.claude/settings.json`
- `.claude/pipeline.yml` exists with project agent declaration:
  ```yaml
  project_agents:
    - name: security-auditor
      role: reviewer
      path: .claude/agents/security-auditor.md
  ```
- `.claude/agents/security-auditor.md` exists with `description: "Reviews code for security vulnerabilities"`
- Task is security-related, matching the project agent's domain

## Prompt

/ae:team "security review of the new OAuth integration"

## Prompt Variants

- /ae:team "audit authentication flows for vulnerabilities"
- /ae:team "review the new RBAC implementation for security issues"
