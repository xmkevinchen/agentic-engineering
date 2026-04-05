---
id: tp-class-ab-classifier
target: ae:test-plugin
layer: 1
source: generated
---

## Expected Behavior

### MUST
- [file:contains] SKILL.md classifier scans target SKILL.md for `TeamCreate` pattern
- [file:contains] SKILL.md classifier scans target SKILL.md for `Agent(` pattern
- [file:contains] SKILL.md defines Class A as skill that does NOT contain those patterns (uses subagent)
- [file:contains] SKILL.md defines Class B as skill that DOES contain those patterns (Session TL executes directly)
- [file:contains] SKILL.md specifies FAIL_CLOSED when target is unreadable or classification fails

### MUST_NOT
- [file:contains] SKILL.md allows execution to proceed without classification
