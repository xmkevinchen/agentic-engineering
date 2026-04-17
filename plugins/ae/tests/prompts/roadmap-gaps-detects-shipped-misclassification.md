---
id: roadmap-gaps-detects-shipped-misclassification
target: ae:roadmap
layer: 2
source: manual
---

## Context

Fixture repo state (in worktree) — staged to reproduce the Phase A P1 escape class:

- `.ae/backlog/closed/BL-999-fixture-shipped-item.md` exists with body text including `"shipped in v0.7.9 per commit abc1234"` and NO frontmatter `status:` field (simulating pre-migration housekeeping item)
- `CHANGELOG.md` at repo root contains a section:
  ```
  ## v0.7.9 — 2026-01-15

  ### Housekeeping
  - BL-999: test fixture shipment
  ```
- No `.ae/backlog/done/v0.7.9/` directory exists (which would be the correct location)
- `.ae/roadmaps/v0.7.9.md` may or may not exist (not required for this audit to fire)

This exactly matches the pattern that caused Plan 039-a's P1 escape: a shipped BL item placed in `closed/` (discarded tier) instead of `done/v<X>/` (shipped tier).

## Prompt

Execute:

```
/ae:roadmap --gaps
```

Per the validator spec, this MUST detect the misclassification via Audit 1 (semantic classification).
