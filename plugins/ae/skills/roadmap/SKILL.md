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

- **Already-promoted BLs**: scan `origin_bl:` across `.ae/features/{active,done,abandoned,paused}/*/index.md`. Treat both scalar (`origin_bl: BL-042`) and list (`origin_bl: [BL-042, BL-051]`) forms — any BL-ID appearing in any feature's `origin_bl` is excluded. Multi-BL consolidation: even if a BL is only one of several IDs in a feature's `origin_bl` list, it is considered promoted and must be suppressed (no zombie partial-promotion suggestions).
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

When backlog is empty (or all candidates filter out): `(a) Promote candidates: inbox is empty. Run /ae:backlog "<one-line idea>" to capture something — frictionless inbox drop, classification later.`

#### Batch-approval block (when ≥ 1 PROMOTE verdict was emitted)

When the verdict pass produced one or more PROMOTE verdicts, append a structured approval block after the verdicts and run a 2-step interactive approval flow before continuing to section (b). This bridges `/ae:roadmap` Clarify-output to `/ae:analyze` Organize-execution without the user having to manually copy BL-IDs.

**Per-BL field collection** (mechanical pre-LLM step): for each PROMOTE BL, read its body. Pull `size:` if frontmatter has it (mark `[frontmatter]`); else prepare a placeholder for LLM inference (mark `[inferred]`). Pull explicit `depends_on:` if present (mark `[frontmatter]`). LLM-infer order + missing size + missing deps from BL bodies. *(Implementation note, not a spec constraint: typical small N — 2–5 PROMOTE candidates — fits comfortably in a single LLM pass; if N grows large or BL bodies are dense, fallback to per-BL inference is acceptable. The block format below is the contract; batching shape is not.)*

**Approval block format** (deterministic — L1 fixtures grep for these literal anchors):

```
/ae:roadmap → PROMOTE candidates (N)
─────────────────────────────────────────────────────────────────────
Items will run in the order shown. To override: drop a BL from this batch and
re-run /ae:roadmap with explicit depends_on: frontmatter on the affected BL/feature.
─────────────────────────────────────────────────────────────────────
 1. BL-NNN Title (truncated to ~55 chars) Size: <T> [<provenance>]
            Depends on: F-MMM [<provenance>] ← only when non-empty
            Order reason: <one line> ← only when LLM-inferred AND non-trivial
 2. ...
─────────────────────────────────────────────────────────────────────
```

Title column truncated to ~55 chars (use `…` ellipsis if longer). Size on the title line; deps and order-reason on continuation lines, both elided when not applicable. Separator lines load-bearing — they signal "this is a gate, not a status message". Provenance tag is exactly `[frontmatter]` or `[inferred]` (no other variants; deterministic literal is the L1-testable signal). The visible-order-equals-execution-order escape-hatch line above the BL list is required: it documents the correction path for users who notice wrong inferred order.

**Step A — initial approval prompt**: after rendering the block, call `AskUserQuestion` with three options (single-select):

- `Approve all` — proceed to post-approval execution with the displayed BL list
- `Remove some` — go to Step B
- `Cancel (nothing will be promoted)` — exit the batch flow with zero `/ae:analyze` invocations. The full disambiguating label `Cancel (nothing will be promoted)` is required on first display so the user can't conflate batch-cancel with per-BL drop.

**Step B (only if `Remove some` chosen)** — drop-some flow:

1. `AskUserQuestion` with `multiSelect: true`. Options = list of displayed BLs, all pre-checked. The user unchecks BLs to drop from the batch.
2. After the multi-select returns a (possibly reduced) list, render the revised list in the same approval-block format above and call `AskUserQuestion` with two options:
   - `Approve [N kept]` — proceed with the kept subset
   - `Cancel (nothing will be promoted)` — exit with zero `/ae:analyze` invocations

**Post-approval execution** (the "loop" — produces no new TUI; just streams completion lines): for each accepted BL in displayed order, invoke `/ae:analyze BL-NNN` with the spawn-prompt augmented by a `PRE_APPROVED_VALUES` block. The block format defined here is canonical; `/ae:analyze` consumes it per its `analyze/SKILL.md` "Pre-approved values input" subsection (parser side, references this format, does not redefine it).

