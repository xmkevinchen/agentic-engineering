---
id: tp-orphan-team-cleanup
target: ae:test-plugin
layer: 2
source: generated
---

## Expected Behavior

### MUST
- [behavior] After Class B execution, Session TL checks `~/.claude/teams/` for orphan teams created by the target skill
- [behavior] Defensive cleanup step occurs even if target skill execution failed or threw an error

### MUST_NOT
- [behavior] Session TL skips orphan cleanup when target skill crashes or returns early

### SHOULD
- [behavior] If orphan teams are found, they are cleaned up (TeamDelete or equivalent)
- [text:contains] Report or output notes orphan cleanup activity if teams were found
