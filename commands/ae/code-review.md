---
name: code-review
description: Quick code review before each commit (Claude + cross-family)
argument-hint: "[files or directory]"
---

# /ae:code-review — Pre-commit Quick Review

Quick code review on current uncommitted changes.

## Trigger

1. **Auto** — `/ae:work` calls this before each commit
2. **Manual** — run `/ae:code-review` anytime

## Execution (three parallel tracks)

**Cross-family**: Read `cross_family` from pipeline.yml. For each enabled family, launch its proxy track in parallel. If a proxy fails to connect, skip it — do not block the review.

### Track 1: Claude Review

Check `git diff --stat` to determine change scope. Then:

- Read `agents.code_reviewers` from `.claude/pipeline.yml`
- If configured: launch matching reviewer agents based on changed file types
- If not configured: use the plugin's built-in `code-reviewer` agent

Review `git diff` + `git diff --cached`.

### Track 2: Codex Review

Launch `codex-proxy` agent to review the same diff via Codex MCP.

### Track 3: Gemini Review

Launch `gemini-proxy` agent to review the same diff via Gemini MCP.

## Results

Output directly to terminal (no report file):

- **Block** — must fix
- **Warning** — suggested fix, not blocking
- **OK**

**Flag conflicts between tracks for user judgment.**