**Canonical `PRE_APPROVED_VALUES` block format** (Step 1 owns this spec; Step 2 in `/ae:analyze` references it):

```
---PRE_APPROVED_VALUES---
size: <XS | S | M | L | XL>
depends_on: <F-NNN | F-NNN, F-MMM | none>
---END_PRE_APPROVED_VALUES---
```

Both `size:` and `depends_on:` together are the typical case; only one of the two is also valid (the missing field falls through to `/ae:analyze`'s normal interactive prompt). Value `none` for `depends_on` means "explicitly no dependencies" and skips the prompt without writing the field. Sentinels `---PRE_APPROVED_VALUES---` / `---END_PRE_APPROVED_VALUES---` delimit the block to give `/ae:analyze`'s parser a deterministic anchor; the block must not appear elsewhere in the spawn prompt.

For each invocation, log a per-BL completion line: a concise format showing index/total + BL-ID + status (TL chooses exact wording — recommend `[i/N] /ae:analyze BL-NNN — <running|done|failed>` style; exact string not contract).

On Cancel-all → no `/ae:analyze` invocations, exit with a clear "no promotions executed (cancelled)" message (exact wording at TL's discretion).

On Ctrl-C mid-loop → harness handles termination; partial state remains as already-promoted features have their `promoted_to:` / `origin_bl:` frontmatter set; user re-runs `/ae:roadmap` to continue (next run's PROMOTE filtering naturally skips already-promoted BLs).

#### Out-of-scope edit operations

The batch-approval block intentionally does NOT support inline editing of: (a) execution order beyond `Remove`, (b) per-BL `size` override, (c) per-BL `depends_on` override. The escape hatches:

- **Order is wrong**: drop the misplaced BL via `Remove some`, run `/ae:analyze` separately for it after the batch, or re-run `/ae:roadmap` with explicit `depends_on:` frontmatter on the affected BL/feature so the deterministic ordering changes.
- **Inferred size or deps wrong**: let the batch run; edit `index.md` `size:` / `depends_on:` directly after `/ae:analyze` writes the feature dir. The post-analyze edit is one-line and trivially auditable.

The batch UI is an approval gate, not a config editor. Inline override would convert the gate into a form.

### (b) Dependency analysis

Render a 5-column table over `.ae/features/active/`:

| feature_id | status | depends_on | blocked_by (active) | ready? |

- `depends_on`: comma-separated list from frontmatter (normalized to list per Reader contract).
- `blocked_by (active)`: subset of `depends_on` whose target is still in `features/active/` OR `features/paused/` (i.e., not yet `done`). A **paused** dependency BLOCKS just like an incomplete active one — its work is suspended indefinitely, so it does NOT satisfy the dependency (F-032 D1). A `done` (or `abandoned`) target is not blocking. Empty list = nothing blocking.
- `ready?`: one of three values:
  - `YES` — `blocked_by (active)` is empty AND the feature is not in any cycle.
  - `NO` — has active/paused blockers, but no cycle (sequential block; will become ready when blockers complete — note a paused blocker won't complete until resumed).
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

#### Evaluation order (CRITICAL — applies before all other section (c) logic)

For each active feature, FIRST check `index.md` `size:`:

- **`size:` is non-empty** → feature is sized. Skip auto-eval entirely. ALSO: if `.ae/cache/auto-size.yml` has an entry for this feature, delete that entry (cleans up stale cache from manual `size:` set or interrupted `--resize`). The feature contributes to the sized count + total effort.
- **`size:` is empty / absent** → feature is unsized. Continue to cache check below.

This guard ensures stale cache entries can never display a `[cached]` line for a feature whose `size:` has been manually set in `index.md`.

#### Auto-eval for unsized features

For each unsized feature:

1. Compute current basis hash: sha256(analysis.md body + index.md body), first **16 hex chars**. Missing analysis.md → use index.md body alone, mark feature `(low-confidence — no analysis.md)`.
2. Read `.ae/cache/auto-size.yml`:
   - **Cache HIT** (entry exists for this feature AND `basis_sha` matches current hash) → reuse stored `auto_size_value`, mark `[cached]`.
   - **Cache MISS** (no entry, or hash mismatch) → invoke LLM-eval on (analysis.md + index.md body), produce T-shirt + one-line reason. Write/update cache entry with `auto_size_value`, `basis_sha`, `computed_at: <today>`. Mark `[evaluated]`.
3. Cache file schema (`.ae/cache/auto-size.yml`):
   ```yaml
   # Auto-size cache for /ae:roadmap. Read+written by ae:roadmap only.
   # Reader-tolerant: missing file = empty cache; corrupted file = log warn + treat as empty.
   features:
     F-NNN:
       auto_size_value: M
       auto_size_reason: "single-skill SKILL.md edit, no agent changes" # required for cache HIT to compose [cached] output line
       basis_sha: "a3f7b1e8c2d09b4f" # 16 hex chars (sha256 prefix)
       computed_at: 2026-05-07
   ```
   The `auto_size_reason` field is required: cache HIT must produce `F-NNN → <T-shirt> (~<range>) — <reason> [cached]` per the output format below, so the reason is part of the cacheable LLM output (not just the T-shirt classification).
4. `.ae/cache/` is gitignored under the existing `.ae/` blanket per CLAUDE.md gitignore policy. No per-subdir override needed.
5. Corrupted/malformed cache file → log warning, treat as empty (re-evaluate everything).
6. **Iteration scope**: section (c)'s eval-order guard iterates ONLY `features/active/`. Cache entries for features that transitioned to `done/` or `abandoned/` since their last `/ae:roadmap` run are NOT visited and NOT cleaned by the eval-order guard. They accumulate in `.ae/cache/auto-size.yml` indefinitely. Acceptable for typical project scale (few-dozen features) — the cache file is gitignored and stale entries do no harm beyond a few KB of dead state. Cleanup is opportunistic only (if a previously-archived feature is restored to `active/`, the eval-order guard will visit it normally). Explicit cache-prune subcommand intentionally NOT added — re-file as backlog if the dead-state class becomes painful at scale.

#### Output

```
Active features by size:
  XS: <count>
  S: <count>
  M: <count>
  L: <count>
  XL: <count>

Auto-sized this run:
  F-NNN → S (~1d) — <one-line LLM reason> [cached]
  F-MMM → M (~2-3d) — <one-line LLM reason> [evaluated]

Total estimated effort (sized + auto-sized): <lower-sum>d – <upper-sum>d

To persist auto-sized values to frontmatter, run /ae:roadmap --resize.
```

The `[cached]` vs `[evaluated]` annotation is REQUIRED — it's the deterministic signal that AC5 fixtures grep for. When all features are sized (no auto-eval needed), omit the `Auto-sized this run:` section entirely (no `unsized: 0` line either).

#### Size reconciliation rule

Two invariants:

1. **Existing `size:` always wins.** `ae:roadmap` never overwrites `index.md` `size:` automatically. Auto-eval ONLY runs for features whose `size:` is empty/absent.
2. **Auto-eval is display-only by default.** Section (c) computes + caches + displays auto-sized values, but does not write them to feature `index.md` frontmatter. The persist path is `--resize` (see Subcommands). When the user accepts an auto-sized value via `--resize`, the cache entry is deleted (its `auto_size_value` is copied to `index.md` `size:`).

Authoritative values stay authoritative; `--resize` is the explicit accept path.

### (d) Archive prompt

For each `.ae/roadmaps/active/<name>.md`:

1. Find features that link to this roadmap: scan `features/{active,done,abandoned,paused}/*/index.md` with frontmatter `roadmap: <name>` (string match). All four subdirs are inspected — abandoned + paused features are still linked features (terminal / suspended). A paused linked feature does NOT block roadmap archive, but the archive summary reports it, flagging any paused feature that blocks an active feature (F-032 D5).
2. **Archive-ready** condition (all must hold):
   - At least one linked feature exists in `features/done/` (otherwise there's nothing actually shipped — don't archive a roadmap that produced no completed work).
   - No linked feature is in `features/active/` (i.e., no still-active work).
   - Linked features in `features/abandoned/` are tolerated (terminal state — they don't block archive). Their count is reported alongside done count for transparency.
   - Linked features in `features/paused/` are tolerated (non-terminal, suspended — they don't block archive, per F-032 D5). Their count is reported, AND any paused feature that blocks an active feature's `depends_on` is flagged with a `⚠` line (see template).

   When both hold, surface:

   ```
   📦 Roadmap "<name>" — <D> features done, <A> abandoned, <P> paused, 0 active. Archive to roadmaps/done/?
   ⚠ Paused blocker: F-NNN (paused) blocks F-MMM (active) — resume or reassign deps before the blocked feature can proceed.
   ```
   The `⚠ Paused blocker:` line is emitted once per (paused feature, blocked active feature) pair, ONLY when `<P> > 0` AND some paused feature appears in an active feature's `depends_on` (F-032 D5 orphaned-blocker flag). Omit the `⚠` line entirely when no paused feature blocks an active one; `<P>` is still reported in the `📦` line whenever paused linked features exist.

3. On user confirmation: `mv .ae/roadmaps/active/<name>.md .ae/roadmaps/done/<name>.md`, prepend `archived: YYYY-MM-DD` to the file's frontmatter, leave body untouched.

Multiple ready-to-archive roadmaps → present them as a list and let the user confirm one at a time (or `all`).

#### Orphan-link surfacing (correctness signal)

Two structural problems are also surfaced here when present (warn-only, not a refusal):

- **Broken link**: a feature has `roadmap: <name>` but no `roadmaps/active/<name>.md` or `roadmaps/done/<name>.md` exists. List the offending features. Likely cause: typo in feature frontmatter, or roadmap was deleted instead of archived.
- **Orphan roadmap**: a `roadmaps/active/<name>.md` exists but no feature links to it. Likely cause: roadmap was created speculatively and never populated, or all linked features were renamed/abandoned.

Both surface as `⚠ <description>` lines. Do not auto-fix — user decides whether to fix the feature frontmatter, delete the roadmap, or rename.

When no active roadmap is fully done AND no orphan signals: `(d) Archive prompt: no roadmaps ready to archive; no orphan links.`

## Subcommands

The default invocation (no args) does not mutate user state — covers the four sections above. It writes only `.ae/cache/auto-size.yml` (gitignored, transient cache for section (c) auto-eval; never modifies feature `index.md`, plans, reviews, or roadmaps). Two flags modify the read; one subcommand performs an explicit write to user state.

### `/ae:roadmap --resize`

Interactive re-sizing flow per active feature. For each feature, show the current size + propose a new one (LLM-judged based on `analysis.md` + plan complexity if a plan exists). User accepts, adjusts, or skips. Writes only on accept.

**Cache integration**: when iterating over features, if `.ae/cache/auto-size.yml` already has an `auto_size_value` for an unsized feature, present that as the proposal (no fresh LLM call). When the user accepts (whether the cached value or an adjusted one), copy the accepted T-shirt to `index.md` `size:` AND delete the cache entry for that feature. For sized features, `--resize` proposes a fresh re-evaluation (cache is irrelevant — sized features never have cache entries per the evaluation-order guard).

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
- **Default-read auto-eval is display-only** (BL-062). Default invocation aggregates existing `size:` AND auto-evaluates unsized features for display, but never writes to feature `index.md` `size:` automatically. `--resize` is the explicit persist path. Cache state lives in `.ae/cache/auto-size.yml` (gitignored, transient) — not user state.
- **No retrospective analysis.** That's `/ae:retrospect` (project-level long-cycle Reflect). `ae:roadmap` is short-cycle orientation.
- **Limited code reading.** Reads frontmatter for promote-candidate judgment + dependency analysis + archive prompt. Section (c) auto-eval reads `analysis.md` body for unsized features (input to LLM size proposal). For codebase-grounded research beyond size estimation, run `/ae:analyze`.

## Principles

- **Deterministic structure, qualitative judgment.** Sections (b)/(c)/(d) are mechanical reads. Section (a) uses LLM judgment per BL — there is no scoring threshold to game.
- **Reader-tolerant** per CLAUDE.md schema contract. Unknown fields silently ignored; unknown enum values warned + skipped from enum-dependent workflows; missing required fields logged as errors but don't abort the run.
- **Authoritative values stay authoritative.** Feature `size:` and `depends_on:` values are written by `ae:analyze` and confirmed by the user. `ae:roadmap` aggregates and surfaces; it never silently rewrites.
- **Lightweight.** No agent teams, no cross-family proxies. Fast single-pass read.
