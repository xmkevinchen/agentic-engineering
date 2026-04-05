---
id: tp-phase1-team-spawn-protocol
target: ae:test-plugin
layer: 1
source: generated
---

## Expected Behavior

### MUST
- [file:contains] SKILL.md Phase 1 specifies TeamCreate to create test team named "test-<target>"
- [file:contains] SKILL.md Phase 1 spawns a test-lead agent with `subagent_type: "test-lead"`
- [file:contains] SKILL.md Phase 1 spawns a prompts-writer agent
- [file:contains] SKILL.md Phase 1 spawns an answer-writer agent
- [file:contains] SKILL.md specifies all 3 agents run with `run_in_background: true`

### MUST_NOT
- [file:contains] SKILL.md allows prompts-writer or answer-writer to communicate directly to team-lead (Session TL)
