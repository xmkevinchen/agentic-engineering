---
id: trace-auto-fallback-no-agent-teams
target: ae:trace
layer: 1
source: generated
---

## Context
- `~/.claude/settings.json` does NOT contain `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS` key, or it is set to `"0"`
- `.claude/pipeline.yml` exists in the project
- A valid target function/endpoint exists in the codebase

## Prompt
/ae:trace "UserAuthService.authenticate"

## Prompt Variants
- /ae:trace "POST /api/login"
- /ae:trace "database connection pool initialization"
