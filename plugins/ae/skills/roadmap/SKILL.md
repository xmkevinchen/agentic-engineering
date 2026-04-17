---
name: ae:roadmap
description: Analyze project features, cluster by themes, propose sequencing and version boundaries
user_invocable: true
effort: medium
---

# /ae:roadmap — Feature Roadmap Analysis

Proactively analyze project features, cluster them by shared themes, propose execution sequencing, and suggest version boundaries.

**Not a viewer** — this skill actively analyzes pipeline metadata and produces strategic recommendations. For current status, use `/ae:dashboard`. For deep codebase research, use `/ae:analyze`.

## Pre-check

1. Confirm `.claude/pipeline.yml` exists
   - Missing → output: `No pipeline.yml found. Run /ae:setup to configure your project.` Stop.
2. Read `output.*` paths from pipeline.yml. Use defaults if not specified:
   - `output.discussions` (default: `docs/discussions/`)
   - `output.plans` (default: `docs/plans/`)
   - `output.backlog` (default: `docs/backlog/`)

## State Reading

Read all pipeline metadata. This skill reads structured frontmatter AND directory path (for sprint classification, per v2 Invariant 1). It does NOT read body content of discussions/plans or run code.

### Discussions

For each subdirectory in `output.discussions`:
1. Read `index.md` frontmatter: `id`, `title`, `status`, `tags`, `created`, `pipeline.*`, `plan`
2. Skip directories without `index.md`

### Plans

For each `.md` file in `output.plans`:
1. Read frontmatter: `id`, `title`, `status`, `discussion`, `created`
2. Count checkboxes: `- [x]` (done) vs `- [ ]` (pending)

### Backlog (v2 — path-aware)

Traverse subdirectories of `output.backlog`. Each subdirectory name determines the item's scope classification (per Invariant 1):

| Subdir pattern | Classification | Read? |
|----------------|---------------|-------|
| `v<X>.<Y>.<Z>/` (e.g., `v0.9.0/`) | **Active sprint** (committed work) | Yes — default view |
| `unscheduled/` | **Product backlog** (not yet committed) | Yes — default view |
| `done/v<X>/` | **Archived** (shipped in version X) | Read only when velocity / history queries run; excluded from default view |
| `closed/` | **Discarded** (not shipped) | Read only on explicit `--include-closed`; excluded from default view |
| `BL-*.md` at root (pre-migration layout) | **Legacy flat** | Read with warning — suggest running `/ae:roadmap bootstrap` to migrate |

For each `.md` file under any scope directory:
1. Read frontmatter: `id`, `title`, `status`, `priority`, `size`, `blocked_by` (if present)
2. Record the item's scope (from parent dir name) alongside its frontmatter

### Roadmaps (v2)

For each `.ae/roadmaps/v*.md` file (path is fixed at `.ae/roadmaps/` — internal state, not configurable via pipeline.yml, same as `.ae/backlog/` being internal):
1. Read frontmatter: `version`, `committed_at`, `initial_items`, `initial_points`, `theme`, `gate`, `closed` (optional)
2. Classify: non-empty `closed:` → archived sprint; absent → active sprint
3. Determine **current version** deterministically:
   - List all active (non-closed) roadmap docs
   - Zero matches → no current version
   - Exactly one → that's current
   - Multiple (rare, but possible when user pre-plans future sprints) → pick lowest semver version as current (earliest-actionable sprint is most relevant; prevents tiebreaker ambiguity)

### Graceful Handling
- Directory missing → skip, note in output
- File missing frontmatter → skip
- No discussions found → output: `No features found. Start with /ae:discuss.` Stop.
- Pre-migration flat backlog detected → output warning + hint: `⚠ Flat backlog layout detected. Run /ae:roadmap bootstrap to migrate to sprint structure.`

## Clustering Algorithm

Deterministic algorithm — produces identical output for identical input.

### Step 1: Build Tag Frequency Table

Count how many discussions use each tag across ALL discussions (including done/concluded).

### Step 2: Identify Stop-Words

Tags appearing in >50% of all discussions are **stop-words** — excluded from primary cluster assignment but may appear in cluster display. This prevents overly broad tags (e.g., `pipeline` if it appears in 20/33 discussions) from creating a single mega-cluster.

### Step 3: Assign Primary Cluster

For each discussion:
1. Filter the discussion's tags, removing stop-words
2. From remaining tags, find the one with the **highest global frequency** (most shared with other discussions)
3. Tie-break: first tag in the discussion's `tags:` array wins
4. This tag becomes the discussion's **primary cluster key**

Special cases:
- Discussion has tags but ALL are stop-words → assign to **Uncategorized**
- Discussion has no `tags:` field or empty array → assign to **Uncategorized**

### Step 4: Form Clusters and Merge Singletons

Group discussions by primary cluster key. Then merge singleton clusters (clusters with only 1 member):

1. For each singleton cluster, find the **largest multi-member cluster** that shares at least one tag with the singleton discussion
2. Found → merge the singleton into that cluster
3. Not found → move the discussion to **Uncategorized**

