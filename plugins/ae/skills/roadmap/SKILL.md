---
name: ae:roadmap
description: GTD Clarify — promote candidates, dependency analysis, sizing aggregate, roadmap archive prompt
argument-hint: "[--resize | --legacy | <subcommand>]"
user-invocable: true
effort: medium
---

# /ae:roadmap — GTD Clarify

Read-only orientation skill that surfaces four things in one pass:

| # | Function | Question it answers |
|---|---|---|
| (a) | **Promote candidates** | which BLs in the inbox are worth turning into features now? |
| (b) | **Dependency analysis** | which active features are ready to work on, which are blocked, what's the critical path? |
| (c) | **Sizing aggregate** | how big is the active workload, and what's unsized? |
| (d) | **Archive prompt** | which roadmaps are fully done and ready to archive? |

This is the Clarify phase of GTD — looking at captured items + organized features and deciding **what's actionable next**. It does NOT promote items itself (that's `/ae:analyze BL-NNN`), does NOT execute features (that's `/ae:work`), and does NOT do retrospective analysis (that's `/ae:retrospect`).

## Pre-check

1. Confirm `.claude/pipeline.yml` exists. Missing → `Run /ae:setup first.` Stop.
2. Read `output.backlog` + `output.milestones` paths from pipeline.yml (defaults `.ae/backlog/`, `.ae/milestones/`). The features path is fixed at `.ae/features/` (internal state, not configurable, same as `.ae/roadmaps/`).
3. If `.ae/features/` doesn't exist yet → output: `Project hasn't adopted GTD yet. Run Plan 050 to bootstrap features/ + roadmaps/.` Stop. (Defensive — should be rare once Plan 050 ships.)

## State Reading

All reads are **reader-tolerant** per CLAUDE.md → `## Project Management (GTD)` → Reader contract.

### Backlog

Scan recursively under `<output.backlog>` for `BL-*.md`. For each, read frontmatter `id`, `title`, `status`, `created`. Treat any of `open` / `unscheduled` as "still in inbox". Treat `promoted` / `done` / `closed` as terminal — exclude from promote-candidate analysis. Other status values: log warning, skip.

### Active features

Scan `.ae/features/active/*/index.md`. For each, read frontmatter:

- Required: `id`, `title`, `status`, `created`
- Optional: `theme`, `roadmap`, `size`, `depends_on`, `origin_bl`

Missing required field → log error, skip that feature, continue. Unknown enum values → preserve but skip from enum-dependent workflows.

### Active roadmaps

Scan `.ae/roadmaps/active/*.md`. For each, read frontmatter `name`, `title`, `created`, `themes` (optional list), and the body's link to features. Legacy version-grouped files (`.ae/roadmaps/v*.md` at top level) are NOT read — they remain in place as historical reference. Pass `--legacy` to surface them in the Promote-candidates section as informational context only.

## Output

The default invocation produces four sections in this order. Sections that have nothing to say emit a one-line "no concerns" instead of being silent (so the user knows the check ran).

### (a) Promote candidates

#### Filtering Constraints

Before LLM judgment runs, mechanically filter out:

- **Already-promoted BLs**: scan `origin_bl:` across `.ae/features/{active,done,abandoned}/*/index.md`. Treat both scalar (`origin_bl: BL-042`) and list (`origin_bl: [BL-042, BL-051]`) forms — any BL-ID appearing in any feature's `origin_bl` is excluded. Multi-BL consolidation: even if a BL is only one of several IDs in a feature's `origin_bl` list, it is considered promoted and must be suppressed (no zombie partial-promotion suggestions).
- **Terminal BLs**: status in `{promoted, done, closed}` per State Reading.

The remaining set (`status: open` or `unscheduled`, not in any `origin_bl`) is the candidate pool.

#### LLM judgment

For each candidate BL, emit exactly one verdict:

```
BL-NNN: PROMOTE — <one-line reason>
BL-NNN: WAIT — <one-line reason>
```

Discipline:

- **Default to WAIT.** Only emit `PROMOTE` if the BL has a clear actionable shape. Vague, exploratory, duplicative, or already-blocked BLs are `WAIT`.
- **Thin-BL fallback**: if a BL has empty body or fewer than ~20 words of substance below the frontmatter, emit `BL-NNN: WAIT — insufficient info; flesh out before promoting`. This prevents LLM judgment from degenerating into noise on stub BLs.
- **No middle states.** No "MAYBE", no "INTERESTING", no rankings. Two outcomes, deterministic phrasing.
- **Stable sort**: order candidates by `created` ascending (oldest first), tie-break by `id` ascending. Output stays stable across runs at scale.

