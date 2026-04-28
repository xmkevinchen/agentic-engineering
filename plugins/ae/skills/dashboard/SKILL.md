---
name: ae:dashboard
description: Real-time project pipeline status — GTD feature-level progress view
user_invocable: true
---

# /ae:dashboard — Project Dashboard

Read-only pipeline status viewer. Default view shows in-flight **features** (`.ae/features/active/`) — each one a GTD Project — with their current stage and next action. Legacy artifacts (`.ae/discussions/`, `.ae/plans/`, `.ae/reviews/`) are hidden by default; pass `--legacy` to surface them.

This skill produces no file output — it is a viewer, not a producer.

## Arguments

- `--all` — Include `features/done/` and `features/abandoned/` in addition to the default `features/active/`. Without `--all`, done is summarized (count line) and abandoned is silent.
- `--legacy` — Surface legacy artifacts (`.ae/discussions/`, `.ae/plans/`, `.ae/reviews/`) in a separate section below the features view. Default behavior is to hide them — most are terminal-state and would create permanent noise alongside live features.

## Pre-check

1. Read `.claude/pipeline.yml`
   - Missing → output:
     ```
     No pipeline.yml found. Run /ae:setup to configure your project.
     ```
     Stop.
2. Read `output.*` paths from pipeline.yml. The features path is fixed at `.ae/features/` (internal state, not configurable). Other paths used by `--legacy`:
   - `output.discussions` (default: `docs/discussions/`)
   - `output.plans` (default: `docs/plans/`)
   - `output.reviews` (default: `docs/reviews/`)
   - `output.backlog` (default: `docs/backlog/`)

## Primary read source — features/active/

The default view is built from `.ae/features/active/*/index.md`. For each feature dir, read frontmatter (per CLAUDE.md → `## Project Management (GTD)` → Feature index.md frontmatter schema): `id`, `title`, `status`, `created`, optional `theme`, `roadmap`, `size`, `depends_on`, `origin_bl`. Reader-tolerant per the same schema contract.

For each feature, determine the **current stage**:

| Stage | Detection rule |
|---|---|
| `analyzing` | `analysis.md` is missing OR has empty body (research not yet done) |
| `discussing` | a discussion artifact exists in the feature dir referencing this feature, OR discussions/ has an entry with frontmatter `feature: F-NNN` (when plan 051 ships) |
| `awaiting plan` | analysis present, but no `plan.md` in feature dir AND no legacy plan with frontmatter `feature: F-NNN` (legacy linkage falls back to inference per "Plan linkage" below) |
| `plan draft` | linked plan has frontmatter `status: draft` |
| `ready for work` | linked plan has `status: reviewed` AND zero `- [x]` AND ≥ 1 `- [ ]` |
| `work in progress` | linked plan has `status: reviewed` AND mixed `- [x]` / `- [ ]` |
| `awaiting review` | linked plan has all `- [x]` AND no review with `verdict: pass` |
| `review failed` | linked plan has all `- [x]` AND linked review with `verdict: fail` |
| `done` | feature `index.md` frontmatter `status: done` (i.e., already in `features/done/`, only shown under `--all`) |

### Plan linkage (Plan 051+)

The dashboard infers plan linkage in priority order:

1. **`<feature-dir>/plan.md`** exists (Plan 051+ feature-dir-resident plans) → use it. Feature ID is path-derived from parent dir; no frontmatter required.
2. **Legacy plan with `discussion:` field** matching a discussion that linked this feature → use it (legacy bridge for pre-Plan-051 plans).
3. Otherwise → stage = `awaiting plan` (no linkage available).

If multiple legacy plans match → tiebreaker is highest plan-id; secondary tiebreaker is most recent `created:`.

The Plan 050 transition's speculative scan-by-filename step is no longer needed — feature-dir plans are deterministic (path-derived) and legacy plans use the discussion-id chain.

## Legacy State Reading (only invoked under `--legacy`)

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

Scan BOTH locations (union — Plan 051+):
- **Feature-dir plans (primary)**: `.ae/features/{active,done,abandoned}/F-*/plan.md`
- **Legacy plans (fallback)**: `output.plans/*.md`

For each plan file:
1. Read frontmatter: `id` (legacy) or path-derived `F-NNN` (feature-dir), `title`, `status` (draft/reviewed/done), `discussion`
2. Count checkboxes: `- [x]` (done) vs `- [ ]` (pending)
3. Determine stage:
   - `status: done` → "done" (skip review check — plan is explicitly marked complete)
   - `status: draft` → "plan draft", action = `/ae:plan-review <plan-path>`
   - `status: reviewed`, all `- [ ]` → "ready for work"
   - `status: reviewed`, mixed `- [x]`/`- [ ]` → "work in progress (N/M steps)"
   - All `- [x]` → check for review (see Reviews)

### Reviews

Scan BOTH locations (union — Plan 051+):
- **Feature-dir reviews (primary)**: `.ae/features/{active,done}/F-*/review.md`
- **Legacy reviews (fallback)**: `output.reviews/*.md` with `type: review` in frontmatter

