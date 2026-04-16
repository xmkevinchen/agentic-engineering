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

Read all pipeline metadata. This skill reads structured frontmatter only — it does NOT read file content, run code, or spawn agent teams.

### Discussions

For each subdirectory in `output.discussions`:
1. Read `index.md` frontmatter: `id`, `title`, `status`, `tags`, `created`, `pipeline.*`, `plan`
2. Skip directories without `index.md`

### Plans

For each `.md` file in `output.plans`:
1. Read frontmatter: `id`, `title`, `status`, `discussion`, `created`
2. Count checkboxes: `- [x]` (done) vs `- [ ]` (pending)

### Backlog

For each `.md` file in `output.backlog`:
1. Read frontmatter: `id`, `title`, `status`, `priority` (if present)

### Graceful Handling
- Directory missing → skip, note in output
- File missing frontmatter → skip
- No discussions found → output: `No features found. Start with /ae:discuss.` Stop.

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

## Version Boundary Suggestions

For each cluster, evaluate completion:

- **All features done** (`plan status: done`, or no plan + `discussion status: concluded`) → suggest as **release candidate**: "This theme is complete — consider including in next release."
- **Mixed active/done** → show remaining work: "N of M features complete. Remaining: [list active features]."
- **All active/pending** → "Theme in progress. Earliest actionable: [most-advanced feature]."

Cross-cluster suggestion: when 2+ clusters are all-complete or near-complete, suggest bundling as a version: "Clusters [A] and [B] are both complete — natural version boundary."

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

## Principles

- **Deterministic**: same input → same output. No LLM randomness in clustering.
- **Read-only**: reads pipeline metadata, produces text output. No file writes, no state changes.
- **Metadata-only**: reads frontmatter (tags, dates, status, cross-refs). Does NOT read discussion content, plan steps, or codebase files. For deep analysis, use `/ae:analyze`.
- **Lightweight**: no agent teams, no cross-family proxies. Fast single-pass over frontmatter data.
- **Opinionated but not rigid**: suggests sequencing and version boundaries, user decides.

> **Validation**: Tested on 32-feature corpus (AE plugin, 2026-04-09), produces 9 clusters:
> Agent-Teams (6), Autonomy (5), Pipeline (5), Uncategorized (4), Dashboard (3), Testing (3), Cross-Family (2), Hooks (2), Test-Plugin (2).
> Max cluster = 18.8% (under 60% cap). All clusters semantically coherent. Singleton merge step was added after initial run produced 16 clusters (too fragmented).
