---
id: roadmap-close-archives
target: ae:roadmap
layer: 1
source: manual
---

## Context

Fixture: `.ae/backlog/v0.8.2/` contains BL-009.md with frontmatter `status: done`. `.ae/roadmaps/v0.8.2.md` exists without `closed:` frontmatter.

## Prompt

User runs `/ae:roadmap close v0.8.2`. The close subcommand must archive the sprint directory and annotate the roadmap doc idempotently, handling edge cases (already-closed, not-done items, missing doc) per the spec.
