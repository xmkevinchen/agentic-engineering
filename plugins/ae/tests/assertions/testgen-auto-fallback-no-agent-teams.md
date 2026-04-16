---
id: testgen-auto-fallback-no-agent-teams
target: ae:testgen
layer: 1
source: generated
---

## Expected Behavior

### MUST
- [behavior] SKILL.md pre-check auto-fallback: when Agent Teams disabled, proceed solo (not refuse)
- [text:contains] SKILL.md prints warning like "[WARNING] Agent Teams unavailable, running solo. Cross-family and parallel review disabled."
- [behavior] TL executes test generation directly without spawning team

### MUST_NOT
- [behavior] MUST NOT hard-refuse or block execution when Agent Teams is disabled
- [behavior] MUST NOT call TeamCreate
- [behavior] MUST NOT call Agent with team_name parameter

### SHOULD
- [text:contains] Warning mentions "running solo" or equivalent phrase
- [behavior] Skill still generates tests despite fallback mode
