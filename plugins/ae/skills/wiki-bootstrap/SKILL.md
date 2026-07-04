---
name: ae:wiki-bootstrap
description: One-shot brownfield entry — build the knowledge graph over an existing feature corpus (backfill legacy fields, judge grounded candidates, lint-gate every write)
argument-hint: "[--dry-run]"
user-invocable: true
effort: medium
---

# /ae:wiki-bootstrap — Build the Knowledge Graph over an Existing Corpus

The knowledge graph normally grows incrementally — `/ae:review` writes relationship
edges when a feature archives. A project with EXISTING history has features the
incremental path will never touch: this skill is the one-shot entry that turns that
history into a graph. Re-runnable: every mechanism is idempotent.

## Flow

### 0. Corpus state check

Count nodes and edges: `ls .ae/features/{active,done,abandoned,paused}/F-*/index.md`
vs `rg -c '  - kind:' <those files>`. Features exist but edges are sparse (< ~1 edge
per 3 nodes) → proceed. Already-dense → report the counts and STOP (the incremental
path owns a live graph; a second bootstrap adds nothing). No features at all →
`Nothing to bootstrap (greenfield — the archive-time write point will build the graph as work ships).`

### 1. Mechanical backfill (deterministic)

1. `plugins/ae/bin/wiki-bootstrap.py backfill --dry-run` — show the user the summary
   (what would be written, what is unresolvable) BEFORE mutating anything.
2. If `$ARGUMENTS` contains `--dry-run` → STOP here (preview mode).
3. `plugins/ae/bin/wiki-bootstrap.py backfill` — converts legacy `origin_bl` →
   `origin` edges and `depends_on` → `relates_to` edges. The script owns ALL YAML
   surgery (newline-safe append, post-write source-line anchoring, per-node scoped
   lint with revert-on-failure). Unresolvable targets are SKIPPED and listed — carry
   them into the final report, never hand-write them.

### 2. Candidate scan (deterministic)

`plugins/ae/bin/wiki-bootstrap.py candidates` — every node-body `F-NNN` mention that
lacks an edge, as `from  target  line  snippet` rows. These are PROPOSALS, not edges.

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

`plugins/ae/bin/wiki-bootstrap.py add-edges <edges.json>` — the only write path:
line-number compensation, post-write anchor check, per-node scoped lint,
revert-on-failure. Reverted rows come back in the output — re-judge or drop them;
a reverted dangling target usually means the mentioned feature has no dir (correct
outcome: no edge).

### 4. Whole-tree gate (orphan-filtered)

`plugins/ae/bin/wiki-lint.py --root .ae/features` — the exit code will be non-zero
whenever orphans exist; that is BY DESIGN, so filter by DEFECT class:

- Any **non-orphan** DEFECT line (dangling target, bad source, enum, duplicate id,
  unparseable) → a real failure: fix (usually by removing the offending edge) and re-run.
- **`orphan node` lines** → the observation report, NOT failures. **Never invent edges for orphans** — an orphan with no grounded relationship stays an orphan. List them in
  the report; they are the honest shape of the corpus.

### 5. Index + traversal check

`plugins/ae/bin/wiki-index-gen.py` (regenerate the layered index), then spot-check the
graph is really traversable: `plugins/ae/bin/wiki-neighbors.py <a-well-connected-id>`
and `--hops 2` on one lineage — non-empty, sensible output.

### 6. Report (the user is this bootstrap's human gate)

- Edges written by class: mechanical (origin / depends_on-derived) vs judged semantic.
- Skipped/unresolvable list (from step 1) + reverted rows (from step 3).
- Surviving orphans (from step 4) — named, with "no grounded relationship found".
- The review ask: judged edges carry `written_by: batch` + a `judge` rationale noting
  user-review pending — invite the user to spot-check the semantic edges (sample the
  strongest + weakest evidence lines) and delete any they disagree with (plain
  frontmatter edit; the next lint run keeps everything else honest).

## Non-goals

- NOT the periodic batch-correction pass (that maintains a live graph; this builds one).
- NOT for greenfield projects (the archive-time write point is their path).
- Does NOT write edges for orphans, dubious mentions, or unresolvable targets — the
  graph's value is trust; sparse-and-grounded beats dense-and-noisy.