This prevents tag fragmentation from creating too many tiny clusters.

Name each cluster using the key tag, capitalized (e.g., tag `testing` → cluster "Testing").

### Step 5: Sort Within Clusters

Within each cluster, sort features by:
1. Pipeline stage priority (most actionable first):
   `work in progress` > `ready for work` > `awaiting plan` > `plan draft` > `discussing` > `analyzing` > `done`
2. Tie-break: discussion ID descending (most recent first)

## Dependency Inference

Shallow dependency detection (max 2-hop). Two edge types:

### Hard Edges (explicit cross-references)

Scan plan frontmatter `discussion:` fields. If two plans reference the same discussion, they share a dependency root.

Hard edges are labeled **"depends on"** in output.

### Soft Edges (shared cluster membership)

Discussions in the same cluster with sequential IDs (e.g., 013 → 014 → 019) may be related iterations. Sequential IDs indicate chronological creation order, not dependency order — do not infer prerequisite relationships from ID ordering alone.

Soft edges are labeled **"related to"** in output. They suggest but do not dictate sequencing.

## Version Lanes (v2 — render from roadmap docs + directories)

For each non-closed roadmap doc (from State Reading → Roadmaps), render a **version lane** as a top-level output section:

```
## Version v0.9.0 — <theme from frontmatter>
  Gate: <gate from frontmatter (first line)>
  Committed: YYYY-MM-DD (N items, M points)
  Scope delta: +K items since commitment  # if directory content differs from initial_items
  [item list rendered from .ae/backlog/v0.9.0/ contents, sorted by priority then status]
```

### Scope-delta annotation (Invariant 4)

For each version lane, compute:
```
added_after_commit = Set(ls .ae/backlog/<version>/) - Set(frontmatter.initial_items)
removed_after_commit = Set(frontmatter.initial_items) - Set(ls .ae/backlog/<version>/) - Set(ls .ae/backlog/done/<version>/)
```

Render if non-empty: `Scope delta: +K items (BL-X, BL-Y) / -L items (BL-Z bumped to v1.0.0)`. Reads `initial_items` from frontmatter, NOT the body `## Items` section.

### Legacy cluster-based suggestions (retained for unscheduled/)

The pre-v2 clustering algorithm still operates, but on `unscheduled/` items only (scheduled items have already been committed to a sprint — no re-clustering needed). Cross-cluster version suggestions now phrase as: "Theme [X] is complete across [versions] — consider a themed release milestone." This is advisory only; user decides.

## Output Format

```
🗺️ Feature Roadmap

## Theme: Testing (6 features) [4 done, 1 active, 1 backlog]
  [done]    013 ae:test-plugin base
  [done]    014 ae:test-plugin v2
  [done]    019 test-plugin Layer 2
  [done]    026 Test naming convention
  [active]  025 Test coverage gaps — discussing → /ae:discuss
  [backlog] BL-009 Test coverage gaps
  Dependency: 013 → 014 → 019 (sequential refinement)
  Status: 1 active item remaining

## Theme: Agent-Teams (5 features) [4 done, 0 active, 1 backlog]
  [done]    004 Dynamic agent selection
  [done]    023 Agent Teams degradation
  [done]    027 Agent Teams source audit
  [done]    032 CC discussions internalization
  [backlog] BL-020 Tier 1 fan-out degradation
  Status: Theme complete (backlog item deferred)

## Theme: Dashboard (3 features) [1 done, 1 active, 1 cancelled]
  [done]      028 UX Shortcuts
  [cancelled] 034 Version View (superseded by 035)
  [active]    035 Work Model — discussing → /ae:discuss
  Status: 1 active item remaining

## Uncategorized (2 features)
  ...

---
📊 Roadmap Summary

Clusters: N themes (X complete, Y in progress, Z not started)
Features: N total (A done, B active, C backlog)

💡 Version Suggestion:
  Themes "Agent-Teams" and "Governance" are complete — 
  natural candidate for v0.8.0 release (9 features).
  
🔗 Key Dependencies:
  013 → 014 → 019 (Testing chain)
  027 depends on 021 (shared discussion source)

→ Run /ae:dashboard for current pipeline status
→ Run /ae:discuss to advance active features
```

## Board View (v2)

Derived column rendering from directory + pipeline stage + `blocked_by:`. No new status field required — all state is computed.

Columns (for the **current version** as determined by Roadmaps → State Reading):

| Column | Derivation rule |
|--------|-----------------|
| Committed | Item is in `.ae/backlog/<current-version>/`, no discussion for it yet (no `.ae/discussions/*/` with matching entity) |
| Discussing | Item has a discussion with `status: active` or `pipeline.discuss: in_progress` |
| Planned | Item has a plan with `status: reviewed` and no associated review yet |
| In Progress | Item's plan has `status: reviewed` AND at least one `- [x]` step AND at least one `- [ ]` step |
| Review | Item's plan is fully `- [x]` AND has a review file with no verdict yet |
| Done | Item's frontmatter has `status: done`/`status: closed` OR is in `.ae/backlog/done/<current-version>/` |
| Blocked | Synthetic — item has `blocked_by:` field referencing any BL whose own status is NOT done/closed. Rendered alongside whatever stage column would otherwise apply (item appears in one primary column + the Blocked column annotation) |

