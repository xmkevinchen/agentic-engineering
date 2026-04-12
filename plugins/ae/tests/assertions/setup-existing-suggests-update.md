---
id: setup-existing-suggests-update
target: ae:setup
layer: 1
source: generated
---

## Expected Behavior

### MUST
- [behavior] SKILL.md detects existing pipeline.yml and does NOT overwrite it
- [text:contains] SKILL.md suggests "/ae:setup update" as the correct command for updating existing config
- [behavior] Execution stops after suggestion — no new pipeline.yml written

### MUST_NOT
- [behavior] MUST NOT overwrite an existing pipeline.yml without the "update" argument
- [behavior] MUST NOT silently proceed with initialization when config already exists

### SHOULD
- [text:contains] Message is clear that /ae:setup update is used for existing configurations
