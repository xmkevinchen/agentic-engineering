---
id: team-agent-selection-reference-used
target: ae:team
layer: 1
source: generated
---

## Context

- Agent Teams enabled in `~/.claude/settings.json`
- `.claude/pipeline.yml` exists with valid configuration
- ae:team SKILL.md Step 1 references the Agent Selection Reference skill for team composition

## Prompt

/ae:team "investigate why tests are flaky in CI"

## Prompt Variants

- /ae:team "debug intermittent connection timeouts in staging"
- /ae:team "analyze why build times have regressed"