Cycle detection: during Blocked column computation, if the `blocked_by:` traversal forms a cycle, render the cycle participants with an `⚠ cycle detected` annotation and do NOT recurse (per v2 Schemas → `blocked_by:` cycle detection rule).

Other columns for unscheduled items + completed sprints render in the standard cluster view below the board.

### Flow-health signals (v2)

Advisory warnings emitted alongside the board view. Baseline-free by design — no historical velocity needed.

**WIP overload warning** — fires when either per-column count breaches its threshold:
- `In Progress` column count > 1 (single-piece flow for active development), OR
- `Review` column count > 1 (review backlog building up), OR
- Combined `In Progress + Review` > 2 (overall flow breakdown)

Any of these three conditions emits:
```
⚠ WIP overload: <breakdown> (active: N / review: M, threshold: 1 active + 1 review). Solo-dev flow hygiene: finish before starting more.
```

Rationale (per-column matches the mental model): the intended solo-dev flow is one primary active item plus one item in review awaiting feedback. Per-column checks catch BOTH failure modes (2 simultaneously active = attention split, 2 simultaneously in review = reviewer bottleneck) that a combined `>2` check would miss (since 2+0 passes). The combined `>2` check is retained as a backstop for degenerate cases (e.g., 1 active + 2 review). `pipeline.yml` configurability for thresholds deferred to a later iteration.

**Work-item age warning** — for items in "In Progress" or "Review" columns, check the `mtime` of the item's plan file (or `git log -1 --format=%ct <plan-file>` if available and more accurate). If time since last update exceeds 7 days, emit one line per stalled item:
```
⚠ BL-<ID>: stalled (<N> days since last update).
```

Both signals are **advisory** (text output only, no block on any operation). Thresholds are hardcoded in Phase B; `pipeline.yml` configurability deferred.

Skip flow-health signals entirely if no active sprint exists (no non-closed roadmap doc).

## Release-readiness flag (R2 structural)

Advisory output emitted for each active version alongside its version lane. Structural-only — NO timing language. Discussion 039 Topic 4 established: timing language requires ≥3 archived versions with size data (Phase C velocity baseline). Until Phase C lands, R2 reports only structural readiness.

**Criteria** (both must hold for a version to be "ready"):
1. Every BL in `.ae/backlog/<version>/` has frontmatter `status:` set to `done` or `closed`
2. No BL in the sprint has an active `blocked_by:` referring to a BL whose own status is NOT done/closed

**When ready, emit** (action-cued phrasing):
```
✓ <version>: all items done, 0 open blockers. Structural release checklist is clear; next action: run `/ae:roadmap close <version>` when you choose to cut the release.
```

**When not ready, emit**:
```
<version>: <N>/<M> items done, <K> open blockers. Not ready.
```

**Forbidden**:
- No "ship now" / "release today" / date projections — these require velocity baseline (Phase C).
- No ordering across versions (e.g., "ship v0.9.0 before v1.0.0") — R2 is per-version only.

**Consumer scope** (Phase B boundary): ae:next does NOT consume R2 output. An ae:next integration ("suggest `/ae:roadmap close <version>` when R2 fires") is deferred to Phase C. R2's advisory output is visible only when user runs `/ae:roadmap` directly.

## v2 Schemas (Agile/Scrum port)

The following schemas land in Plan 039-a and are consumed by ae:roadmap v2 operations (rendering, `plan`/`close` subcommands, Layer 2 velocity math).

### Terminology: `closed/` vs `closed:` — two different things

- `.ae/backlog/closed/` (directory): DISCARDED items — items closed WITHOUT shipping (e.g., "acceptable as-is", "rejected", "obsolete"). Excluded from velocity math.
- `closed:` (roadmap doc frontmatter field): SHIPPED version marker — the roadmap doc for a version that has been shipped. Items belonging to that version live in `.ae/backlog/done/v<X>/`.

One is a sink for discarded work, the other is a timestamp on successful delivery. They never cross paths.

### `blocked_by:` — BL item dependency field

Optional frontmatter field on `.ae/backlog/BL-*.md` files. Captures hard scheduling dependency between BL items.

```yaml
---
id: BL-028
blocked_by: BL-026                  # single string
# or
blocked_by: [BL-026, BL-005]        # array of BL IDs
---
```

Rules:
- Values MUST be BL IDs referencing files that exist in `.ae/backlog/**/BL-*.md` (any subdirectory). Non-existent BL refs → ae:roadmap reports error with `file:line`.
- Free-form prose blockers (e.g., "blocked by external platform gap") stay in BL body text, NOT in `blocked_by:`. That field is machine-parseable only.
- No inverse `blocks:` field — derivable by traversal.
- Cycle detection: ae:roadmap reports cycle as error with participating BL IDs, does not hang.

