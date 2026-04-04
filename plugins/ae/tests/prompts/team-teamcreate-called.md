---
id: team-teamcreate-called
target: ae:team
layer: 2
source: generated
---

## Context

- Agent Teams enabled in `~/.claude/settings.json`
- `.claude/pipeline.yml` exists with valid configuration
- Task is a legitimate ad-hoc team task (not mapping to an existing skill)

## Prompt

/ae:team "analyze performance bottlenecks in the API layer"

## Prompt Variants

- /ae:team "investigate memory leak patterns in the worker service"
- /ae:team "evaluate our error handling strategy across all modules"
