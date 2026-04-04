---
id: team-cross-family-proxy-spawn
target: ae:team
layer: 2
source: generated
---

## Context

- Agent Teams enabled in `~/.claude/settings.json`
- `.claude/pipeline.yml` exists with `cross_family.enabled: true`
- Codex MCP server available (`mcp__plugin_ae_codex__codex`)
- Gemini MCP server available (`mcp__plugin_ae_gemini__chat`)

## Prompt

/ae:team "compare two architectural approaches for the payment system"

## Prompt Variants

- /ae:team "evaluate pros and cons of event sourcing vs CRUD for order management"
- /ae:team "analyze whether to migrate from REST to GraphQL for the mobile API"
