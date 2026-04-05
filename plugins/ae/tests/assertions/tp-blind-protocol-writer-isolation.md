---
id: tp-blind-protocol-writer-isolation
target: ae:test-plugin
layer: 1
source: generated
---

## Expected Behavior

### MUST
- [file:contains] SKILL.md prompts-writer instructions say "Do NOT message team-lead"
- [file:contains] SKILL.md answer-writer instructions say "Do NOT message team-lead"
- [file:contains] SKILL.md specifies writers send drafts to test-lead (not Session TL)
- [file:contains] SKILL.md specifies test-lead is the only agent to SendMessage approved suite to team-lead

### MUST_NOT
- [file:contains] SKILL.md allows answer-writer to read prompts-writer's output (must write independently)
