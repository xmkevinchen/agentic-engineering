---
name: ae:graph-refresh
description: Manually re-sync the knowledge graph with the corpus — backfill missed legacy fields, judge new grounded relationships, lint-gate every write. Idempotent; run whenever the graph may lag reality.
argument-hint: "[--dry-run]"
user-invocable: true
effort: medium
---

# /ae:graph-refresh — Re-sync the Knowledge Graph with the Corpus

The graph's automatic write points are narrow by design (edges are written when a
feature archives). Reality drifts past them: features ship while a write point is
missing or misfiring, legacy frontmatter fields appear without edges, relationships
get discovered in prose that no automation reads. This skill is the **manual
correction channel**: run it whenever the graph may lag the corpus — it converges
the graph to the current state, and because every mechanism is idempotent, running
it often is safe and running it on an un-graphed corpus is simply the first refresh.

## Flow

### 0. Corpus state readout

Count nodes and edges (`ls .ae/features/{active,done,abandoned,paused}/F-*/index.md`;
`rg -c '  - kind:'` over them) and report the ratio plus how many nodes have zero
edges. This is a readout, not a gate — the refresh always proceeds (no features at
all → report `nothing to refresh` and stop, the only empty case).

### 1. Mechanical backfill (deterministic, incremental)

1. `plugins/ae/bin/graph-refresh.py backfill --dry-run` — show what would be written
   (only MISSING edges: already-converted fields are skipped by (kind,id)) and what
   is unresolvable, BEFORE mutating anything.
2. If `$ARGUMENTS` contains `--dry-run` → STOP here (preview mode).
3. `plugins/ae/bin/graph-refresh.py backfill` — converts any legacy `origin_bl` /
   `depends_on` fields that still lack their `origin` / `relates_to` edges. The
   script owns ALL YAML surgery (newline-safe append, post-write source-line
   anchoring, per-node scoped lint with revert-on-failure). Unresolvable targets are
   SKIPPED and listed — carry them into the final report, never hand-write them.

### 2. Candidate scan (deterministic)

`plugins/ae/bin/graph-refresh.py candidates` — every node-body `F-NNN` mention that
still lacks an edge, as `from  target  line  snippet` rows. These are PROPOSALS, not
edges. On a repeat refresh this list is naturally short — only mentions that appeared
(or were previously rejected) since the last run.

### 3. Judge candidates (LLM — the semantic half)

For each candidate row, read the cited line (and surrounding body when the snippet is
ambiguous) and judge the relationship class:

- **Verbatim supersession** ("Supersedes F-NNN", "abandoned per F-NNN", "work moved to")
  → `kind: supersedes` (or the inverse reading of the statement).
- **Grounded relationship** (follow-up of, split out of, paired with, monitor for,
  fixes what X introduced, wave-slice of, reframed by X's dogfood)
  → `kind: relates_to` with the cited line as `source` and a one-line `evidence`.
- **Noise — REJECT, never write** (the anti-noise half of edge trust): "does not
  conflict with X" declarations, same-release-batch mentions, enumeration/list
  mentions, historical narration that names a feature without a relationship claim.
  When in doubt, REJECT — a wrong edge misleads later analysis worse than no edge.

Judged-strong rows go into a JSON list ({from, kind, target, line, evidence,
rationale}) — NEVER hand-edit index.md YAML (hand-rolled frontmatter surgery is how
files get corrupted; the script owns all writes). Feed it to:

`plugins/ae/bin/graph-refresh.py add-edges <edges.json>` — the only write path:
line-number compensation, post-write anchor check, (kind,id) idempotence, per-node
scoped lint, revert-on-failure. Reverted rows come back in the output — re-judge or
drop them; a reverted dangling target usually means the mentioned feature has no dir
(correct outcome: no edge).

### 4. Whole-tree gate (orphan-filtered)

`plugins/ae/bin/graph-lint.py --root .ae/features` — the exit code will be non-zero
whenever orphans exist; that is BY DESIGN, so filter by DEFECT class:

- Any **non-orphan** DEFECT line (dangling target, bad source, enum, duplicate id,
  unparseable) → a real failure: fix (usually by removing the offending edge) and re-run.
- **`orphan node` lines** → the observation report, NOT failures. **Never invent edges for orphans** — an orphan with no grounded relationship stays an orphan. List them in the report; they are the honest shape of the corpus.

This step is also where a MISFIRING write point surfaces: edges that should have been
written automatically but weren't show up here as zero-edge nodes or fresh candidates
— the refresh closes the gap AND the report names it, so the broken write point
itself can be fixed.

### 5. Index + traversal check

`plugins/ae/bin/graph-index-gen.py` (regenerate the layered index), then spot-check the
graph is really traversable: `plugins/ae/bin/graph-neighbors.py <a-well-connected-id>`
and `--hops 2` on one lineage — non-empty, sensible output.

### 6. Report (the user is the refresh's human gate)

- What this refresh changed: edges written by class (mechanical vs judged), vs "graph
  already in sync" when nothing was needed.
- Skipped/unresolvable list (from step 1) + reverted rows (from step 3).
- Surviving orphans (from step 4) — named, with "no grounded relationship found".
- **Write-point health**: if this refresh had to add edges an automatic write point
  should have produced, say so explicitly — that is a correction signal about the
  pipeline itself, not just missing data.
- The review ask: judged edges carry `written_by: batch` + a `judge` rationale noting
  user-review pending — invite the user to spot-check the semantic edges and delete
  any they disagree with (plain frontmatter edit; the next refresh + lint keep
  everything else honest).

## Non-goals

- NOT an unattended cron pass — a human triggers it and reviews the judged edges
  (unattended machine-verifiable-only correction is a separate, future concern).
- Does NOT write edges for orphans, dubious mentions, or unresolvable targets — the
  graph's value is trust; sparse-and-grounded beats dense-and-noisy.
- Does NOT replace the automatic write points — it corrects and converges around them.
