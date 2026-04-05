---
id: work-check3-env-key-absent-refused
target: ae:work
layer: 1
source: generated
---

## Expected Behavior

### MUST
- [behavior] When `env` block is absent from settings.json, Check 3 triggers auto-fallback
- [behavior] When `env` block is present but `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS` is missing, Check 3 triggers auto-fallback
- [text:contains] Check 3 contains warning about Agent Teams unavailable

### MUST_NOT
- [behavior] MUST NOT silently treat absent `env` key as "enabled" and proceed to team spawn
- [behavior] MUST NOT hard-block execution (ae:work is auto-fallback tier)
