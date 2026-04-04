---
id: consensus-no-mediator-agent
target: ae:consensus
layer: 1
source: generated
---

## Expected Behavior

### MUST
- TL performs mediator evaluation in Step 3 (not delegated to an agent)
- Comment `# No mediator agent` is present in SKILL.md

### MUST_NOT
- No Agent() call with name "mediator"
- No "you are the mediator" in any agent prompt