After the per-BL verdicts, group active features below by `theme:` tag — situational awareness ("here's what we already have running before you add more").

When backlog is empty (or all candidates filter out): `(a) Promote candidates: inbox is empty.`

### (b) Dependency analysis

Render a 5-column table over `.ae/features/active/`:

| feature_id | status | depends_on | blocked_by (active) | ready? |

- `depends_on`: comma-separated list from frontmatter (normalized to list per Reader contract).
- `blocked_by (active)`: subset of `depends_on` whose target is also still in `features/active/` (i.e., not yet `done`). Empty list = nothing blocking.
- `ready?`: one of three values:
  - `YES` — `blocked_by (active)` is empty AND the feature is not in any cycle.
  - `NO` — has active blockers, but no cycle (sequential block; will become ready when blockers complete).
  - `CYCLE` — feature participates in a `depends_on` cycle (deterministic detection: SCC size > 1 in the active-features subgraph, or self-dependency). Distinct from `NO` because cycles never resolve without intervention; the user must edit `depends_on` to break them.

Below the table, surface three derived signals — emit only when non-empty:

- **Deadlocks**: list cycle participants from the SCC analysis. `⚠ Cycle: F-NNN ↔ F-MMM` (or for longer cycles: `F-A → F-B → F-C → F-A`).
- **Critical path**: longest chain in the active-features dependency DAG starting from a READY feature and extending through any active descendants (NOT "all nodes READY" — only the start node must be READY; downstream nodes are intentionally not yet ready, that's the point). Helps the user pick what to start now so the most downstream work unblocks. Render as `F-A → F-B → F-C (length 3)`. Tie-break: longest first, then lexicographic feature-id ascending.
- **Orphans**: features with no `depends_on` and not referenced by any other feature's `depends_on`. List as `F-NNN, F-MMM` — these are independently startable.

When no active features exist: `(b) Dependency analysis: no active features.`

### (c) Sizing aggregate

For each active feature, read frontmatter `size:`. Valid values are T-shirts: `XS / S / M / L / XL`. Internal mapping (used only for total-range estimate display, not for any sprint math):

| T-shirt | Approx. effort | Lower bound | Upper bound |
|---|---|---|---|
| XS | < 1 day | 0.5d | 1d |
| S | 1 day | 1d | 2d |
| M | 2–3 days | 2d | 3d |
| L | ≈ 1 week | 4d | 7d |
| XL | > 1 week | 7d | 15d |

(Approximations only. NOT "Shape Up appetite" — that label was a misnomer in earlier drafts. T-shirt sizing is a generic agile relative-effort heuristic, not a fixed Shape Up commitment.)

Output:

```
Active features by size:
  XS: <count>
  S:  <count>
  M:  <count>
  L:  <count>
  XL: <count>
  unsized: <count>

Total estimated effort (sized only): <lower-sum>d – <upper-sum>d

Unsized features: F-NNN, F-MMM
```

#### Size reconciliation rule

`ae:roadmap` does **NOT** propose new sizes during the default read. The values in feature `index.md` frontmatter are authoritative — they were set by `ae:analyze` at promote time and confirmed by the user.

If the user wants `ae:roadmap` to re-propose sizes (e.g., a feature has grown in scope), pass `--resize`. That triggers an interactive re-propose flow per feature (read current size, propose new, ask user to accept/adjust). Existing values still win unless the user explicitly accepts the new proposal — overwrite is never silent.

### (d) Archive prompt

For each `.ae/roadmaps/active/<name>.md`:

1. Find features that link to this roadmap: scan `features/{active,done,abandoned}/*/index.md` with frontmatter `roadmap: <name>` (string match). All three subdirs are inspected — abandoned features are still linked features, just terminal-state.
2. **Archive-ready** condition (all must hold):
   - At least one linked feature exists in `features/done/` (otherwise there's nothing actually shipped — don't archive a roadmap that produced no completed work).
   - No linked feature is in `features/active/` (i.e., no still-active work).
   - Linked features in `features/abandoned/` are tolerated (terminal state — they don't block archive). Their count is reported alongside done count for transparency.

   When both hold, surface:

   ```
   📦 Roadmap "<name>" — <D> features done, <A> abandoned, 0 active. Archive to roadmaps/done/?
   ```

3. On user confirmation: `mv .ae/roadmaps/active/<name>.md .ae/roadmaps/done/<name>.md`, prepend `archived: YYYY-MM-DD` to the file's frontmatter, leave body untouched.

Multiple ready-to-archive roadmaps → present them as a list and let the user confirm one at a time (or `all`).

#### Orphan-link surfacing (correctness signal)

Two structural problems are also surfaced here when present (warn-only, not a refusal):

- **Broken link**: a feature has `roadmap: <name>` but no `roadmaps/active/<name>.md` or `roadmaps/done/<name>.md` exists. List the offending features. Likely cause: typo in feature frontmatter, or roadmap was deleted instead of archived.
- **Orphan roadmap**: a `roadmaps/active/<name>.md` exists but no feature links to it. Likely cause: roadmap was created speculatively and never populated, or all linked features were renamed/abandoned.

Both surface as `⚠ <description>` lines. Do not auto-fix — user decides whether to fix the feature frontmatter, delete the roadmap, or rename.

When no active roadmap is fully done AND no orphan signals: `(d) Archive prompt: no roadmaps ready to archive; no orphan links.`

## Subcommands

The default invocation (no args) is read-only — covers the four sections above. Two flags modify the read; one subcommand performs an explicit write.

### `/ae:roadmap --resize`

Interactive re-sizing flow per active feature. For each feature, show the current size + propose a new one (LLM-judged based on `analysis.md` + plan complexity if a plan exists). User accepts, adjusts, or skips. Writes only on accept.

### `/ae:roadmap --legacy`

Includes top-level `.ae/roadmaps/v*.md` files (the pre-GTD version-grouped roadmaps) as informational context only.

**Anti-poisoning rule** (critical — prevents the LLM from re-suggesting historical BLs as current candidates): legacy content is rendered in a clearly-marked block, NOT mixed into section (a)'s candidate-judgment context. Format:

```
--- LEGACY ROADMAPS (read-only historical context, NOT promote candidates) ---
[v0.8.1.md title + theme + closed-status only — DO NOT inline the body's `## Items` table]
[v0.8.2.md ...]
--- END LEGACY ---
```

The LLM judging section (a) MUST treat anything inside the legacy block as `READ_ONLY_HISTORICAL_CONTEXT` — never as a candidate source. If a BL-ID appears in a legacy `## Items` table but is no longer in `.ae/backlog/`, it is **already disposed** (shipped, dropped, or migrated) and must not be surfaced. No subcommands operate on legacy files.

### `/ae:roadmap archive <name>` *(non-interactive form of section (d))*

Archive a roadmap by name without going through the prompt. Refuses if any linked feature is still in `features/active/` — error: `Roadmap "<name>" has open features: F-X, F-Y. Cannot archive.`

## Non-goals

- **No promote action.** Surfacing candidates is Clarify; the actual BL → feature promotion is `/ae:analyze BL-NNN` (Organize). `ae:roadmap` never moves files in the backlog or creates feature dirs.
- **No sprint primitive.** No `plan` / `close` / `move` / `add` / `remove` subcommands, no `v<X>.<Y>.<Z>` directories. The legacy version-grouped model was superseded by GTD; legacy files stay in place but aren't read by default.
- **No size proposal in default read.** Default invocation only aggregates and reports existing sizes. `--resize` is an explicit, interactive flow.
- **No retrospective analysis.** That's `/ae:retrospect` (project-level long-cycle Reflect). `ae:roadmap` is short-cycle orientation.
- **No deep code reading.** Reads frontmatter + directory layout only. For codebase-grounded research on a candidate, run `/ae:analyze`.

## Principles

- **Deterministic structure, qualitative judgment.** Sections (b)/(c)/(d) are mechanical reads. Section (a) uses LLM judgment per BL — there is no scoring threshold to game.
- **Reader-tolerant** per CLAUDE.md schema contract. Unknown fields silently ignored; unknown enum values warned + skipped from enum-dependent workflows; missing required fields logged as errors but don't abort the run.
- **Authoritative values stay authoritative.** Feature `size:` and `depends_on:` values are written by `ae:analyze` and confirmed by the user. `ae:roadmap` aggregates and surfaces; it never silently rewrites.
- **Lightweight.** No agent teams, no cross-family proxies. Fast single-pass read.
