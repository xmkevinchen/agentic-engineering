---
id: tp-refuse-no-agent-teams
target: ae:test-plugin
layer: 1
source: generated
---

## Expected Behavior

### MUST
- [text:contains] Output contains "Agent Teams is required"
- [text:contains] Output references `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS`
- [behavior] Skill exits before any test generation or execution activity

### MUST_NOT
- [behavior] No TeamCreate call issued
- [behavior] No Phase 1 test generation begins
- [behavior] No test files written to plugins/ae/tests/

### SHOULD
- [text:contains] Output includes instruction to add the env key to ~/.claude/settings.json
