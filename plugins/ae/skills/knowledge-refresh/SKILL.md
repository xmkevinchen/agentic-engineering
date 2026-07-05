---
name: ae:knowledge-refresh
description: Manually re-sync the knowledge graph with the corpus — backfill missed legacy fields, judge new grounded relationships, lint-gate every write. Idempotent; run whenever the graph may lag reality.
argument-hint: "[--dry-run]"
user-invocable: true
effort: medium
---

# /ae:knowledge-refresh — Re-sync the Project Knowledge Graph with the Corpus

The graph's automatic write points are narrow by design (edges are written when a
feature archives). Reality drifts past them: features ship while a write point is
missing or misfiring, legacy frontmatter fields appear without edges, relationships
get discovered in prose that no automation reads. This skill is the **manual
correction channel**: run it whenever the graph may lag the corpus — it converges
the graph to the current state, and because every mechanism is idempotent, running
it often is safe and running it on an un-graphed corpus is simply the first refresh.

## Judgment provenance (applies to every LLM step below)

**No semantic judgment in this graph is self-judged.** The session that PRODUCES
content (proposes an edge, writes a page) never issues its own accept verdict:

- **Minimum**: a fresh-context agent, independent of the producer, judges.
- **Preferred**: a cross-family judge (codex/gemini proxy, or the local fallback
  model) — same-family review catches form, never its own confabulations.
- Degraded mode (no cross-family, no agent spawn available): the TL may judge
  solo but MUST mark every such verdict `judge: {... rationale: "same-family
  solo — degraded"}` so the next refresh re-judges them first.
- Mechanical checks (lint, page check, index) are unaffected — machines are
  family-less.

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

### 3. Judge candidates (LLM — the semantic half, independently judged)

Hand the candidate rows to the judge (per **Judgment provenance** above: fresh
agent minimum, cross-family preferred — the rows + cited lines are a small
bundle, cheap to ship). The judge reads each cited line (and surrounding body
when the snippet is ambiguous) and judges the relationship class:

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

### 3.5 Re-judge the batch stock (DEFAULT — LLM output is not settled fact)

Everything `written_by: batch` was LLM-generated and may hide judgment errors no
lint can see. A refresh therefore RE-JUDGES the batch stock every run — the same
posture the pull gate takes toward anchors, applied to semantics. `written_by:
human` is the only exemption: a human ruling is never machine-re-judged (and
`remove-edges` refuses to delete it at the script layer).

1. Enumerate batch edges: `rg -B2 -A4 'written_by: batch' .ae/features/*/F-*/index.md`.
2. Ship the batch to an independent judge (per **Judgment provenance** — and
   re-judging is where cross-family matters MOST: the batch stock was written by
   a same-family session). The judge re-reads each `source` line (and
   surrounding body) and re-applies the step-3 judgment classes. Still grounded → keep (no write, nothing to do).
   No longer grounded (source drifted, claim was noise, judgment was wrong) →
   add to a removal list `{from, kind, target}`.
3. `plugins/ae/bin/graph-refresh.py remove-edges <removals.json>` — the only
   machine delete path (refuses human rows, no-ops on missing, scoped lint +
   revert, logs real removals).
4. Batch synthesis pages: re-apply the step-4.5 content contract + judge rubric
   to every `written_by: batch` page. FAIL → rewrite through delete + `add-page`
   (the full evidence-bundle gate again) or delete outright if the page should
   not exist. PASS → keep, untouched. **Same-family re-judging only catches
   FORM (restatement, missing markers) — it cannot catch its own confabulations.
   Page re-judging should be a CROSS-FAMILY ground-truth pass whenever available:
   a different-family reviewer reads each page AND the code it anchors into, and
   verifies the INTERPRETATION claim-by-claim (the first such audit found
   confident-but-wrong claims on 4/4 pages that the form rubric had passed).**
5. **Hardening path**: pages/edges the user has spot-checked and endorsed get
   `written_by` flipped to `human` (plain frontmatter/file edit) — they leave
   the re-judge pool permanently. Over successive refreshes the corpus migrates
   from "LLM-claimed" to "human-confirmed"; the report tracks the ratio.

### 4. Whole-tree gate (orphan-filtered)

`plugins/ae/bin/graph-lint.py --root .ae/features --log-validations` — the exit code will be non-zero
whenever orphans exist; that is BY DESIGN — the two output classes are distinct
prefixes:

- Any **`[graph-lint] DEFECT:`** line (dangling target, bad source, enum, duplicate
  id, unparseable, page-edge violations) → a real failure: fix (usually by removing the offending edge) and re-run.
