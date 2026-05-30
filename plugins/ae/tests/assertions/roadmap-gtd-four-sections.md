---
id: roadmap-gtd-four-sections
target: ae:roadmap
layer: 1
source: manual
---

## Expected Behavior

### MUST
- [file:contains:plugins/ae/skills/roadmap/SKILL.md] Default (no-arg) output covers section `(a) Promote candidates` (scan backlog → LLM-judged promote candidates + batch-approval block)
- [file:contains:plugins/ae/skills/roadmap/SKILL.md] section `(b) Dependency analysis`
- [file:contains:plugins/ae/skills/roadmap/SKILL.md] section `(c) Sizing aggregate` (reads feature `size:` T-shirts + auto-eval unsized for display)
- [file:contains:plugins/ae/skills/roadmap/SKILL.md] section `(d) Archive prompt`
- [file:contains:plugins/ae/skills/roadmap/SKILL.md] Default invocation does NOT mutate user state — writes only `.ae/cache/auto-size.yml` (gitignored, transient); never modifies feature `index.md` / plans / reviews / roadmaps
- [file:contains:plugins/ae/skills/roadmap/SKILL.md] Active roadmaps are read from `.ae/roadmaps/active/*.md`

### MUST_NOT
- [file:not_contains:plugins/ae/skills/roadmap/SKILL.md] does NOT define sprint/version CRUD subcommands `plan` / `close` / `move` / `add` / `remove` as operating subcommands (those are explicitly non-goals post-GTD)
- [file:not_contains:plugins/ae/skills/roadmap/SKILL.md] default invocation does NOT auto-write feature `index.md` `size:` (auto-eval is display-only; `--resize` is the explicit persist path)
