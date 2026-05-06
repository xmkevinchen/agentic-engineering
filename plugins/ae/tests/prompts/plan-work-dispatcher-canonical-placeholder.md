---
id: plan-work-dispatcher-canonical-placeholder
target: ae:plan,ae:work
layer: 1
source: manual
---

## Context

- F-004 (BL-055) wired the two-tier dispatcher into /ae:plan + /ae:work team-spawn templates
- Canonical placeholder for dispatcher-resolved `subagent_type:` is `<per agent-selection>` per ae:agent-selection SKILL.md
- Structurally fixed roles (qa as dev-counterpart) hardcode by name with an inline annotation comment
- Trace-emission gate text "Before TeamCreate" must be present per BL-058 wiring

## Prompt

How do /ae:plan and /ae:work invoke the two-tier dispatcher in their team-spawn templates? What `subagent_type:` placeholder do they use? Are any structurally fixed roles preserved as hardcoded?