For each review file:
1. Read: `target` (plan path), `verdict` (pass/fail, may be absent in older files)
2. Match to plan via `target` field (or, for feature-dir reviews without `target:`, the sibling `plan.md` is the implicit target)
3. If `verdict: pass` → feature stage = "done"
4. If `verdict: fail` → feature stage = "review failed — needs fixup"
5. If `verdict` absent → feature stage = "reviewed (verdict unknown)"

Tiebreaker when both legacy and feature-dir reviews target the same plan: most recent `created:` wins. No surface-index pointer files; the union scan is the bridge.

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

### Feature Table (default view)

```
📊 Project Dashboard

| # | Feature | Stage | Progress | Next Action |
|---|---------|-------|----------|-------------|
| F-028 | UX Shortcuts | work in progress | 1/4 steps | /ae:work .ae/plans/028-ux-shortcuts.md |
| F-027 | Agent Teams Audit | ready for work | 0/5 steps | /ae:work .ae/plans/027-agent-teams-audit-fixes.md |
| F-026 | P2 Experiments | awaiting plan | — | /ae:plan |
| F-025 | Test Coverage | discussing | 2/3 topics | /ae:discuss .ae/discussions/025-test-coverage-gaps/ |
```

Stage values (in priority order, most-actionable first): `work in progress` > `ready for work` > `awaiting plan` > `discussing` > `analyzing` > `awaiting review` > `review failed` > `plan draft` > `done`

Sort the active table by stage priority, then by `created:` ascending (oldest first — the longer something has been in-flight, the more it warrants attention).

### Summary Footer

```
📋 Features: N active (use --all to include done + abandoned)
📝 Backlog: M open items in .ae/backlog/unscheduled/
🔗 Cross-family: Codex ✓ | Gemini ✓
🗺️ Run /ae:roadmap for promote candidates + dependency analysis
```

**Empty-state nudge**: when `.ae/features/active/` is empty, replace the footer with one of:

- **Backlog has items** (`unscheduled/` non-empty): `📋 0 active features. You have N items in the inbox — run /ae:roadmap to see promote candidates, then /ae:analyze BL-NNN to Organize one into a feature.`
- **Backlog also empty**: `📋 No features yet, no captured ideas yet. Run /ae:backlog "<one-line idea>" to start the GTD loop (frictionless inbox drop — classification happens later).`

This is a positive guide rather than a dead end — the dashboard's job is orientation, including for first-run users.

### `--all` expansion

When `--all` is passed, append two additional tables:

```
✓ Done features (N)
| F-XXX | Title | Done date | Origin BL |
| ...

⊘ Abandoned features (N)
| F-XXX | Title | Abandoned date | Reason |
| ...
```

Without `--all`, done features collapse to a single line: `N features completed (use /ae:dashboard --all to show).` Abandoned features are silent without `--all` (no count line — they are intentionally out-of-scope by default).

### `--legacy` expansion

When `--legacy` is passed, append a Legacy Artifacts section showing items from `.ae/discussions/`, `.ae/plans/`, and `.ae/reviews/` that are NOT linked to any feature in `features/{active,done,abandoned}/`. Use the existing State Reading + stage-derivation logic in the "Legacy State Reading" section above. This section is intentionally below the Feature Table — features are the live work; legacy artifacts are historical context.

Without `--legacy`, the Legacy Artifacts section is omitted entirely (not even a count line). Most legacy items are terminal-state; mixing them with live features creates permanent noise. A user who wants to find them should grep or pass `--legacy`.

## Edge Cases

### Feature-level edge cases (default view)

- Feature `index.md` missing required field → log error, skip the feature (per CLAUDE.md Reader contract).
- Feature with no plan linkage and no discussion → stage = `awaiting plan`, action = `/ae:discuss .ae/features/active/<F-NNN-slug>/` (decide before plan) or `/ae:plan` (if scope is clear).
- Feature with `roadmap: <name>` pointing to non-existent roadmap file → silently ignore the field (reader-tolerant); flag is `/ae:roadmap` section (d)'s job to surface.
- Multiple legacy plans match a feature via fallback inference — tiebreaker per "Plan linkage during Plan 050 transition" above (highest plan-id, then most recent `created:`).

### Legacy edge cases (only under `--legacy`)

- Discussion with `status: done` but `plan: ""`, no matching plan file, AND `pipeline.plan` is in `{pending, in_progress}` or missing → stage = "awaiting plan". When `pipeline.plan: skipped` or `done` (with empty `plan:`), classify as "done" (collapses into done bucket) — see Legacy State Reading → Guard block above.
- Plan file with `discussion: ""` or missing → standalone plan (not linked to discussion), show as independent row
- Plan with all steps done but no review file with matching `target` → stage = "awaiting review"
- Review file with `target` pointing to non-existent plan → skip with note
- `pipeline.*` fields partially filled (some stages missing) → infer from what's available
