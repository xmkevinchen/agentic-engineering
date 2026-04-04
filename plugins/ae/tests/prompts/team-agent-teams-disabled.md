---
id: team-agent-teams-disabled
target: ae:team
layer: 1
source: generated
---

## Context

- `~/.claude/settings.json` does NOT have `experiments.CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS: true`
- Pre-check step 3 in ae:team SKILL.md verifies Agent Teams experiment flag

## Prompt

/ae:team "analyze codebase architecture"

## Prompt Variants

- Variant: key exists but set to `false`
- Variant: `experiments` key is absent entirely
- Variant: `settings.json` exists but is empty object `{}`
