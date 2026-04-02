---
id: refuse-unknown-target
target: ae:test-plugin
layer: 1
source: generated
---

## Context
- Agent Teams enabled
- `.claude/pipeline.yml` exists with valid config
- Target skill name does not exist in the plugin

## Prompt
/ae:test-plugin ae:nonexistent-skill

## Prompt Variants
- /ae:test-plugin ae:foobar
- /ae:test-plugin ae:deploy

## Expected Behavior

### MUST
- "not found" message referencing the exact skill name provided
- References the exact skill name the user typed

### MUST_NOT
- No TeamCreate tool call
- No Phase 1 (generation) or Phase 2 (execution) activity

### SHOULD
- Suggests valid skill names the user may have intended
