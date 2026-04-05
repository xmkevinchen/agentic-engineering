---
id: tp-orphan-team-cleanup
target: ae:test-plugin
layer: 2
source: generated
---

## Context
- Agent Teams enabled
- `.claude/pipeline.yml` exists with valid config
- Target is a Class B skill that creates Agent Teams during execution
- The target skill crashes mid-execution, leaving an uncleaned team in `~/.claude/teams/`

## Prompt
/ae:test-plugin ae:discuss

## Prompt Variants
- /ae:test-plugin ae:plan
