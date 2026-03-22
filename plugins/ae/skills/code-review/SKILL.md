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

Output directly to terminal:

- **Block** — must fix
- **Warning** — suggested fix, not blocking
- **OK**

**Flag conflicts between tracks for user judgment.**

## Scratch Persistence

Auto-save results to scratch directory (`pipeline.yml` → `scratch`, default: `~/.claude/scratch/`). File: `code-review-YYYY-MM-DD-NNN.md`.

Do NOT ask user about formal persistence — code-review is high-frequency, low-ceremony. Scratch files are archived in bulk during `/ae:review` (feature gate).

```markdown
---
type: code-review
project: <repo-name>   # git repo name, for cross-project isolation
created: YYYY-MM-DDTHH:MM:SS
status: in_progress    # in_progress → resolved (when all findings addressed)
---

## Findings

1. [SEVERITY] file:line — description
   - action: fix now | backlog BL-NNN | skip
   - status: pending | in_progress | resolved
```

Write scratch file at start of review with `status: in_progress`. Update to `status: resolved` after all findings are addressed and committed.