### `size:` — Story point field (T-shirt)

Optional frontmatter field on BL items. Required for items in version dirs (`.ae/backlog/v*/`) when velocity math is enabled (Layer 2); optional for `unscheduled/`.

```yaml
size: M   # one of: XS | S | M | L | XL
```

Deterministic internal mapping to points (used by velocity math only):

| T-shirt | Points |
|---------|--------|
| XS | 1 |
| S  | 2 |
| M  | 3 |
| L  | 5 |
| XL | 8 |

Rules:
- ae:roadmap ABSTAINS from suggesting sizes. All available heuristics (description length, plan step count, tag cluster average) are noise. Abstaining protects against anchoring bias.
- Unsized items in a sprint dir: excluded from velocity sum with a visible once-per-run warning (not silent, not imputed).
- `size:` is required only for scheduled items when Layer 2 features are active. Phase A allows unsized items globally — velocity is Phase C/Layer 2.
- XS = 1 point (NOT 0) — prevents the anti-pattern where users under-size to keep velocity clean.

### Roadmap doc format — `.ae/roadmaps/<version>.md`

Per-version sprint planning doc, written by `/ae:roadmap plan <version>` at sprint commit time.

```yaml
---
version: v0.9.0                # required; matches the sprint dir name
committed_at: 2026-04-16       # required; date user ran /ae:roadmap plan
initial_items: [BL-022, BL-005, BL-025]   # required; BL IDs in sprint at plan time
initial_points: 10             # required; sum of size points at plan time (0 if any unsized)
theme: "Onboarding + Measurement"          # required; one-line sprint goal
gate: "Quickstart runnable by external user + cross-family metric tracked"
                                # required; Definition of Done
closed: 2026-05-01             # optional; set by /ae:roadmap close on success
---

# v0.9.0

## Theme
Onboarding + Measurement — external users install, run a pipeline loop, get a
measurable cross-family metric.

## Gate
- BL-022 quickstart complete (new user installs and runs without author help)
- Cross-family measurement baseline visible in ae:retrospect

## Items
<!-- ae:roadmap managed — do not hand-edit; regenerated from .ae/backlog/v0.9.0/ -->
| ID | Title | Priority | Size | Status | Blocked_by |
|----|-------|----------|------|--------|-----------|
| BL-022 | External user onboarding | P1 | L | open | — |
| BL-005 | Third-party agent integration | P1 | M | open | — |
| BL-025 | Retrospect user-facing | P1 | S | open | — |

## Notes
<!-- Churn log; hybrid ownership (user + tool). Structured bullets REQUIRED for tool-written entries. Format: YYYY-MM-DD | <action> | BL-ID | <reason> -->
- 2026-04-20 | add | BL-029 | cross-family measurement was a gate condition, missed in planning
```

Body sections:
- `## Theme` — user-owned. 1-line sprint goal. ae:roadmap renders from frontmatter `theme:` initially; user may expand inline.
- `## Gate` — user-owned. Definition of Done. ae:roadmap renders from frontmatter `gate:` initially; user may expand.
- `## Items` — ae:roadmap managed. Regenerated from `.ae/backlog/<version>/` directory contents on every ae:roadmap run. User must NOT hand-edit; next run overwrites.
- `## Notes` — **hybrid ownership**: user freely appends prose observations; ae:roadmap subcommands append structured action entries per the canonical action enum below. No subcommand mutates user-authored prose; subcommands append new lines only.

### Canonical action enum for `## Notes` entries

All tool-written entries use this format: `YYYY-MM-DD | <action> | BL-ID | <reason>`. `<action>` must be one of:

| Action | Producer | Meaning |
|--------|----------|---------|
| `move-in` | `move` subcommand (target side) + `add` subcommand | BL arrived in this sprint (from another sprint or from unscheduled/) |
| `move-out` | `move` subcommand (source side) | BL left this sprint for another sprint |
| `descope` | `remove` subcommand | BL returned to unscheduled/ |
| `close-scope-delta` | `close` subcommand (one line per changed item) | Per-item scope-delta snapshot at archival |

Note on `plan`: the `plan` subcommand does NOT emit Notes entries for initial items. The commitment snapshot lives in the roadmap doc's frontmatter `initial_items:` field (Invariant 3). `--gaps` Audit 2 reads `initial_items` as the baseline; Notes entries track CHURN relative to that baseline.

Note on `add`: `add BL-X <target>` is a UX-constrained alias of `move BL-X <target>` where source is locked to `unscheduled/`. Both write `move-in` to the target's `## Notes` — single vocabulary for "BL arrived in this sprint." The enum has no separate `add` action; the subcommand name differs but the logged action is `move-in`.

User-written prose entries need NOT follow this format — they are informational and are ignored by the `--gaps` validator's scope-delta audit.

`close-scope-delta` emits **one line per changed item** (not a comma-list). Each line has a single BL-ID in field 3. Example: a close that finds 2 added and 1 removed emits 3 separate `close-scope-delta` lines.

