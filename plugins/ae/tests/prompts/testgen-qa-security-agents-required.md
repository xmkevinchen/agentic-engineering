---
id: testgen-qa-security-agents-required
target: ae:testgen
layer: 1
source: generated
---

## Context
- `~/.claude/settings.json` contains `"CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS": "1"` (Agent Teams enabled)
- `.claude/pipeline.yml` exists in the project

## Prompt
Read the ae:testgen SKILL.md and describe which agents are spawned in Step 2.

## Prompt Variants
- What agents does ae:testgen use for test plan review?
