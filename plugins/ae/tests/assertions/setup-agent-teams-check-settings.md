---
id: setup-agent-teams-check-settings
target: ae:setup
layer: 1
source: generated
---

## Expected Behavior

### MUST
- [text:contains] SKILL.md checks ~/.claude/settings.json for CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS in the env object
- [behavior] SKILL.md uses AskUserQuestion when Agent Teams is not enabled to prompt user
- [text:contains] SKILL.md offers to enable Agent Teams by updating ~/.claude/settings.json
- [text:contains] If user declines, SKILL.md warns about which ae commands will refuse to execute

### MUST_NOT
- [behavior] MUST NOT silently skip the Agent Teams check
- [behavior] MUST NOT auto-enable Agent Teams without user confirmation

### SHOULD
- [text:contains] If already enabled, SKILL.md outputs "✅ Agent Teams: enabled" confirmation