The `--gaps` Audit 2 (scope-delta) reconciles directory contents against the union of tool-written actions: `move-in - move-out - descope` should equal `current_dir - initial_items`. Unmatched deltas (changes in directory without a corresponding Notes entry, OR Notes entries with no directory evidence) surface as `warn` findings.

### Invariants (non-negotiable)

1. **Directory IS sprint membership**. ae:roadmap reads BOTH frontmatter AND directory path for classification: `v*/` = active sprint, `done/v*/` = archived, `unscheduled/` = product backlog, `closed/` = discarded.
2. **Body `## Items` is ALWAYS auto-regenerated** from the sprint directory on every `/ae:roadmap` run. User edits to that section are overwritten on next run. This eliminates stale-doc-vs-live-directory drift.
3. **Commitment snapshot lives in roadmap doc frontmatter** — `committed_at:`, `initial_items: [...]`, `initial_points: N`. Written once at `/ae:roadmap plan <version>` time, NEVER modified after. Items moved mid-sprint do NOT update this snapshot.
4. **Scope-creep math reads `initial_items` frontmatter**, NOT the body `## Items` section. Body is for humans; frontmatter is for machines. Diff: `Set(frontmatter.initial_items) XOR Set(ls .ae/backlog/<version>/)`.

## Subcommands (v2)

Write operations on backlog state and roadmap docs. All subcommands are explicit — default `/ae:roadmap` with no args stays read-only.

### `/ae:roadmap plan <version>`

Create a sprint. Moves selected items from `unscheduled/` into `v<X>/` and writes the roadmap doc with frozen commitment snapshot in frontmatter.

**Interactive mode** (default, no flags):
1. Parse version arg (e.g., `v0.9.5`). Refuse if `.ae/roadmaps/<version>.md` already exists — output: `Roadmap doc for <version> already exists. Use move/add (Phase B) or manual edit.`
2. Create `.ae/backlog/<version>/` directory if absent.
3. Use `AskUserQuestion` multi-select: "Which unscheduled items belong to <version>?" Display each with `priority`, `size`, `blocked_by` status.
4. `mv` selected items from `unscheduled/` to `<version>/` (plain `mv` — `.ae/` is gitignored).
5. Prompt for Theme (single line, required). Prompt for Gate (multiline — Definition of Done, required).
6. Write `.ae/roadmaps/<version>.md` per schema (see v2 Schemas → Roadmap doc format).

**Non-interactive mode** (CI / automation / L1 tests — all 3 content flags required together):
```
/ae:roadmap plan <version> --items BL-007,BL-010 --theme "..." --gate "..." [--yes]
```
- `--items <comma-list>` (required): BL IDs from `unscheduled/` to commit
- `--theme <string>` (required): single-line sprint goal
- `--gate <string>` (required): Definition of Done (use `\\n` for line breaks if needed)
- `--yes` (optional): skip the final confirmation prompt
- If any required flag is missing: refuse with `Non-interactive mode requires --items, --theme, --gate. Omit all to use interactive mode.`
- Same filesystem effects as interactive mode, but no prompts.

**Common effects (both modes)**:
- Frontmatter written: `version:`, `committed_at: <today>`, `initial_items: [<BL-IDs>]`, `initial_points:` (sum of size points; 0 if any item unsized), `theme:`, `gate:`
- Body: `## Theme` (from flag/prompt), `## Gate` (from flag/prompt), `## Items` (auto-generated table from directory), `## Notes` (empty)
- Scope-lock reminder printed: `Sprint committed with N items (M points). Mid-sprint adds/removes record to ## Notes. See Discussion 039 conclusion for discipline rules.`

**Idempotency**: if `.ae/roadmaps/<version>.md` exists, refuse. User must explicitly `rm` the doc or use Phase B commands.

**Error cases**:
- Version dir contains files but no roadmap doc → warn: `Version dir exists without roadmap doc. Creating doc for existing items.` Proceed using current dir contents as initial_items.
- BL referenced by `--items` not found in unscheduled → refuse: `BL-X not found in unscheduled/. Move it there first or check the ID.`

### `/ae:roadmap close <version>`

Close a sprint. Archives the version dir to `done/v<X>/`, annotates the roadmap doc, and finalizes.

**Steps**:
1. Parse version arg. Read `.ae/roadmaps/<version>.md`. If missing → refuse: `No roadmap doc for <version>. Run /ae:roadmap plan <version> first, or create the doc manually.`
2. **Idempotency check**: if frontmatter already has `closed: <date>` → print `Already closed on <date>. No changes made.` Exit.
3. **"Done" lookup rule** (deterministic, single-source): a BL item is considered "done" iff its own frontmatter `status:` is `done` or `closed`. This is the ONLY signal — no cross-reference to plans or reviews (adversarial Doodlestein finding: plan bodies mention BL-IDs only ~12% of the time; own-frontmatter is the only deterministic signal).
4. **Pre-check** (warn-by-default): enumerate `.ae/backlog/<version>/` items. For each item whose `status` is NOT done/closed, emit:
   ```
   ⚠ BL-NNN (status: <value>): not marked done — closing anyway.
   ```
   Close proceeds. `--strict` flag escalates to refusal, listing each not-done item. `--force` overrides `--strict`. **Rationale** (defended on close-specific merits): the conclusion's original stricter form required cross-reference validation through plans/ + reviews/ (plan done AND review done), which is fragile — real plan bodies mention BL-IDs only ~12% of the time (adversarial Doodlestein finding), and the `discussion:` → `entities:` traversal chain is inconsistent. Own-frontmatter `status:` is the single deterministic signal. Warn-by-default matches solo-dev reality: housekeeping items routinely ship without full discuss→plan→review pipeline; requiring `--force` on every close would train users to always pass it (defeating the check). `--strict` preserves hard-enforcement opt-in for projects that want it. This rationale stands on close-specific structure, NOT by analogy to T09 scope-lock (which governs mid-sprint add/remove, a different semantic).