- **`[graph-lint] ORPHAN:`** / **`[graph-lint] ORPHAN-PAGE:`** lines → the observation report, NOT failures. **Never invent edges for orphans** — an orphan with no grounded relationship stays an orphan. List them in the report; they are the honest shape of the corpus. (An orphan PAGE is often a candidate for a `documented_by` edge from the feature that motivated it — propose it through step 3's judged path only when the grounding is real.)
- **`[graph-lint] DRIFT:`** lines → informational, never exit-changing: the index
  overview lags the pages (missing row or stale state label). Fix = regenerate the
  index (step 5); no judgment involved.

This step is also where a MISFIRING write point surfaces: edges that should have been
written automatically but weren't show up here as zero-edge nodes or fresh candidates
— the refresh closes the gap AND the report names it, so the broken write point
itself can be fixed.

### 4.5 Synthesis pages (LLM writes, machine gates, human owns truth)

High-level design pages — persisted understanding of components/subsystems the
corpus references but no page explains. Fast-changing implementation detail never
gets a page (the working tree answers that live via grep). Flow:

1. **Propose candidates**: subsystems repeatedly named across nodes/edges/skills
   with no `syn-*` page in `.ae/graph/synthesis/`. Also: every existing page whose
   pull-gate check reports `stale` is a re-look candidate.
2. **Evidence bundle BEFORE writing** — the write gate. For each accepted candidate
   the author must have read: (a) the code at every anchor it will cite, (b) docs
   mentioning the entity, (c) `git log --follow` / blame for the entity's files —
   commit messages ground "why" claims in recorded intent instead of invention.
3. **Content contract**: every declarative sentence carries an anchor (its `source`
   cited in the body) OR an explicit unanchored-judgment marker. **Prefer anchoring
   CODE or schema-stable lines over skill/doc prose — prose lines get edited far more
   often and each edit flips the page stale** (measured: four prose-anchor stales in
   the layer's first day) (e.g. *"judgment,
   unanchored:"*). "Why" claims cite commits where history grounds them. A page
   holds what the sources DON'T say — responsibilities, boundaries, why — never
   restated content.
4. **Write via `plugins/ae/bin/graph-refresh.py add-page <page.json>`** — the only
   machine write path (atomic, idempotent by id, refuses divergent re-adds, deletes
   itself on a failed post-write check, logs only successes). NEVER hand-write page
   files from the machine side; humans MAY edit pages directly (the next check
   re-validates).
5. **Judge gate (rubric)**: reject a page section if every sentence in it is
   verbatim-quotable from a single anchored source — that is a summary, not
   synthesis. Grade actual content non-restatability, never section-template
   presence. **The page's WRITER never runs this gate on its own page** (per
   Judgment provenance) — an independent judge does.
6. **Write-then-audit (immediately, not at the next refresh)**: after `add-page`
   succeeds, the new page gets a cross-family ground-truth pass right away — the
   fact-claim contract shape (plan/SKILL.md's judge-class rule): the judge reads
   the anchored sources FIRST, then verifies the page claim-by-claim (verdict +
   evidence cite + its own re-derived answer per material claim). Findings →
   fix via delete + re-add before the page enters circulation. A synthesis page
   is the canonical self-authored fact-claim artifact; it does not wait for the
   next manual refresh to be trusted.
7. **Stale pages**: re-read the drifted anchors, decide whether the understanding
   still holds — update anchors (human edit or delete + re-add) or retire the page
   (delete the file; index, check, and log converge on the next run).

### 4.7 Judged lint classes (LLM — the network's semantic half, incremental-only)

The mechanical classes above prove structure; these four prove MEANING, and every
one routes through the same independently-judged flow as step 3 (Judgment
provenance applies — the detector never judges its own findings). **Incremental
schedule, never all-pairs**: only pages/nodes NEW or CHANGED since the last
refresh run (log.md records bound the window) are compared, and only against
their THEME-NEIGHBORHOOD (same index theme + 1-hop graph neighbors). All-pairs
is O(n²) by arithmetic — 50 pages = 2,450 pairs — and stays out by design; the
permanent blind spot for untouched pre-existing pairs is a RECORDED property
(completion table), not an oversight.

1. **Missing pages**: a concept repeatedly named across nodes/edges/skill prose
   (grep candidates: ≥3 distinct nodes naming it) with no `syn-*` page → SUGGEST
   a page candidate into step 4.5's flow. Suggestion only — the lint proposes,
   the evidence-bundle gate + judge decide.
2. **Missing cross-references**: two pages/nodes whose bodies name each other (or
   share ≥2 anchored files) with no edge either way → SUGGEST an edge candidate
   into step 3's judged path. Grep finds candidates; the judge decides grounding.
3. **Contradictions**: a new/changed page's claims vs its theme-neighborhood —
   two anchored claims that cannot both hold → emit a `conflicts_with` PROPOSAL.
4. **Superseded claims**: a new/changed page/node whose sources postdate and
   overturn an older page's anchored claim (SEMANTIC judgment — anchor byte-diffs
   cannot see it) → emit a `supersedes` PROPOSAL.

**Detection FEEDS the write path, never writes**: every proposal lands as an
add-edges JSON row tagged `"proposal_source": "lint"` and goes through the SAME
judged gate as step 3 candidates (independent judge; cross-family when the
detector authored the analyzed content). Nothing is auto-written — a proposal
the judge rejects simply never reaches the corpus, and the rejection joins the
adversarial resample pool that write-point-health samples (per-source
breakdown: lint vs writeback). The proactive-suggestion posture is deliberate:
lint SUGGESTS missing structure (pages, xrefs), not only flags defects.

### 5. Index + traversal check + docs rendering

`plugins/ae/bin/graph-index-gen.py` (regenerate the layered index), then spot-check the
graph is really traversable: `plugins/ae/bin/graph-neighbors.py <a-well-connected-id>`
and `--hops 2` on one lineage — non-empty, sensible output.

Then regenerate the human-facing architecture view:
`plugins/ae/bin/graph-render-docs.py` → `docs/architecture-graph.md` (git-tracked,
readable with zero AE context; deterministic — an unchanged topology produces an
unchanged file, so the diff is exactly the topology change). Stale pages render
with their state marked — the doc never hides rot.

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
  everything else honest). Endorsed items should be flipped to `written_by: human`
  so they leave the re-judge pool (step 3.5's hardening path).
- **Batch-vs-human ratio**: report how much of the corpus is still `written_by:
  batch` (re-judged every run) vs `human` (settled) — the honest measure of how
  much LLM-generated content remains unconfirmed.
- **Write-point health (F-076 — COMPUTED, not promised)**: run
  `plugins/ae/bin/graph-writeback-health.py` and include its output verbatim:
  the write-back disposition yes-rate over the ledger's `query:` records
  (a mandatory disposition line whose aggregate nobody computes is grep-green
  theater), accepted-edge counts per proposal source (`lint` vs `writeback` —
  both structurally-parallel write-trigger paths under one monitor), and the
  numeric dedup tripwire (N=10 batch pages since the last `dedup:` record →
  the FORCED line means the dedup-lint revisit runs before this refresh
  closes; log the pass as a `dedup:` record CARRYING the pass evidence —
  pages compared + duplicates found — a bare reset line with no evidence is
  itself a bypass signal), and the **independent denominator**: locate-step
  invocation counts from the skill traces vs the ledger's query records — a
  positive gap means locate-steps ran but appended no query record (the
  append-layer death that `queries: 0` alone cannot distinguish from "the
  skills never ran"; windows differ, so treat as smoke alarm).
  **Adversarial `no`-resample (the T4 lesson applied to T1)**: sample ≥2 of
  the `no` dispositions recorded since the last refresh and re-judge them
  against the source material with a fresh-context judge (Judgment provenance
  applies) — the aggregate yes-rate cannot see a systematic
  "files-trivia, skips-valuable" precision failure; per-sample verdicts go in
  the report, and an overturned `no` becomes a write-back candidate now.
- **Synthesis page freshness**: list every page ordered by time-since-last-validation
  (oldest first — pages nobody reads never hit the pull gate, so this list is their
  only surfacing), with each page's current check verdict. The validation times come
  from the `check:` records the step-4 gate just appended to `.ae/graph/log.md`
  (`--log-validations`); a page with no check record ever is listed first as
  "never validated". Track the **stale-backlog
  trend** across refreshes: if the stale count grew versus the previous refresh
  report, say so explicitly — consecutive growth is the recorded condition for
  reopening the automated-trigger decision.

## Non-goals

- NOT an unattended cron pass — a human triggers it and reviews the judged edges
  (unattended machine-verifiable-only correction is a separate, future concern).
- Does NOT write edges for orphans, dubious mentions, or unresolvable targets — the
  graph's value is trust; sparse-and-grounded beats dense-and-noisy.
- Does NOT replace the automatic write points — it corrects and converges around them.
