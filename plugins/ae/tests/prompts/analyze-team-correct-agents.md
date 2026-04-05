---
id: analyze-team-correct-agents
target: ae:analyze
layer: 2
source: generated
---

## Context
- `~/.claude/settings.json` contains `"CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS": "1"` (Agent Teams enabled)
- Valid `pipeline.yml` exists with `output.discussions` configured
- `cross_family` section in pipeline.yml has codex and gemini both set to `false` or omitted entirely
- Codebase has enough content for meaningful analysis

## Prompt
/ae:analyze "error handling patterns"

## Prompt Variants
- /ae:analyze "module dependency structure"
- /ae:analyze "retry and backoff strategies"