5. **Scope-delta self-check** (audit drift BEFORE archival makes it invisible): compute `added_after_commit = Set(ls .ae/backlog/<version>/) - Set(frontmatter.initial_items)` and `removed_after_commit = Set(frontmatter.initial_items) - Set(ls .ae/backlog/<version>/) - Set(ls .ae/backlog/done/<version>/)`. For each BL in `added_after_commit` OR `removed_after_commit`, emit ONE line to the roadmap doc's `## Notes` section (single BL-ID per line — preserves the canonical format where field 3 is always a single BL-ID): `YYYY-MM-DD | close-scope-delta | BL-X | added mid-sprint, logged at close` (or `removed mid-sprint, logged at close`). This preserves the drift audit trail after the sprint dir moves to `done/v<X>/` where diff-against-initial_items would otherwise be unrecoverable.
6. **`--bump-remaining <target-version>` flag**: before the archival mv, move open items to the target version dir (`mv .ae/backlog/<version>/BL-X.md .ae/backlog/<target-version>/`). Requires target version's roadmap doc to exist (call `plan <target-version>` first). If target roadmap doc missing → refuse: `--bump-remaining target <target-version> has no roadmap doc. Run /ae:roadmap plan <target-version> first.` Each bumped item is logged to the target version's `## Notes` as a mid-sprint add.
7. **Archive the dir**: `mv .ae/backlog/<version>/ .ae/backlog/done/<version>/` (plain `mv` — `.ae/` gitignored).
7. **Annotate the roadmap doc**: append `## Closed` section with date + item list:
   ```markdown
   ## Closed
   Closed: <YYYY-MM-DD>
   Items shipped: BL-XXX, BL-YYY
   ```
8. **Set frontmatter**: `closed: <today YYYY-MM-DD>`.
9. **Retrospective (opt-in)**: if `--retro` flag is set, invoke `/ae:retrospect` scoped to this sprint and append its output as a `## Retrospective` section. Default: skip (retro overhead is disproportionate for small versions).
10. **Commit** (git-tracked files only): stage and commit any git-tracked changes (e.g., CHANGELOG.md updates). Sprint dir moves are on `.ae/` which is gitignored — no git operation for those. Message format: `"[roadmap] close <version> — N items shipped"`.
11. **Final output**: `Closed v<X> — N items shipped. Roadmap doc finalized at .ae/roadmaps/<version>.md.`

**Error cases**:
- `--strict` + open items: refuse with list: `Cannot close <version> in strict mode. Open items: BL-X (status: open), BL-Y (status: in_progress). Use --force to override, --bump-remaining <target> to move them, or mark them done first.`
- Version dir doesn't exist (roadmap doc orphaned): warn and proceed — set `closed:` frontmatter, skip the mv step. `Roadmap doc exists but no sprint dir at .ae/backlog/<version>/. Marking closed anyway; no items to archive.`

### `/ae:roadmap move <BL-ID> <target-version>`

Move a BL item between sprint dirs OR between `unscheduled/` and a sprint dir. Operates on `.ae/backlog/` via plain `mv` (gitignored).

**Flow**:
1. Locate `<BL-ID>` — search `.ae/backlog/**/BL-<ID>-*.md`. If not found → refuse: `BL-<ID> not found in backlog.`
2. Resolve `<target-version>`: must match an existing sprint dir (`.ae/backlog/v<X>/`) OR the literal string `unscheduled`. If target is a version dir and `.ae/roadmaps/<target-version>.md` doesn't exist → refuse: `Target <target-version> has no roadmap doc. Run /ae:roadmap plan <target-version> first.`
3. Same-dir check: if source and target are identical → no-op with message `BL-<ID> already in <target>.`
4. **Active-sprint scope-lock** (mid-sprint add/remove discipline): if either source or target is an ACTIVE sprint (roadmap doc exists without `closed:` frontmatter), require `--reason "..."`. Without `--reason`, refuse:
   ```
   Active-sprint move detected (<source> → <target>). Mid-sprint scope changes must be logged.
   Re-run with --reason "<why>" to proceed.
   ```
