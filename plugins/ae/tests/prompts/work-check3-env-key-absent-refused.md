---
id: work-check3-env-key-absent-refused
target: ae:work
layer: 1
source: generated
---

## Context
- SKILL.md for ae:work is readable
- Check 3 verifies the Agent Teams flag at `env.CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS` in settings.json
- This case tests behavior when the `env` key itself is absent from settings.json
- Distinct from `work-agent-teams-disabled-refused` which covers "key not set"

## Prompt
(static analysis — no execution required)

## Prompt Variants
- Variant A: `env` key missing from settings.json entirely — Check 3 should refuse
- Variant B: `env` key present but `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS` missing from it — Check 3 should refuse
