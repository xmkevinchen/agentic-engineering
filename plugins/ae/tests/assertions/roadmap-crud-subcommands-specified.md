---
id: roadmap-crud-subcommands-specified
target: ae:roadmap
layer: 1
source: manual
---

## Expected Behavior

### MUST
- [text:contains] SKILL.md Subcommands section defines `/ae:roadmap move <BL-ID> <target-version>`
- [text:contains] SKILL.md Subcommands section defines `/ae:roadmap add <BL-ID> <target-version>` (documented as alias of `move` from `unscheduled/`)
- [text:contains] SKILL.md Subcommands section defines `/ae:roadmap remove <BL-ID>` (descope to `unscheduled/`)
- [text:contains] SKILL.md Subcommands section defines `/ae:roadmap size <BL-IDs> <T-shirt>`
- [text:contains] move/add/remove specs require `--reason "..."` when source OR target is an ACTIVE sprint (non-closed roadmap doc)
- [text:contains] move/add/remove specify symmetric Notes logging format: `YYYY-MM-DD | <action> | BL-<ID> | <reason>`
- [text:contains] size subcommand does NOT require `--reason` (sizing is refinement, not scope change)
- [text:contains] size accepts batch form (comma-separated BL IDs)
- [text:contains] size validates T-shirt input against XS/S/M/L/XL (case-insensitive, stored upper)
- [text:contains] Abstain-from-suggest invariant preserved for size (ae:roadmap writes user-supplied values only, never suggests)

### MUST_NOT
- [text:contains] move/add/remove MUST NOT allow silent mid-sprint scope changes (--reason requirement is non-negotiable for active sprints)
- [text:contains] size MUST NOT apply scope-lock rules

### SHOULD
- [text:contains] move spec includes cycle check for `blocked_by:` relationships
- [text:contains] CRUD operations use plain `mv` (not `git mv`, since `.ae/` is gitignored)
