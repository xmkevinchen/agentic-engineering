---
id: roadmap-close-archives
target: ae:roadmap
layer: 1
source: manual
---

## Expected Behavior

### MUST
- [text:contains] SKILL.md Subcommands section defines `/ae:roadmap close <version>`
- [text:contains] SKILL.md specifies idempotency check — if roadmap doc already has `closed:` frontmatter, skip with no-op message
- [text:contains] SKILL.md describes moving `.ae/backlog/<version>/` to `.ae/backlog/done/<version>/`
- [text:contains] SKILL.md describes appending a `## Closed` section to the roadmap doc with date and shipped items
- [text:contains] SKILL.md describes setting the frontmatter `closed:` field on the roadmap doc
- [text:contains] SKILL.md specifies warn-by-default behavior on items whose frontmatter status is not done/closed — close proceeds with a visible warning per item
- [text:contains] SKILL.md specifies `--strict` flag escalates not-done items to a refusal
- [text:contains] SKILL.md specifies `--force` flag overrides `--strict`
- [text:contains] SKILL.md specifies `--bump-remaining <target-version>` flag that moves open items to another sprint before archival

### MUST_NOT
- [text:contains] No description of close computing "done" status from cross-references to plan or review files (deterministic lookup rule uses only the BL item's own frontmatter)
- [text:contains] No hard-refuse on untracked items in default mode (only `--strict` triggers refusal)

### SHOULD
- [text:contains] SKILL.md mentions `--retro` flag for optional retrospective invocation during close
- [text:contains] SKILL.md handles the error case where the roadmap doc is missing
