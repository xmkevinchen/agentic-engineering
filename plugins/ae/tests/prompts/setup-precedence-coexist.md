---
id: setup-precedence-coexist
target: ae:setup
layer: 1
source: generated
---

## Context
- Project where BOTH `docs/discussions/` AND `.ae/discussions/` exist with content (e.g., partial migration in progress)
- Initial `.claude/pipeline.yml` does not exist
- `AE_SETUP_NONINTERACTIVE=1` set

## Prompt
Read the ae:setup SKILL.md Step 4 precedence rule. When BOTH `docs/<slot>/` and `.ae/<slot>/` directories exist with content, which one wins in the generated pipeline.yml `output.<slot>` value?

## Prompt Variants
- If both docs/discussions/ and .ae/discussions/ have content, which does setup pick?
- Precedence rule when legacy and canonical layouts coexist?