5. **Cycle check**: if the BL has `blocked_by:` and target contains the blocker (or vice versa), fall back to the v2 Schemas cycle detection rule — refuse with cycle report.
6. `mv .ae/backlog/<source>/BL-<ID>-*.md .ae/backlog/<target>/`.
7. **Log to Notes** (symmetric):
   - If source is active sprint, append to `.ae/roadmaps/<source>.md` `## Notes`: `YYYY-MM-DD | move-out | BL-<ID> | <reason>`
   - If target is active sprint, append to `.ae/roadmaps/<target>.md` `## Notes`: `YYYY-MM-DD | move-in | BL-<ID> | <reason>`
8. Output: `Moved BL-<ID>: <source> → <target>.`

### `/ae:roadmap add <BL-ID> <target-version>`

Semantic alias of `move <BL-ID> <target-version>` where source is constrained to `unscheduled/`. Convenience form that makes commit-to-sprint intent explicit in the command name.

**Behavior**: identical to `move` above, but:
- Refuses if source is NOT `unscheduled/`: `BL-<ID> is not in unscheduled/ (currently in <source>). Use /ae:roadmap move to relocate from another sprint.`
- Otherwise: same scope-lock rules apply if target is active; same `--reason` requirement.

### `/ae:roadmap remove <BL-ID>`

Move a BL from its current sprint back to `unscheduled/` (descope). Symmetric to `add`.

**Flow**:
1. Locate `<BL-ID>`. If not found → refuse.
2. If current location is already `unscheduled/` → no-op: `BL-<ID> already in unscheduled/.`
3. If current location is a sprint dir with an ACTIVE roadmap doc (no `closed:`), require `--reason "..."` (descope discipline — descope from an active sprint is as significant as a mid-sprint add).
4. `mv .ae/backlog/<source>/BL-<ID>-*.md .ae/backlog/unscheduled/`.
5. Log to source's `## Notes`: `YYYY-MM-DD | descope | BL-<ID> | <reason>`.
6. Output: `Removed BL-<ID> from <source>. Now unscheduled.`

### `/ae:roadmap size <BL-IDs> <T-shirt>`

Write a T-shirt `size:` value to one or more BL frontmatters. Refinement operation — not subject to scope-lock (sizing adjustments are not scope changes).

**Form**:
- Single: `/ae:roadmap size BL-007 M`
- Batch: `/ae:roadmap size BL-A,BL-B,BL-C M` (comma-separated, no spaces; applies same size to all)

**Flow**:
1. Parse `<T-shirt>` — must be one of XS/S/M/L/XL (case-insensitive input, normalized to uppercase for storage). Invalid → refuse: `Invalid size "<value>". Valid: XS, S, M, L, XL.`
2. For each BL-ID in the list:
   - Locate `.ae/backlog/**/BL-<ID>-*.md`. If missing → skip with warning (do not fail the whole batch): `⚠ BL-<ID> not found — skipped.`
   - Write or overwrite `size: <T-shirt>` in frontmatter. If frontmatter has no `size:` field, add it after `priority:` (or at end of frontmatter if priority is absent).
3. Silent write — no `--reason` required. Sizing is refinement, not scope change (scope-lock rules from move/add/remove do NOT apply).
4. Output summary: `Sized N items to <T-shirt>. Skipped M (not found).`

**Abstention invariant** (unchanged from Phase A): ae:roadmap NEVER suggests a size. The `size` subcommand writes user-supplied values only. No heuristic-driven size inference in Phase B. All heuristics (discussion length, plan step count, tag-cluster averages) are noise and excluded by design.

**Effect on velocity math** (forward-compatible): when Phase C velocity computation lands, `size:` values are summed per sprint to compute `initial_points`. Sizing done via this subcommand feeds directly into future velocity baseline without re-work.

### `/ae:roadmap --gaps`

Read-only structural validator. Runs four audits against the backlog + roadmap docs and reports findings by severity. No fixup logic — user runs the validator, reads findings, fixes manually.

**Motivating example** (why this exists): during Plan 039-a Phase A, BL-023 and BL-024 — both shipped in v0.8.1 per CHANGELOG.md — were misclassified into `.ae/backlog/closed/` (the "discarded, not shipped" tier) instead of `.ae/backlog/done/v0.8.1/` (the "shipped" tier). The migration step's pre-commit gate checked file counts and frontmatter validity but NOT semantic alignment against authoritative sources. The misclassification would have poisoned Phase C velocity baseline (v0.8.1 appearing as 0 items shipped). This escape class is exactly what the four audits below are designed to catch.

**Four audit types**:

1. **Semantic classification audit** — for each BL in `.ae/backlog/done/v<X>/` or `.ae/backlog/closed/`, classify by the 2×2 matrix below. Severity is deterministic (no "partial match" judgment call):

**Location × Evidence severity matrix**:

