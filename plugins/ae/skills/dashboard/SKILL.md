---
name: ae:dashboard
description: Real-time project pipeline status — feature-level progress view
user_invocable: true
---

# /ae:dashboard — Project Dashboard

Read-only pipeline status viewer. Shows all in-flight features, their current pipeline stage, and actionable next steps.

This skill produces no file output — it is a viewer, not a producer.

## Arguments

- `--all` — Expand the Done section to show all completed features (by default, done features are always collapsed)

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
   - `discuss: done`, `plan:` field is `""` or missing, AND `pipeline.plan` is in `{pending, in_progress}` or missing → stage = "awaiting plan", action = `/ae:plan`
   - `discuss: done`, `plan:` field is `""` or missing, AND `pipeline.plan` is `skipped` or `done` → stage = "done" (collapses into done bucket per Done Feature Handling section). Discussion 已 conclude 且 explicitly 决定不需要 plan（或 plan 已交付但路径未回写）—— 不再有 actionable next step。
   - `discuss: done`, `plan: <path>` (non-empty) → follow plan (see Plans below)

**Guard — when does "awaiting plan" stage fire?**

TWO frontmatter fields must be checked (they are distinct):
- `plan:` (top-level) is the plan-file path — `""` or missing means no plan file exists yet. Necessary but not sufficient.
- `pipeline.plan:` (under `pipeline:`) is the lifecycle state enum. If missing, treat as `pending`. Fire "awaiting plan" stage only when the state is `pending` or `in_progress`.

| `pipeline.plan:` value | awaiting plan fires? |
|---|---|
| `pending` | YES |
| `in_progress` | YES |
| (missing) | YES (fallback → pending) |
| `skipped` | NO (discussion explicitly decided no plan is needed → classify as "done") |
| `done` | NO (plan already exists — should have been caught earlier in chain → classify as "done") |

*Note: this table only disambiguates the `pipeline.plan:` dimension. Both preconditions from the opening rule must still hold — "awaiting plan" fires only when `plan:` (top-level) is empty/missing AND the `pipeline.plan:` value above says YES. When `pipeline.plan:` is `skipped` or `done` with empty `plan:`, the discussion is classified as "done" (not "awaiting plan") and falls into the done bucket. **The "done" classification on `skipped`/`done` rows is dashboard-only behavior — `/ae:next` Step 5 (the reference fix at `next/SKILL.md:71-85`) only suppresses, does not classify, because it outputs a single most-actionable suggestion rather than a stage table. Do NOT propagate this fallback back to `/ae:next`.**

### Plans

For each `.md` file in `output.plans`:
1. Read frontmatter: `id`, `title`, `status` (draft/reviewed/done), `discussion`
2. Count checkboxes: `- [x]` (done) vs `- [ ]` (pending)
3. Determine stage:
   - `status: done` → "done" (skip review check — plan is explicitly marked complete)
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

### Backlog (v2 — path-aware traversal)

Scan `output.backlog/` recursively:
- **Include** items in `v*/` (active sprint), `unscheduled/` (product backlog), and `BL-*.md` at root (legacy flat layout during migration)
- **Exclude** items in `done/v*/` (archived — shipped in that version) and `closed/` (discarded, not shipped) from open counts
- Count files with `status: open` (or all `.md` files if no status field) across included scopes

Report breakdown: `Open: N (M in current sprint, K unscheduled)` when sprint structure is present; fall back to flat count on legacy layout.

**Note on "current sprint" approximation**: ae:dashboard classifies any `v*/` subdirectory as an active sprint via directory pattern alone — it does NOT read `.ae/roadmaps/v*.md` frontmatter. If a sprint dir exists but its roadmap doc has `closed:` frontmatter set (e.g., close subcommand partially failed or was interrupted), ae:dashboard will over-count those items as active. This is a deliberate performance/simplicity tradeoff. For authoritative current-version determination (reading `closed:` frontmatter), use `/ae:roadmap` which applies the full rule from its State Reading → Roadmaps subsection. For day-to-day status checks, the approximation is accurate.

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
🗺️ Run /ae:roadmap for feature grouping and version suggestions
```

### Done Feature Handling

Always collapse done features regardless of total feature count:
- Show active features (not "done") in the table, sorted by stage: most actionable first (work in progress > ready for work > awaiting plan > discussing)
- Summarize done features as: "N features completed (use /ae:dashboard --all to show)"
- When `--all` flag is passed: expand done features into a full table below the active features

## Edge Cases

- Discussion with `status: done` but `plan: ""`, no matching plan file, AND `pipeline.plan` is in `{pending, in_progress}` or missing → stage = "awaiting plan". When `pipeline.plan: skipped` or `done` (with empty `plan:`), classify as "done" (collapses into done bucket per Done Feature Handling) — see Discussions → Guard block above.
- Plan file with `discussion: ""` or missing → standalone plan (not linked to discussion), show as independent row
- Plan with all steps done but no review file with matching `target` → stage = "awaiting review"
- Review file with `target` pointing to non-existent plan → skip with note
- `pipeline.*` fields partially filled (some stages missing) → infer from what's available
