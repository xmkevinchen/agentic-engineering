---
id: discuss-spawns-team-creates-scaffold
target: ae:discuss
layer: 2
source: manual
---

## Context

Fixture state (in worktree):
- `.claude/pipeline.yml` exists with `output.discussions: ".ae/discussions/"` and `env.CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS: "1"`
- No existing discussions in `.ae/discussions/` (cold start)
- MEMORY has no prior discussion on the test topic

## Prompt

Execute:
```
/ae:discuss test feature X: should we use approach A or approach B
```

The skill's Setup + Spawn Team steps must create the scaffold AND spawn an agent team per the Agent Teams Discussion Mode protocol.
