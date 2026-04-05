---
id: work-autofallback-no-agent-teams
target: ae:work
layer: 2
source: generated
---

## Context
- A reviewed plan exists with pending steps
- `~/.claude/settings.json` does NOT have `env.CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS` set
- The plan has a single-platform step (no parallel execution needed)

## Prompt
Execute `/ae:work` against the test plan. Before execution, remove `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS` from settings.json in the worktree. After execution, restore it.

## Setup
1. In worktree, edit `~/.claude/settings.json`: remove `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS` from `env` block
2. Use test plan at `.ae/plans/999-test-fixture-work.md` (must exist with `status: reviewed` and pending steps)
3. Execute `/ae:work .ae/plans/999-test-fixture-work.md`
4. Collect output text + any file changes
5. Restore settings.json
