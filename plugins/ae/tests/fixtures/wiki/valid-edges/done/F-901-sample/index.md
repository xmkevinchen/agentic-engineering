---
id: F-901
title: "Fixture — valid edges (all kinds + provenance)"
status: done
created: 2026-07-03
edges:
  - kind: relates_to
    id: F-041
    source: "plan.md:88"
    evidence: "shares the harness verification lineage"
    written_by: review-archive
    judge: {value: pass, rationale: "verified sibling relationship"}
  - kind: origin
    id: BL-042
    written_by: human
  - kind: supersedes
    id: F-030
    written_by: human
  - kind: superseded_by
    id: F-031
    written_by: human
  - kind: conflicts_with
    id: F-055
    written_by: batch
---

# Fixture — valid edges

Every edge kind present with a valid `written_by`. Used by test-edge-schema.sh AC1.
