---
id: "001"
title: "Unified ae Plugin File Output Conventions"
status: concluded
created: 2026-03-22
pipeline:
  analyze: skipped
  discuss: done
  plan: done
  work: done
plan: "docs/plans/001-unified-output.md"
tags: [output, conventions, pipeline]
---

# Unified ae Plugin File Output Conventions

Unify the file output locations, naming conventions, and formats across all ae skills, eliminating the current inconsistency.

## Problem Statement

The outputs of the current 13 skills are completely inconsistent:
- analyze/discuss hardcode `docs/discussions/`
- plan reads `pipeline.yml → output.plans` (no default value)
- think reads `pipeline.yml → output.analyses` (has default value `docs/analyses/`)
- work/review are scattered across `docs/milestones/*/notes.md` and `docs/backlog/`
- Naming conventions are inconsistent (NNN-slug vs topic.md vs no convention)
- Usage of `output.*` in pipeline.yml is inconsistent (some read it, some hardcode, some have no default)

## Current State

Skills that produce files (7):
- `ae:setup` → `.claude/pipeline.yml`, `.claude/cross-family-status.json` (fixed paths, reasonable)
- `ae:analyze` → `docs/discussions/NNN-slug/analysis.md` (hardcoded)
- `ae:discuss` → `docs/discussions/NNN-slug/topic-NN-slug.md` (hardcoded)
- `ae:plan` → `pipeline.yml → output.plans` (configurable, no default)
- `ae:work` → updates plan in-place + `docs/milestones/*/notes.md` + `docs/backlog/`
- `ae:review` → `notes.md` (path unclear) + `docs/backlog/`
- `ae:think` → `pipeline.yml → output.analyses` (configurable, default `docs/analyses/`)

Skills with terminal-only output (5): code-review, consensus, trace, team, cross-family-review

Code file output: testgen (writes to project test directory, reasonable)

## Topics

| # | Topic | File | Status | Decision |
|---|-------|------|--------|----------|
| 1 | Output root directory | [topic-01-output-root.md](topic-01-output-root.md) | ✅ Superseded | Merged into topic 2 |
| 2 | pipeline.yml config granularity | [topic-02-config-granularity.md](topic-02-config-granularity.md) | ✅ Decided | D — Semantic slots + sensible defaults, no root |
| 3 | File naming and format conventions | [topic-03-naming-format.md](topic-03-naming-format.md) | ✅ Decided | B — Per-type independent numbering + slug |
| 4 | Terminal skill persistence strategy | [topic-04-terminal-persistence.md](topic-04-terminal-persistence.md) | ✅ Decided | D — Temp persistence + proactive save reminder |

## Documents
- [Conclusion](conclusion.md)
