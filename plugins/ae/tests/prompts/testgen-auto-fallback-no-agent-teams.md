---
id: testgen-auto-fallback-no-agent-teams
target: ae:testgen
layer: 1
source: generated
---

## Context
- `~/.claude/settings.json` does NOT contain `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS` key, or it is set to `"0"`
- `.claude/pipeline.yml` exists in the project
- A valid target file exists in the codebase

## Prompt
/ae:testgen "src/auth/login.py"

## Prompt Variants
- /ae:testgen "src/api/users.js"
