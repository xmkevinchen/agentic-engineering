---
id: team-maps-to-existing-skill
target: ae:team
layer: 1
source: generated
---

## Context

- Agent Teams enabled in `~/.claude/settings.json`
- `.claude/pipeline.yml` exists with valid configuration
- Task description clearly maps to an existing skill (`ae:think` for deep reasoning)

## Prompt

/ae:team "think deeply about whether we should use microservices or monolith"

## Prompt Variants

- /ae:team "generate tests for the auth module" (maps to ae:testgen)
- /ae:team "trace the request flow from API gateway to database" (maps to ae:trace)
