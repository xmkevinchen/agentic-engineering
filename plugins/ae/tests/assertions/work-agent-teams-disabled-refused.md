---
id: work-agent-teams-disabled-refused
target: ae:work
layer: 1
source: generated
---

## Expected Behavior

### MUST
- [text:contains] SKILL.md Check 3 states: `Read ~/.claude/settings.json → check env.CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS is set`
- [text:contains] SKILL.md Check 3 states: `If not enabled → **refuse to execute** with instructions to enable`
- [behavior] When Agent Teams experiment flag is not enabled, the skill refuses to execute and provides enablement instructions

### MUST_NOT
- [behavior] MUST NOT proceed to Check 4 (Deferred Items) or any execution when Agent Teams is disabled
- [behavior] MUST NOT silently fall back to non-Agent-Teams execution mode instead of refusing
