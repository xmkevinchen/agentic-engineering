---
id: roadmap-close-executes-archival
target: ae:roadmap
layer: 2
source: manual
---

## Expected Behavior

### MUST
- [file:exists] `.ae/backlog/done/v0.8.9/BL-099-test-feature.md` exists after first run (item moved from sprint dir)
- [file:exists] `.ae/backlog/v0.8.9/` directory does NOT exist after first run (archived)
- [file:contains] `.ae/roadmaps/v0.8.9.md` frontmatter contains `closed:` with today's date
- [file:contains] `.ae/roadmaps/v0.8.9.md` body contains `## Closed` section
- [file:contains] `## Closed` section lists BL-099 as shipped
- [behavior] Second run prints "Already closed on <date>." and makes NO file changes (idempotent)

### MUST_NOT
- [file:exists] `.ae/backlog/v0.8.9/` does NOT exist after either run
- [behavior] MUST NOT remove or modify the item's frontmatter `status:` field
- [text:contains] MUST NOT emit timing language like "ship now" or "release today" (Phase C concern)

### SHOULD
- [text:contains] First-run output confirms "Closed v0.8.9" with item count
- [text:contains] Second-run output is a clear idempotency message (no-op with reason)
