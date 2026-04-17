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

For each `.ae/roadmaps/v*.md` file (or `<output.roadmaps>` if configured):
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

Cycle detection: during Blocked column computation, if the `blocked_by:` traversal forms a cycle, render the cycle participants with an `⚠ cycle detected` annotation and do NOT recurse (per Invariant 1 cycle rule).

Other columns for unscheduled items + completed sprints render in the standard cluster view below the board.

## v2 Schemas (Agile/Scrum port)

The following schemas land in Plan 039-a and are consumed by ae:roadmap v2 operations (rendering, `plan`/`close` subcommands, Layer 2 velocity math).

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
<!-- Churn log; user-owned. Structured bullets (recommended) for retrospect scans: -->
- 2026-04-20 | add | BL-029 | cross-family measurement was a gate condition, missed in planning
```

Body sections:
- `## Theme` — user-owned. 1-line sprint goal. ae:roadmap renders from frontmatter `theme:` initially; user may expand inline.
- `## Gate` — user-owned. Definition of Done. ae:roadmap renders from frontmatter `gate:` initially; user may expand.
- `## Items` — ae:roadmap managed. Regenerated from `.ae/backlog/<version>/` directory contents on every ae:roadmap run. User must NOT hand-edit; next run overwrites.
- `## Notes` — user-owned. Sprint churn log. Structured bullets recommended (`YYYY-MM-DD | action | BL-ID | reason`) for future retrospect scans.

### Invariants (non-negotiable)

1. **Directory IS sprint membership**. ae:roadmap reads BOTH frontmatter AND directory path for classification: `v*/` = active sprint, `done/v*/` = archived, `unscheduled/` = product backlog, `closed/` = discarded.
2. **Body `## Items` is ALWAYS auto-regenerated** from the sprint directory on every `/ae:roadmap` run. User edits to that section are overwritten on next run. This eliminates stale-doc-vs-live-directory drift.
3. **Commitment snapshot lives in roadmap doc frontmatter** — `committed_at:`, `initial_items: [...]`, `initial_points: N`. Written once at `/ae:roadmap plan <version>` time, NEVER modified after. Items moved mid-sprint do NOT update this snapshot.
4. **Scope-creep math reads `initial_items` frontmatter**, NOT the body `## Items` section. Body is for humans; frontmatter is for machines. Diff: `Set(frontmatter.initial_items) XOR Set(ls .ae/backlog/<version>/)`.

## Principles

- **Deterministic**: same input → same output. No LLM randomness in clustering.
- **Read-only by default**: reads pipeline metadata + BL frontmatter, produces text output. Write operations (`plan`/`close`/`move`/etc.) are explicit subcommands with their own spec sections.
- **Metadata-only + directory-aware**: reads frontmatter (tags, dates, status, cross-refs) AND directory path (for sprint classification). Does NOT read discussion body content, plan step detail, or project source code. For deep analysis, use `/ae:analyze`.
- **Lightweight**: no agent teams, no cross-family proxies. Fast single-pass over frontmatter data + directory listings.
- **Opinionated but not rigid**: suggests sequencing and version boundaries, user decides.

> **Validation**: Tested on 32-feature corpus (AE plugin, 2026-04-09), produces 9 clusters:
> Agent-Teams (6), Autonomy (5), Pipeline (5), Uncategorized (4), Dashboard (3), Testing (3), Cross-Family (2), Hooks (2), Test-Plugin (2).
> Max cluster = 18.8% (under 60% cap). All clusters semantically coherent. Singleton merge step was added after initial run produced 16 clusters (too fragmented).
