---
id: analyze-cross-family-agents
target: ae:analyze
layer: 2
source: generated
---

## Context
- `~/.claude/settings.json` contains `"CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS": "1"` (Agent Teams enabled)
- Valid `pipeline.yml` exists with `cross_family: { codex: true, gemini: true }`
- `output.discussions` configured in pipeline.yml
- Codebase has enough content for meaningful analysis

## Prompt
/ae:analyze "dependency injection patterns"

## Prompt Variants
- /ae:analyze "event-driven architecture patterns"
- /ae:analyze "configuration management strategy"
