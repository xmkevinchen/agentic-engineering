---
id: "03"
title: "File Naming and Format Conventions"
status: decided
created: 2026-03-22
decision: "B — Per-type independent numbering + slug"
rationale: "Simplest to implement, naturally compatible with SmartPal's existing conventions (discussions/001-xxx, BL-002-xxx). Cross-type chronological relationships are queried via the frontmatter created field."
---

# Topic: File Naming and Format Conventions

## Background

Current naming is inconsistent: analyze/discuss use `NNN-slug` three-digit numbered directories, plan has no prescribed filename, think uses `<topic>.md`, and review's notes.md path is unclear. We need to unify naming conventions and file formats.

## Options

### A: Global incrementing number + slug

All outputs share a single global counter, spanning skill types:

```
docs/ae/
  analyses/001-auth-flow.md
  discussions/002-api-design/
  plans/003-implement-auth.md
  analyses/004-perf-bottleneck.md
```

- **Pros**: Natural ordering reflects the timeline; work sequence is visible across types
- **Cons**: Global counter is complex to implement (requires scanning all subdirectories); gaps in numbering are unintuitive

### B: Per-type independent numbering + slug

Each subdirectory has its own independent numbering:

```
docs/ae/
  analyses/001-auth-flow.md
  analyses/002-perf-bottleneck.md
  discussions/001-api-design/
  plans/001-implement-auth.md
```

- **Pros**: Simple to implement (only scan current subdirectory); numbers within each type are consecutive with no gaps
- **Cons**: Cannot see chronological order across types (does analyses/001 come before or after plans/001?)

### C: Date prefix + slug

```
docs/ae/
  analyses/2026-03-22-auth-flow.md
  discussions/2026-03-22-api-design/
  plans/2026-03-23-implement-auth.md
```

- **Pros**: Time information is built in; no counter needed; natural ordering
- **Cons**: Multiple outputs on the same day need extra disambiguation (add a sequence number?); filenames are longer

## Format Conventions (applies to all options)

Regardless of which naming scheme is chosen, format is unified as:

- **File format**: Markdown + YAML frontmatter
- **Required frontmatter fields**: `id`, `title`, `type` (analysis/discussion/plan/review/trace), `created`, `status`
- **Discussion directory structure unchanged**: discuss retains its directory form due to its multi-file nature (index + topics + conclusion)
- **All others are single files**: analyses, plans, reviews, traces are each a single .md file

## Recommendation

Recommend **B: Per-type independent numbering + slug**. Simplest to implement, semantically clear. Cross-type chronological relationships are queried via the frontmatter `created` field and don't need to be encoded in filenames. The existing `NNN-slug` directory convention for discuss carries over naturally.
