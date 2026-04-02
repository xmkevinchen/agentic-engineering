---
id: refuse-no-agent-teams
target: ae:plan
layer: 1
source: manual
---

## Context
- `~/.claude/settings.json` does NOT contain `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS` or it is set to `false`
- `.claude/pipeline.yml` exists with valid config

## Prompt
/ae:plan implement a new login feature

## Prompt Variants
- /ae:plan add user authentication
- /ae:plan --skip-review create API endpoint

## Expected Behavior

### MUST
- Output contains refusal message (refuses to execute)
- Output mentions "Agent Teams" as the reason
- Output contains instructions to enable (JSON snippet or settings path)

### MUST_NOT
- No TeamCreate tool call
- No Agent tool call
- No plan file created in output.plans directory

### SHOULD
- Refusal message is actionable (user knows exactly what to do)
