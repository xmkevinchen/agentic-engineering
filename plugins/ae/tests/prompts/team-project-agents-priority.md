---
id: team-project-agents-priority
target: ae:team
layer: 2
source: generated
---

## Context

- Agent Teams enabled in `~/.claude/settings.json`
- `.claude/pipeline.yml` exists with custom agent definition:
  ```yaml
  agents:
    - name: security-reviewer
      description: "Domain expert for security reviews"
  ```
- Task is security-related, matching the custom agent's domain

## Prompt

/ae:team "security review of the new OAuth integration"

## Prompt Variants

- /ae:team "audit authentication flows for vulnerabilities"
- /ae:team "review the new RBAC implementation for security issues"
