---
id: roadmap-v2-reads-sprint-structure
target: ae:roadmap
layer: 1
source: manual
---

## Context

Project has migrated to sprint-based backlog structure (Plan 039-a). The following fixture state exists:

`.ae/backlog/` contains subdirectories:
- `v0.8.2/` with 1 item: BL-009-test-coverage-gaps.md
- `v0.9.0/` with 4 items: BL-022-external-onboarding.md, BL-025-retrospect-user-facing.md, BL-005-custom-agent-mechanism.md, BL-029-cross-family-measurement.md
- `v1.0.0/` with 2 items: BL-026-roadmap-v2-ai-pm.md, BL-028-dashboard-v2-version-aware.md (frontmatter: `blocked_by: BL-026`)
- `unscheduled/` with 6 items (BL-007, BL-010, BL-011, BL-020, BL-021, BL-030)
- `closed/` with 4 items (BL-015, BL-016, BL-023, BL-024)

`.ae/roadmaps/` contains 3 docs: `v0.8.2.md`, `v0.9.0.md`, `v1.0.0.md`. All have required frontmatter (version, committed_at, initial_items, initial_points, theme, gate). None have `closed:` set.

## Prompt

User runs `/ae:roadmap`. The skill's State Reading section must traverse the subdirectory structure and classify items by their parent directory, per Invariant 1 (directory IS sprint membership).
