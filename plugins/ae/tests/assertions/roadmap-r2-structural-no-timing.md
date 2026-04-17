---
id: roadmap-r2-structural-no-timing
target: ae:roadmap
layer: 1
source: manual
---

## Expected Behavior

### MUST
- [text:contains] SKILL.md has a `## Release-readiness flag (R2 structural)` section (or equivalent R2 heading)
- [text:contains] R2 criteria include both: all items done/closed frontmatter status AND no active `blocked_by:` chain to non-done items
- [text:contains] R2 ready-output uses action-cued phrasing referencing `/ae:roadmap close <version>` as next action
- [text:contains] R2 section explicitly forbids timing language (no "ship now", "release today", date projections)
- [text:contains] Justification: timing language requires ≥3 archived versions with size data (Phase C velocity baseline)
- [text:contains] Consumer scope note: ae:next does NOT consume R2 in Phase B (explicitly deferred to Phase C)

### MUST_NOT
- [text:contains] R2 output MUST NOT use words like "now", "today", "ready to ship immediately"
- [text:contains] R2 MUST NOT order versions across each other (no "ship v0.9.0 before v1.0.0" guidance)
- [text:contains] R2 MUST NOT trigger any state mutation (output-only advisory)

### SHOULD
- [text:contains] R2 not-ready output includes concrete item counts (N/M done, K blockers)
- [text:contains] Section is positioned between Board View and v2 Schemas in SKILL.md structure
