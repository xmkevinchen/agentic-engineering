---
id: syn-gamma-bad
title: "Gamma bad edges"
created: 2026-01-01
written_by: batch
state: fresh
anchors:
  - source: "features/active/F-902-beta/index.md:8"
    anchor_hash: "Beta is referenced by alpha."
edges:
  - kind: talks_to
    id: syn-missing
    written_by: batch
  - kind: origin
    id: BL-901
    written_by: batch
---

A page planted with bad edges: a dangling talks_to and an illegal
origin (origin is F→BL; a page cannot originate from a backlog item).
