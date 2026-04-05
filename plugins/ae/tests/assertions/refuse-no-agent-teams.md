---
id: refuse-no-agent-teams
target: ae:plan
layer: 1
source: manual
---

## Expected Behavior

### MUST
- [text:contains] SKILL.md pre-check mentions auto-fallback when Agent Teams not enabled
- [behavior] When Agent Teams disabled, skill proceeds in solo mode (TL writes plan directly)
- [text:contains] Plan stays status: draft in fallback mode

### MUST_NOT
- [behavior] MUST NOT call TeamCreate when Agent Teams disabled
- [behavior] MUST NOT produce a reviewed plan in fallback mode (status must stay draft)

### SHOULD
- [text:contains] Fallback output includes guidance to run /ae:plan-review or enable Agent Teams
