---
id: team-maps-to-existing-skill
target: ae:team
layer: 1
source: generated
---

## Expected Behavior

### MUST
- [behavior] Recognizes that the task clearly maps to ae:think
- [text:contains] Suggests using `/ae:think` as an alternative

### MUST_NOT
- [behavior] MUST NOT silently create a team without mentioning the better-fit skill

### SHOULD_NOT
- [behavior] SHOULD NOT directly create a team for the task without offering the alternative first
