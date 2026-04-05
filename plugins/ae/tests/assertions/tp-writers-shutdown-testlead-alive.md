---
id: tp-writers-shutdown-testlead-alive
target: ae:test-plugin
layer: 1
source: generated
---

## Expected Behavior

### MUST
- [file:contains] SKILL.md Phase 1.3 shuts down only writers (prompts-writer, answer-writer) after suite approved
- [file:contains] SKILL.md Phase 1.3 explicitly keeps test-lead alive in the team
- [file:contains] SKILL.md Phase 1.3 says do NOT TeamDelete at this point

### MUST_NOT
- [file:contains] SKILL.md performs TeamDelete after Phase 1 (for the default Class A path)
