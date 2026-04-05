---
id: analyze-output-file-written
target: ae:analyze
layer: 2
source: generated
---

## Context
- `~/.claude/settings.json` contains `"CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS": "1"` (Agent Teams enabled)
- Valid `pipeline.yml` exists with `output.discussions: .ae/discussions`
- `cross_family` enabled or disabled (not material to this test)
- Codebase has enough content for meaningful analysis

## Prompt
/ae:analyze "logging strategy"

## Prompt Variants
- /ae:analyze "caching layer design"
- /ae:analyze "input validation approach"
