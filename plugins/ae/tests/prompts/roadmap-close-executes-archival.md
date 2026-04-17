---
id: roadmap-close-executes-archival
target: ae:roadmap
layer: 2
source: manual
---

## Context

Fixture repo state (in worktree):
- `.ae/backlog/v0.8.9/BL-099-test-feature.md` exists with frontmatter `status: done`
- `.ae/roadmaps/v0.8.9.md` exists with:
  - frontmatter: `version: v0.8.9`, `committed_at: 2026-04-01`, `initial_items: [BL-099]`, `initial_points: 3`, `theme: "test"`, `gate: "BL-099 done"`
  - body: `## Theme`, `## Gate`, `## Items`, `## Notes` sections
  - no `closed:` frontmatter field
- `.ae/backlog/done/v0.8.9/` does NOT exist (sprint is active, ready to close)

## Prompt

Execute the following invocation of the ae:roadmap skill:

```
/ae:roadmap close v0.8.9
```

Then run the same command AGAIN:

```
/ae:roadmap close v0.8.9
```

Per the skill's `close` subcommand spec, the first run should archive and annotate; the second run should be idempotent (no-op with message).
