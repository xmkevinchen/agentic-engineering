---
id: work-agent-teams-disabled-refused
target: ae:work
layer: 1
source: generated
---

## Expected Behavior

### MUST
- [text:contains] SKILL.md Check 3 states: `Read ~/.claude/settings.json → check env.CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS is set`
- [text:contains] SKILL.md Check 3 contains auto-fallback behavior when not enabled
- [behavior] When Agent Teams disabled, skill falls back to Lead executing TDD cycle directly

### MUST_NOT
- [behavior] MUST NOT silently ignore the Agent Teams check
- [behavior] MUST NOT proceed to parallel Agent Teams execution when flag is absent
