---
id: team-min-two-agents
target: ae:team
layer: 1
source: generated
---

## Context

- Agent Teams enabled in `~/.claude/settings.json`
- `.claude/pipeline.yml` exists with valid configuration
- Task is intentionally trivial to test minimum agent constraint

## Prompt

/ae:team "fix this one small typo in README"

## Prompt Variants

- /ae:team "check if the license file is up to date"
- /ae:team "verify the version number in package.json"
