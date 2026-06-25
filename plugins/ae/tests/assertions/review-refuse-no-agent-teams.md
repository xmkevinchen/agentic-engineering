---
id: review-refuse-no-agent-teams
target: ae:review
layer: 1
source: generated
---

## Expected Behavior

### MUST
- [behavior] SKILL.md Check 1 hard-refuses when Agent Teams is not enabled
- [text:contains] SKILL.md states refuse message referencing CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS setting
- [text:contains] Error message tells user to add the env key to ~/.claude/settings.json and restart Claude Code

### MUST_NOT
- [behavior] MUST NOT proceed to any subsequent checks or execution when Agent Teams is disabled
- [behavior] MUST NOT spawn any teammate via the Agent tool
- [file:exists] MUST NOT write any review file to output.reviews

### SHOULD
- [text:contains] Error includes the exact JSON snippet to add to settings.json
