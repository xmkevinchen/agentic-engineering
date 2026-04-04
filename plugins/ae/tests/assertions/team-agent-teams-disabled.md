---
id: team-agent-teams-disabled
target: ae:team
layer: 1
source: generated
---

## Expected Behavior

### MUST
- [text:contains] Output includes path to `~/.claude/settings.json` and `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS` enablement instructions
- [behavior] Informs user that Agent Teams is not enabled

### MUST_NOT
- [behavior] MUST NOT call TeamCreate tool
- [behavior] MUST NOT spawn any Agent
- [behavior] MUST NOT proceed with task execution as if Agent Teams were enabled
