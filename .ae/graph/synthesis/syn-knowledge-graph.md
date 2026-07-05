---
id: syn-knowledge-graph
title: "Knowledge graph subsystem — two persisted domains, one trust skeleton"
created: 2026-07-04
written_by: batch
state: fresh
anchors:
  - source: "plugins/ae/scripts/graph_common.py:62"
    anchor_hash: "_CLASS_PATTERNS = ("
  - source: "plugins/ae/scripts/graph-page-check.py:155"
    anchor_hash: "verdict = \"DEFECT\" if defects else (\"stale\" if stale else \"fresh\")"
  - source: "plugins/ae/scripts/graph-refresh.py:57"
    anchor_hash: "def log_mutation(graph_dir, actor, what):"
  - source: "plugins/ae/skills/plan/SKILL.md:124"
    anchor_hash: "4. **[deterministic gate]** Synthesis pages (index tier \"Synthesis pages\", ids `syn-*`) are read only through the pull gate: run `plugins/ae/bin/graph-page-check.py .ae/graph/synthesis/<syn-id>.md` BEFORE reading a page — fresh → read + cite normally; stale → read, but every citation of it carries an inline `[STALE — re-sync via /ae:knowledge-refresh]` flag at the affected item; DEFECT (non-zero exit) → do NOT read the page — fresh vs stale are BOTH exit 0 and are told apart by the final stdout verdict line (`<syn-id>: fresh|stale`), emit one `[DEFECT: <syn-id> not served]` line instead. Rot is never silently served."
  - source: "CLAUDE.md:70"
    anchor_hash: "- **Self-bootstrapping** — AE develops AE. All changes to this plugin go through the AE pipeline (discuss→plan→work→review). This is the default working mode, not a special case."
    commit: b4cc996
---

Judgment, unanchored: the graph persists two kinds of JUDGED content — and their mechanical by-products (the append-only mutation log, the regenerated index); everything semantic beyond these two derives at read time. Domain one is relationship edges between project artifacts, whose target-id universe is a closed four-class dispatch — F / BL / disc / syn, one canonical table in the shared module (plugins/ae/scripts/graph_common.py:62); an unknown prefix is a named defect, never silently classified. (The v1 leaf-only page rule existed because admitting the fourth prefix meant touching the dispatch chain and resolvers — F-076 did exactly that, ending leaf-only.) Domain two is synthesis pages — prose understanding whose every claim anchors into the working tree, machine-graded into exactly three ANCHOR-freshness states — the grading never claims semantic truth, which stays with the judge and the human (plugins/ae/scripts/graph-page-check.py:155).

Judgment, unanchored: the boundary rule that explains the whole design is that persistence follows CHANGE RATE, not artifact type — slow-changing things (feature relationships, high-level design) persist, while fast-changing implementation detail is never stored because the working tree answers it live; this is also the single decision most likely to confuse a newcomer, because the graph looks code-free when the code actually enters through page anchors.

Safety is a pull model — nothing revalidates in the background; every read path runs the page check at access time and stale content is flagged inline where it is cited (plugins/ae/skills/plan/SKILL.md:124). The write side is mirrored discipline: machines own every machine-side mutation (humans edit pages and frontmatter directly; the next check re-validates), each success appending one record via the log helper (plugins/ae/scripts/graph-refresh.py:57), because hand-rolled frontmatter surgery corrupted three files in the first live run. The subsystem exists to serve the self-bootstrapping loop (CLAUDE.md:70): the pipeline that builds AE reads this graph before designing changes to AE.
