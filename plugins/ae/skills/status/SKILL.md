---
name: ae:status
description: Mid-skill-safe session readout — git context + active features + in-flight teams + recent review verdicts + BLs captured today
argument-hint: ""
user-invocable: true
effort: minimal
---

# /ae:status — Session Readout

Mid-skill safe, pure-read session-state readout. Shows what's happening NOW: git context, active features, in-flight teams (filesystem-persistent), recent review verdicts, BLs captured today.

**Mid-skill safe**: invocable while another skill is mid-execution. Does NOT spawn agents, does NOT write files, does NOT call long-running tools. Pure Read + Bash queries. Returns in <2 wall-clock seconds.

## Trigger

User runs `/ae:status` (no arguments).

## Pre-check

1. Confirm `.claude/pipeline.yml` exists. Missing → output `No pipeline.yml found. Run /ae:setup to configure your project.` and stop.
2. Read `output.backlog` from pipeline.yml (default: `.ae/backlog/`).

## Output Format

Exactly 5 sections in this order. Each section is read-only filesystem inspection — no team spawn, no file writes. If a section has no data, print the section header + `(none)`.

### 1. Git context

Run inline (single Bash invocation for speed):
- Branch: `git branch --show-current`
- Last commit: `git log -1 --format='%h %s' | head -1` (short SHA + first 60 chars of message)
- Uncommitted diff summary: `git diff --stat | tail -3` (last 3 lines = the per-file changes + total summary line)
- Unpushed commits: `git log @{u}..HEAD --oneline 2>/dev/null | wc -l` — if no upstream tracking, fall back to `(no upstream tracking branch)`

### 2. Active features

Scan `.ae/features/active/F-*/index.md`. For each: read frontmatter `id`, `title`, `theme` (optional). Output 1 line per feature: `F-NNN — <title>` (`<theme>`-prefixed if theme present). If `.ae/features/active/` is empty: `(none)`.

This section is read-only — does NOT re-run the `/ae:dashboard` stage-detection logic (that would cost time). For full stage breakdown use `/ae:dashboard`.

### 3. In-flight teams

Scan `~/.claude/teams/<name>/config.json` directly. **Do NOT use `TaskList`** — `TaskList` is conversation-scoped and cannot see tasks from other sessions (per F-008 plan-review dep-analyst Finding 2). Team dirs are filesystem-persistent and authoritative across sessions.

**Staleness filter**: skip team dirs whose `config.json` mtime is older than 4 hours (heuristic — TeamDelete should clean up active teams; old surviving dirs are likely orphans from a crash). Compute via `find ~/.claude/teams -maxdepth 2 -name config.json -mmin -240`.

For each surviving team:
- Read `config.json` → extract team name, members list (each member's `name` + `agentType`), and `joinedAt` timestamps
- Output: `<team-name> — <N> members — age <H>h<M>m` (age = now − newest config.json mtime in the team dir)

If no in-flight teams (or all filtered as stale): `(no in-flight teams in the last 4 hours)`.

### 4. Recent review verdicts

Scan BOTH locations (union):
- `.ae/features/done/F-*/review.md` (feature-resident reviews, Plan 051+)
- `.ae/reviews/*.md` (legacy reviews; non-recursive — naturally excludes `adhoc/`)

For each, read frontmatter `verdict` + the feature/plan title from `target`. Sort by `created:` descending. Output the most recent 5 verdicts: `<verdict-icon> F-NNN — <title> (<created date>)`. Verdict icons: `✓` for pass, `✗` for fail.

If no review files found: `(no reviews yet)`.

### 5. BLs captured today

Run: `find .ae/backlog/unscheduled/ -name 'BL-*.md' -newermt "$(date -u +%Y-%m-%d)"`. List each as `BL-NNN — <title from frontmatter>`.

If none: `(no BLs captured today)`.

## Performance contract

Total wall-clock target: under 2 seconds for a typical project (≤20 active features, ≤10 active team dirs, ≤50 reviews, ≤100 BLs). The sections are independent — slower I/O on one section should not stall the others (output them as they complete; do NOT batch-load everything first).

## Non-goals

- **Not a replacement for `/ae:dashboard`**: dashboard is the project-pipeline-state view; status is the session-state-now view. Different consumers.
- **No team spawn, no writes**: `/ae:status` MUST remain pure-read. Any modification of state belongs in a different skill (e.g., archiving stale team dirs → BL).
- **No session ID concept**: git/team-dir/BL queries use filesystem timestamps, not session boundaries (no session ID exists in the runtime).
- **No `git log --since=<duration>`**: rejected during plan-review (gemini P2 #4) — wall-clock windows go stale on user pause. Section 1's `git log @{u}..HEAD` is upstream-relative, immune to pause.

## Output example

```
📍 Git
  Branch: main
  Last: 4ed382c F-008 Step 1: F-001 TaskCreate pattern coverage to 6 long-running skills (AC1)
  Uncommitted: 0 files changed
  Unpushed: 2 commits ahead of origin/main

🎯 Active features (1)
  F-008 — AE 质量回归 — 三种失败模式诊断 (ae-self-quality)

🤖 In-flight teams (0 in the last 4 hours)
  (no in-flight teams in the last 4 hours)

✅ Recent verdicts (3)
  ✓ F-009 — Agent invocation consistency fixes (2026-05-17)
  ✓ F-019 — Cast and spawn protocol (2026-05-16)
  ✓ F-016 — Strengthen built-in agents (2026-05-10)

📥 BLs today (1)
  BL-084 — Mid-flight checkpoint mechanism design
```

## Next Steps

After reading status, the user can:
- Resume current in-flight skill (status does not interrupt)
- Run `/ae:dashboard` for full pipeline stage breakdown
- Run `/ae:next` for single-most-actionable suggestion
