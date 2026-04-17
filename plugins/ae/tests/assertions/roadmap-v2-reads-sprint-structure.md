---
id: roadmap-v2-reads-sprint-structure
target: ae:roadmap
layer: 1
source: manual
---

## Expected Behavior

### MUST
- [text:contains] SKILL.md State Reading → Backlog section describes path-aware traversal with a subdir pattern classification table
- [text:contains] SKILL.md classifies `v<X>.<Y>.<Z>/` as active sprint
- [text:contains] SKILL.md classifies `unscheduled/` as product backlog
- [text:contains] SKILL.md classifies `done/v<X>/` as archived (excluded from default view)
- [text:contains] SKILL.md classifies `closed/` as discarded (excluded from default view)
- [text:contains] SKILL.md has State Reading → Roadmaps subsection that reads `.ae/roadmaps/v*.md` frontmatter
- [text:contains] SKILL.md defines current-version determination with deterministic tiebreaker (lowest semver wins when multiple non-closed docs exist)
- [text:contains] SKILL.md Version Lanes section renders per non-closed roadmap doc

### MUST_NOT
- [text:contains] No assumption that `output.backlog` is a flat directory (the v1 single-level glob pattern must be replaced)

### SHOULD
- [text:contains] SKILL.md includes a legacy-flat-layout detection hint suggesting `/ae:roadmap bootstrap`
- [text:contains] Board View section mentions synthetic Blocked column from `blocked_by:` field with cycle detection
