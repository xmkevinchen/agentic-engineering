---
id: roadmap-plan-creates-doc
target: ae:roadmap
layer: 1
source: manual
---

## Expected Behavior

### MUST
- [text:contains] SKILL.md Subcommands section defines `/ae:roadmap plan <version>` with both interactive and non-interactive modes
- [text:contains] SKILL.md specifies non-interactive flags: `--items <comma-list>`, `--theme <string>`, `--gate <string>`
- [text:contains] SKILL.md specifies that all three content flags are required together for non-interactive mode
- [text:contains] SKILL.md describes moving items from `unscheduled/` to `<version>/` as part of plan execution
- [text:contains] SKILL.md describes writing `.ae/roadmaps/<version>.md` with frontmatter fields: version, committed_at, initial_items, initial_points, theme, gate
- [text:contains] SKILL.md describes auto-generating `## Items` body table from directory contents
- [text:contains] SKILL.md specifies idempotency: refuse if roadmap doc already exists

### MUST_NOT
- [text:contains] No description of `plan` subcommand that reads the roadmap doc body `## Items` section (Invariant 4: body is for humans; frontmatter is for machines)
- [text:contains] No description of `plan` subcommand writing to plan frontmatter of BL items (Invariant 1: scope assignment = directory location)

### SHOULD
- [text:contains] SKILL.md includes a `--yes` flag to skip final confirmation (for scripting)
- [text:contains] SKILL.md describes a scope-lock reminder output after successful plan
- [text:contains] SKILL.md handles the error case where a BL in `--items` is not found in `unscheduled/`
