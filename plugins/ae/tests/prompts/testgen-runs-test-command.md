---
id: testgen-runs-test-command
target: ae:testgen
layer: 1
source: generated
---

## Context
- `.claude/pipeline.yml` exists with a `test.command` configured (e.g., "pytest")
- `~/.claude/settings.json` contains `"CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS": "1"` (Agent Teams enabled)

## Prompt
Read the ae:testgen SKILL.md and describe what happens in Step 4 after tests are generated.

## Prompt Variants
- How does ae:testgen verify the tests it generates?
