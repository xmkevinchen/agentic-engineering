---
name: ae:code-review
description: Quick code review before each commit (Claude + cross-family)
argument-hint: "[files or directory]"
---

# /ae:code-review — Pre-commit Quick Review

Quick code review on current uncommitted changes.

## Trigger

1. **Auto** — `/ae:work` calls this before each commit
2. **Manual** — run `/ae:code-review` anytime

## Execution (three parallel tracks)

**Select agents**: Refer to the **Agent Selection Reference** skill for the selection table and rules.

**Cross-family**: Read `cross_family` from pipeline.yml. For each enabled family, launch its proxy track in parallel. If a proxy fails to connect, skip it — do not block the review.

### Track 1: Claude Review

Check `git diff --stat` to determine change scope. Then:

- Discover reviewer agents: check `agents.code_reviewers` in pipeline.yml first. If not configured (default), discover all available agents (project, plugins, global) whose description indicates a code reviewer role.
- If project reviewers found: launch matching agents based on changed file types
- If none found: use the plugin's built-in `code-reviewer` agent

Review `git diff` + `git diff --cached`.

### Track 2: Codex Review

Launch `codex-proxy` agent to review the same diff via Codex MCP.

### Track 3: Gemini Review

Launch `gemini-proxy` agent to review the same diff via Gemini MCP.

## Results

Output directly to terminal:

- **Block** — must fix
- **Warning** — suggested fix, not blocking
- **OK**

**Flag conflicts between tracks for user judgment.**

## Next Steps

Based on review outcome, suggest:
- If all OK → "Code is clean. Proceed with commit"
- If has Block findings → "Fix blocking issues before commit"
- If part of `/ae:work` flow → return to work's pre-commit checks

