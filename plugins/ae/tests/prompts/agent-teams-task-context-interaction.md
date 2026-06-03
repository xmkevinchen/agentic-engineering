---
id: agent-teams-task-context-interaction
target: ae:agent-teams
layer: 1
source: regression
---

## Context

F-039 documented the Team=TaskList 1:1 context-switch behavior (tasks created before TeamCreate return "Task not found" while a team is active) in the canonical `## Skill step progress tracking` section, with two rules: don't retry mid-team (reconcile after TeamDelete) and batch-create AFTER TeamCreate for single-team skills.

## Prompt

Static analysis of `plugins/ae/skills/agent-teams/SKILL.md`: verify the §H subsection exists with both rules + precedence line, the §C.1 reconciliation nuance is present, and the pre-existing A-G subsections survive.
