---
id: trace-mode-determination-flow-deps
target: ae:trace
layer: 1
source: generated
---

## Context
- `.claude/pipeline.yml` exists in the project
- `~/.claude/settings.json` contains `"CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS": "1"` (Agent Teams enabled)
- The target is ambiguous — it could be traced by execution flow or dependency mapping

## Prompt
Read the ae:trace SKILL.md and describe how the skill determines whether to run in "flow" or "deps" mode.

## Prompt Variants
- How does ae:trace choose between flow and deps mode?
