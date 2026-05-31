---
id: roadmap-archive-subcommand
target: ae:roadmap
layer: 1
source: manual
---

## Expected Behavior

### MUST
- [file:contains:plugins/ae/skills/roadmap/SKILL.md] A `/ae:roadmap archive <name>` subcommand exists, described as the non-interactive form of section (d)
- [file:contains:plugins/ae/skills/roadmap/SKILL.md] `archive <name>` refuses if any linked feature is still in `features/active/` — error names the open features (e.g. `Roadmap "<name>" has open features: F-X, F-Y. Cannot archive.`)
- [file:contains:plugins/ae/skills/roadmap/SKILL.md] A `paused` linked feature does NOT block roadmap archive (only `active` blocks); the archive summary REPORTS paused linked features, flagging any that block an active feature (F-032 D5).

### MUST_NOT
- [file:not_contains:plugins/ae/skills/roadmap/SKILL.md] `archive` does NOT move/delete files in the backlog or feature dirs (roadmap never mutates backlog or feature state — archiving operates on the roadmap doc only)
