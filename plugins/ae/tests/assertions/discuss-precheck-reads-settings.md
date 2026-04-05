---
id: discuss-precheck-reads-settings
target: ae:discuss
layer: 1
source: generated
---

## Expected Behavior

### MUST
- [text:contains] Output contains refusal message refusing to execute
- [text:contains] Output mentions "Agent Teams" as the reason
- [text:contains] Output contains exact config path `env.CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS`
- [text:contains] Output includes JSON snippet `{ "env": { "CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS": "1" } }` for `~/.claude/settings.json`
- [text:contains] Output instructs user to restart Claude Code after making the change

### MUST_NOT
- [behavior] No TeamCreate tool call
- [behavior] No Agent tool call
- [behavior] No discussion directory or files created

### SHOULD
- [text:contains] Refusal message is actionable (user knows exactly what to do)
