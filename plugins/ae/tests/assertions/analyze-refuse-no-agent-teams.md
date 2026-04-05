---
id: analyze-refuse-no-agent-teams
target: ae:analyze
layer: 1
source: generated
---

## Expected Behavior

### MUST
- [text:contains] Output contains refusal message refusing to execute
- [text:contains] Output mentions "Agent Teams" as the reason
- [text:contains] Output contains enablement instructions (JSON snippet with `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS`)

### MUST_NOT
- [behavior] No TeamCreate tool call
- [behavior] No Agent tool call
- [file:exists] No analysis.md created in output.discussions directory

### SHOULD
- [text:contains] Refusal message includes settings path (`~/.claude/settings.json`)
