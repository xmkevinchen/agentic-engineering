---
id: roadmap-plan-executes-non-interactive
target: ae:roadmap
layer: 2
source: manual
---

## Context

Fixture repo state (in worktree):
- `.ae/backlog/unscheduled/BL-099-test-feature.md` exists with valid frontmatter (`id: BL-099`, `title: "Test feature"`, `priority: P2`)
- `.ae/backlog/v0.9.5/` does NOT exist
- `.ae/roadmaps/v0.9.5.md` does NOT exist
- No AskUserQuestion calls should happen (flags provide all required input)

## Prompt

Execute the following invocation of the ae:roadmap skill:

```
/ae:roadmap plan v0.9.5 --items BL-099 --theme "Test sprint theme" --gate "BL-099 complete and reviewed" --yes
```

Per the skill's `plan` subcommand spec, this should create the sprint directory, move BL-099, and write the roadmap doc — all non-interactively because `--items`, `--theme`, `--gate`, and `--yes` flags are present.
