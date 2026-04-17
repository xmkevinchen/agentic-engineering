---
id: roadmap-plan-creates-doc
target: ae:roadmap
layer: 1
source: manual
---

## Context

Project has migrated backlog structure. `.ae/backlog/unscheduled/` contains BL-007-setup-migrate.md and BL-010-hook-opportunities.md. `.ae/backlog/v0.9.5/` does not exist. `.ae/roadmaps/v0.9.5.md` does not exist.

## Prompt

User runs the non-interactive form:

```
/ae:roadmap plan v0.9.5 --items BL-007,BL-010 --theme "hook polish" --gate "BL-010 complete, no regressions"
```

The skill's `/ae:roadmap plan <version>` subcommand must support this invocation form deterministically (needed for Layer 1 test execution and CI).
