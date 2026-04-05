---
id: work-check3-reads-env-not-experiments
target: ae:work
layer: 1
source: generated
---

## Context
- SKILL.md for ae:work is readable
- Check 3 verifies the Agent Teams flag in settings.json
- The correct field path is `env.CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS` (nested under the `env` key)
- It must NOT read from `experiments`, a top-level flag, or any other path

## Prompt
(static analysis — no execution required)

## Prompt Variants
- Variant: confirm Check 3 references `env.CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS`, not `experiments`
- Variant: confirm no top-level `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS` path is used (must be under `env`)
