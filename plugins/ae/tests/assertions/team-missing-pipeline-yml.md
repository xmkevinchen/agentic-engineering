---
id: team-missing-pipeline-yml
target: ae:team
layer: 1
source: generated
---

## Expected Behavior

### MUST
- [text:contains] Output includes "First time using ae plugin, initializing project config..."
- [behavior] Triggers /ae:setup flow inline
- [behavior] After setup completes, continues executing the original ae:team command

### MUST_NOT
- [behavior] MUST NOT refuse or exit with an error about missing pipeline.yml
