---
id: think-auto-setup-missing-pipeline
target: ae:think
layer: 1
source: generated
---

## Expected Behavior

### MUST
- [behavior] SKILL.md pre-check 1 auto-runs /ae:setup inline when pipeline.yml is missing (does NOT refuse)
- [text:contains] SKILL.md announces "First time using ae plugin, initializing project config..." before setup
- [behavior] After setup completes inline, skill continues with the think analysis

### MUST_NOT
- [behavior] MUST NOT hard-refuse or stop when pipeline.yml is missing
- [behavior] MUST NOT skip setup and proceed without pipeline.yml

### SHOULD
- [text:contains] Output indicates auto-setup was triggered before analysis began
