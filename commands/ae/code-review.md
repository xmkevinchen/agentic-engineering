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

## Execution (two parallel tracks)

### Track 1: Claude Review

Check `git diff --stat` to determine change scope. Then:

- Read `agents.code_reviewers` from `.claude/pipeline.yml`
- If configured: launch matching reviewer agents based on changed file types
- If not configured: use the plugin's built-in `code-reviewer` agent

Review `git diff` + `git diff --cached`.

### Track 2: Cross-family Review

**Codex** (required baseline) — via MCP:
```
mcp__codex__codex(prompt: "Review these uncommitted changes. Focus: [context]\n\n<diff>")
```

**Gemini** (optional add-on) — via MCP:
```
mcp__ae-gemini__chat(prompt: "Review these changes for [concern]:\n\n<diff>", model: "gemini-2.5-flash")
```

**Both tracks launch in parallel.**

## Results

Output directly to terminal (no report file):

- **Block** — must fix
- **Warning** — suggested fix, not blocking
- **OK**

**Flag conflicts between tracks for user judgment.**