| Location | `status:` frontmatter | CHANGELOG v<X> mentions BL | Severity + rationale |
|----------|----------------------|---------------------------|----------------------|
| `done/v<X>/` | `done` or `closed` | yes | **pass** — coherent shipped item |
| `done/v<X>/` | `done` or `closed` | no | **warn** — CHANGELOG gap (shipped but not documented in that version; common for post-bump commits) |
| `done/v<X>/` | `open` or missing | yes | **error** — status mismatch (CHANGELOG claims shipped, frontmatter says open; likely user error) |
| `done/v<X>/` | `open` or missing | no | **error** — misclassification (in shipped tier but no evidence of shipment; the Phase A P1 escape class) |
| `closed/` | any | no | **pass** — coherent discarded item |
| `closed/` | any | yes | **error** — misclassification (in discarded tier but CHANGELOG claims shipped; the Phase A P1 escape class in its original form) |
| `closed/` | any | no, but body references shipped commit/version in prose | **warn** — possible misclassification (body prose unreliable; requires user review) |

CHANGELOG.md absent → semantic classification audit skips silently with one `info` line (same as before).

2. **Scope-delta audit** — for each non-closed `.ae/roadmaps/v*.md`, compute `added_after_commit = Set(ls .ae/backlog/<version>/) - Set(frontmatter.initial_items)` and `removed_after_commit = Set(frontmatter.initial_items) - Set(ls .ae/backlog/<version>/) - Set(ls .ae/backlog/done/<version>/)`. Reconcile against the canonical action enum in `## Notes`: `add` and `move-in` entries should account for `added_after_commit`; `move-out` and `descope` entries should account for `removed_after_commit`. Report **unmatched** deltas (directory change without a corresponding Notes entry in the canonical enum) with severity `warn`. Matched deltas are acceptable churn and NOT flagged. Severity: `warn` for unmatched.

3. **Orphan BL-ref audit** — grep BL-IDs in `.ae/discussions/*/conclusion.md` + `.ae/plans/*.md` body. For each referenced ID, flag if no `.ae/backlog/**/<ID>-*.md` file exists. Severity: `warn`. ID-range filter: skip IDs more than 20 above the current max BL ID (suppresses pre-current-numbering mentions like BL-072).

4. **Frontmatter integrity audit** — for each roadmap doc, verify required fields: `version`, `committed_at`, `initial_items`, `initial_points`, `theme`, `gate`. Missing fields → severity `error`. Extra unknown fields → severity `info`.

**CHANGELOG.md parse contract**:
- Version header regex: `^## v[0-9]+\.[0-9]+\.[0-9]+` (matches `## v0.8.0`, `## v0.8.1`, etc.). Fallback regex: `^## \[?[0-9]+\.[0-9]+\.[0-9]+\]?` for bracket-style changelogs.
- BL-ID appearance rule: exact word match on `BL-[0-9]+` regex within the version's section body (from the version header to the next `##` at level 2). Substring matches inside words (e.g., `BBL-123`) are rejected.
- Missing CHANGELOG.md → semantic classification audit skips silently, emits one `info` line: `CHANGELOG.md not found; semantic classification audit skipped.`

**Output format**:
```
🔍 /ae:roadmap --gaps — structural validator

[error] semantic-classification: .ae/backlog/closed/BL-023-*.md — body references "shipped v0.8.1" but located in closed/ (discarded tier). CHANGELOG.md v0.8.1 section mentions BL-023. Should be in done/v0.8.1/.
[warn]  scope-delta: .ae/roadmaps/v0.9.0.md — committed {BL-022, BL-005} but current dir contains {BL-022, BL-005, BL-027}. Added: BL-027. No matching `add` or `move-in` entry in ## Notes (canonical action enum unmatched).
[info]  frontmatter: .ae/roadmaps/v0.8.2.md — extra field `legacy_id` (unknown).

Summary: 1 error, 1 warn, 1 info across 3 findings.
```

**Read-only invariant**: `--gaps` MUST NOT mutate any files. All findings reported to stdout only. Fixup is explicitly the user's responsibility (auto-fix deferred to a later phase — out of Phase B scope).

## Principles

- **Deterministic**: same input → same output. No LLM randomness in clustering or subcommand logic.
- **Read-only by default**: default `/ae:roadmap` (no subcommand) reads pipeline metadata + BL frontmatter and produces text output only. Write operations (`plan`/`close`/`move`/etc.) are explicit subcommands with their own spec sections.
- **Metadata-only + directory-aware**: reads frontmatter (tags, dates, status, cross-refs) AND directory path (for sprint classification). Does NOT read discussion body content, plan step detail, or project source code. For deep analysis, use `/ae:analyze`.
- **Lightweight**: no agent teams, no cross-family proxies. Fast single-pass over frontmatter data + directory listings.
- **Opinionated but not rigid**: suggests sequencing and version boundaries, user decides.

> **Validation**: Tested on 32-feature corpus (AE plugin, 2026-04-09), produces 9 clusters:
> Agent-Teams (6), Autonomy (5), Pipeline (5), Uncategorized (4), Dashboard (3), Testing (3), Cross-Family (2), Hooks (2), Test-Plugin (2).
> Max cluster = 18.8% (under 60% cap). All clusters semantically coherent. Singleton merge step was added after initial run produced 16 clusters (too fragmented).
