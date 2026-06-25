---
id: agent-teams-task-context-interaction
target: ae:agent-teams
layer: 1
source: regression
---

## Context

The canonical `## Skill step progress tracking` section §H documents how step tasks interact with teams. Under the implicit-team model (one team per session, no create/delete API, no task-list switching), there is a single task list for the whole run, so step tasks batch-created at skill start stay accessible throughout.

## Prompt

Static analysis of `plugins/ae/skills/agent-teams/SKILL.md`: verify the §H subsection exists with the batch-create-at-skill-start rule + precedence line, the §C.1 timing note is present, and the pre-existing A-G subsections survive.
