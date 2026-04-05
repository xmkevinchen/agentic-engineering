---
id: work-check3-env-key-absent-refused
target: ae:work
layer: 1
source: generated
---

## Expected Behavior

### MUST
- [behavior] When `env` block is absent from settings.json, Check 3 refuses execution
- [behavior] When `env` block is present but `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS` is missing from it, Check 3 refuses execution
- [text:contains] Refusal message includes instructions to enable the Agent Teams experiment
- [text:contains] Check 3 states: `If not enabled → **refuse to execute** with instructions to enable`

### MUST_NOT
- [behavior] MUST NOT silently treat absent `env` key as "enabled" and proceed
- [behavior] MUST NOT fall back to non-Agent-Teams execution mode when the flag is absent
