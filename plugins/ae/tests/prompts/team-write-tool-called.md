---
id: team-write-tool-called
target: ae:team
layer: 1
source: generated
---

## Context

- Agent Teams enabled in `~/.claude/settings.json`
- `.claude/pipeline.yml` exists with valid configuration
- Team execution completes and produces analysis results
- Persist section in SKILL.md mandates: "You MUST call the Write tool to save the output file."

## Prompt

/ae:team "analyze database schema design"

## Prompt Variants

- /ae:team "analyze the middleware architecture"
- /ae:team "review the event-driven communication patterns"
