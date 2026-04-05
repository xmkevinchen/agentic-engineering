---
id: team-agent-teams-disabled
target: ae:team
layer: 1
source: generated
---

## Expected Behavior

### MUST
- [text:contains] SKILL.md pre-check mentions auto-fallback when Agent Teams not enabled
- [behavior] Informs user that Agent Teams is not enabled (warning)
- [behavior] Falls back to TL executing task directly

### MUST_NOT
- [behavior] MUST NOT call TeamCreate tool when Agent Teams disabled
- [behavior] MUST NOT spawn team agents when in fallback mode
