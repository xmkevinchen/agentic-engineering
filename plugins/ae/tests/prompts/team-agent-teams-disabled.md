---
id: team-agent-teams-disabled
target: ae:team
layer: 1
source: generated
---

## Context

- `~/.claude/settings.json` does NOT have `env.CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS` set
- Pre-check step 3 in ae:team SKILL.md verifies Agent Teams env var

## Prompt

/ae:team "analyze codebase architecture"

## Prompt Variants

- Variant: key exists but set to `false`
- Variant: `env` key is absent entirely
- Variant: `settings.json` exists but is empty object `{}`
