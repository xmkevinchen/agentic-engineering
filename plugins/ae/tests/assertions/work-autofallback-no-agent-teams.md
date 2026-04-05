---
id: work-autofallback-no-agent-teams
target: ae:work
layer: 2
source: generated
---

## Expected Behavior

### MUST
- [text:contains] Output contains "[WARNING] Agent Teams unavailable" or equivalent fallback warning
- [behavior] Skill proceeds to execute the step (does NOT refuse)
- [behavior] TL executes TDD cycle directly (no team spawn)

### MUST_NOT
- [behavior] MUST NOT output "refuse to execute" or block execution entirely
- [behavior] MUST NOT call TeamCreate
- [behavior] MUST NOT call Agent with team_name parameter

### SHOULD
- [text:contains] Warning mentions "running solo" or equivalent
- [behavior] Step completes and plan checkbox gets updated
