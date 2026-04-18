---
id: consensus-debate-mode-forced-stances
target: ae:consensus
layer: 2
source: manual
---

## Context

Fixture state (in worktree):
- `.claude/pipeline.yml` exists with Agent Teams enabled
- A decision topic that has genuine pro/con split (e.g., "Should we use Postgres or SQLite for the embedded store?")

## Prompt

Execute:
```
/ae:consensus Should we use Postgres or SQLite for the embedded store?
```

Per Debate Mode protocol (ae:agent-teams), the skill must spawn agents with FORCED stances (advocate FOR, critic AGAINST) and drive cross-examination rounds before concluding.
