---
name: ae:dashboard
description: Real-time project pipeline status — feature-level progress view
user_invocable: true
---

# /ae:dashboard — Project Dashboard

Read-only pipeline status viewer. Shows all in-flight features, their current pipeline stage, and actionable next steps.

This skill produces no file output — it is a viewer, not a producer.

## Pre-check

1. Read `.claude/pipeline.yml`
   - Missing → output:
     ```
     No pipeline.yml found. Run /ae:setup to configure your project.
     ```
     Stop.
2. Read `output.*` paths from pipeline.yml. Use defaults if not specified:
   - `output.discussions` (default: `docs/discussions/`)
   - `output.plans` (default: `docs/plans/`)
   - `output.reviews` (default: `docs/reviews/`)
   - `output.backlog` (default: `docs/backlog/`)

## State Reading

Scan each output directory. Handle gracefully:
- Directory does not exist → skip, note "directory not found"
- Directory empty → skip
- File missing `index.md` or expected frontmatter → skip with note

### Discussions

For each subdirectory in `output.discussions`:
1. Read `index.md` frontmatter:
   - `id`, `title`, `status` (active/done/concluded)
   - `pipeline.analyze`, `pipeline.discuss`, `pipeline.plan`, `pipeline.work`
   - `plan` — path to plan file (empty string `""` = no plan yet)
2. Determine current stage from `pipeline.*` fields:
   - `analyze: in_progress` → stage = "analyzing", action = `/ae:analyze <dir>`
   - `discuss: in_progress` → stage = "discussing"
   - `discuss: done`, `plan:` field is `""` or missing → stage = "awaiting plan", action = `/ae:plan`
   - `discuss: done`, `plan: <path>` (non-empty) → follow plan (see Plans below)

### Plans

For each `.md` file in `output.plans`:
1. Read frontmatter: `id`, `title`, `status` (draft/reviewed), `discussion`
2. Count checkboxes: `- [x]` (done) vs `- [ ]` (pending)
3. Determine stage:
   - `status: draft` → "plan draft", action = `/ae:plan-review <plan-path>`
   - `status: reviewed`, all `- [ ]` → "ready for work"
   - `status: reviewed`, mixed `- [x]`/`- [ ]` → "work in progress (N/M steps)"
   - All `- [x]` → check for review (see Reviews)

### Reviews

For each `.md` file in `output.reviews` with `type: review` in frontmatter:
1. Read: `target` (plan path), `verdict` (pass/fail, may be absent in older files)
2. Match to plan via `target` field
3. If `verdict: pass` → feature stage = "done"
4. If `verdict: fail` → feature stage = "review failed — needs fixup"
5. If `verdict` absent → feature stage = "reviewed (verdict unknown)"

### Backlog

Count files in `output.backlog` with `status: open` (or all `.md` files if no status field).

### Cross-family

Read `pipeline.yml` → `cross_family` config:
- `codex: true/false`
- `gemini: true/false`

## Output Format

### Feature Table

```
📊 Project Dashboard

| # | Feature | Stage | Progress | Next Action |
|---|---------|-------|----------|-------------|
| 028 | UX Shortcuts | work in progress | 1/4 steps | /ae:work .ae/plans/028-ux-shortcuts.md |
| 027 | Agent Teams Audit | ready for work | 0/5 steps | /ae:work .ae/plans/027-agent-teams-audit-fixes.md |
| 026 | P2 Experiments | awaiting plan | — | /ae:plan |
| 025 | Test Coverage | discussing | 2/3 topics | /ae:discuss .ae/discussions/025-test-coverage-gaps/ |
```

Stage values: `analyzing` → `discussing` → `awaiting plan` → `plan draft` → `ready for work` → `work in progress` → `awaiting review` → `review failed` → `done`

### Summary Footer

```
📋 Summary: N features (X active, Y done)
📝 Backlog: M open items
🔗 Cross-family: Codex ✓ | Gemini ✓
```

### Large Project Handling

If more than 15 features:
- Show active features (not "done") in the table
- Summarize done features as: "N features completed (use /ae:dashboard --all to show)"
- Sort by stage: most actionable first (work in progress > ready for work > awaiting plan > discussing)

## Edge Cases

- Discussion with `status: done` but `plan: ""` and no matching plan file → stage = "awaiting plan"
- Plan file with `discussion: ""` or missing → standalone plan (not linked to discussion), show as independent row
- Plan with all steps done but no review file with matching `target` → stage = "awaiting review"
- Review file with `target` pointing to non-existent plan → skip with note
- `pipeline.*` fields partially filled (some stages missing) → infer from what's available
