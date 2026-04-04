---
id: work-agent-teams-disabled-refused
target: ae:work
layer: 1
source: generated
---

## Context
- SKILL.md for ae:work is readable
- Check 3 verifies Agent Teams env var in settings.json
- `~/.claude/settings.json` does NOT have `env.CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS` set

## Prompt
(static analysis — no execution required)

## Prompt Variants
- Variant: key exists but set to `false`
- Variant: `env` key is absent entirely
