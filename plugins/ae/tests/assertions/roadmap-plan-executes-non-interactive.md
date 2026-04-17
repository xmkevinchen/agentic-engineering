---
id: roadmap-plan-executes-non-interactive
target: ae:roadmap
layer: 2
source: manual
---

## Expected Behavior

### MUST
- [file:exists] `.ae/backlog/v0.9.5/` directory exists after execution
- [file:exists] `.ae/backlog/v0.9.5/BL-099-test-feature.md` exists (moved from unscheduled/)
- [file:exists] `.ae/backlog/unscheduled/BL-099-test-feature.md` does NOT exist (original was moved)
- [file:exists] `.ae/roadmaps/v0.9.5.md` exists
- [file:contains] `.ae/roadmaps/v0.9.5.md` frontmatter contains `version: v0.9.5`
- [file:contains] `.ae/roadmaps/v0.9.5.md` frontmatter contains `committed_at:` with today's date (YYYY-MM-DD format)
- [file:contains] `.ae/roadmaps/v0.9.5.md` frontmatter contains `initial_items:` list including `BL-099`
- [file:contains] `.ae/roadmaps/v0.9.5.md` frontmatter contains `theme: "Test sprint theme"` (or equivalent quoted form)
- [file:contains] `.ae/roadmaps/v0.9.5.md` frontmatter contains `gate: "BL-099 complete and reviewed"` (or equivalent)
- [file:contains] `.ae/roadmaps/v0.9.5.md` body has `## Theme`, `## Gate`, `## Items`, `## Notes` sections

### MUST_NOT
- [behavior] MUST NOT call AskUserQuestion (all required input provided via flags)
- [text:contains] No prompt to the user for items, theme, or gate input
- [file:exists] NO changes to `.ae/backlog/unscheduled/` other than BL-099 removal

### SHOULD
- [text:contains] Output includes a scope-lock reminder or confirmation message referencing the N items committed
- [file:contains] `## Items` body section lists BL-099 (auto-generated table from directory contents)
