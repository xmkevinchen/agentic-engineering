---
id: roadmap-no-sprint-primitive
target: ae:roadmap
layer: 1
source: manual
---

## Expected Behavior

### MUST
- [file:contains:plugins/ae/skills/roadmap/SKILL.md] Non-goals section states **No sprint primitive** — explicitly: no `plan` / `close` / `move` / `add` / `remove` subcommands, no `v<X>.<Y>.<Z>` directories
- [file:contains:plugins/ae/skills/roadmap/SKILL.md] States the legacy version-grouped model was superseded by GTD; legacy files stay in place but are NOT read by default
- [file:contains:plugins/ae/skills/roadmap/SKILL.md] `--legacy` flag surfaces top-level `.ae/roadmaps/v*.md` as informational/read-only context only (with an anti-poisoning rule: legacy content never enters section (a) candidate judgment)

### MUST_NOT
- [file:not_contains:plugins/ae/skills/roadmap/SKILL.md] does NOT read top-level `.ae/roadmaps/v*.md` files by default (only `.ae/roadmaps/active/*.md`; legacy requires explicit `--legacy`)
- [file:not_contains:plugins/ae/skills/roadmap/SKILL.md] does NOT treat a directory as a sprint (no "directory IS sprint" invariant — GTD is flat-scan-by-frontmatter)
