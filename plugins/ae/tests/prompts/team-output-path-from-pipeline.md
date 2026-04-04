---
id: team-output-path-from-pipeline
target: ae:team
layer: 2
source: generated
---

## Context

- Agent Teams enabled in `~/.claude/settings.json`
- `.claude/pipeline.yml` exists with custom output path:
  ```yaml
  output:
    analyses: "docs/custom-analyses/"
  ```
- Default path would be `docs/analyses/`

## Prompt

/ae:team "analyze API design patterns"

## Prompt Variants

- /ae:team "analyze the caching layer architecture"
- /ae:team "investigate logging and observability gaps"
