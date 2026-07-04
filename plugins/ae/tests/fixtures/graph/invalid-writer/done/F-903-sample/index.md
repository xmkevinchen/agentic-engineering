---
id: F-903
title: "Fixture — out-of-enum written_by"
status: done
created: 2026-07-03
edges:
  - kind: relates_to
    id: F-041
    source: "plan.md:88"
    evidence: "test fixture"
    written_by: robot_overlord
    judge: {value: pass, rationale: "n/a"}
---

# Fixture — invalid written_by

`written_by: robot_overlord` is not in the enum. validate-feature-frontmatter.sh must fail.
