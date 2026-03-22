---
id: "01"
title: "Output Root Directory"
status: decided
created: 2026-03-22
decision: "Superseded — merged and replaced by option D from topic 02"
rationale: "No unified root directory is needed. The semantic slot approach lets each slot configure its path independently, with defaults directly under docs/ (e.g. docs/discussions/), eliminating the need for a docs/ae/ isolation layer. Existing projects (SmartPal) are compatible with zero migration."
---

# Topic: Output Root Directory

## Background

Files produced by ae (analyses, plans, discussions, review results) need a unified root directory. Currently they are scattered across `docs/discussions/`, `docs/milestones/`, `docs/analyses/`, `docs/backlog/`, `results/reviews/`, and other locations. The choice of root directory affects project tidiness and discoverability.

## Options

### A: `docs/ae/`

All ae outputs are centralized under `docs/ae/`, with subdirectories by skill type:

```
docs/ae/
  analyses/
  discussions/
  plans/
  reviews/
  traces/
  backlog/
```

- **Pros**: Namespace isolation, doesn't pollute the project's existing `docs/`; makes it obvious which files are ae outputs
- **Cons**: One extra level of nesting; if the project uses `docs/` for its own documentation, ae outputs might get mixed into the docs build pipeline

### B: `.claude/ae/`

Outputs placed under `.claude/ae/` (hidden directory):

```
.claude/ae/
  analyses/
  discussions/
  plans/
  reviews/
```

- **Pros**: Fully isolated, does not affect project documentation structure; `.claude/` is already home to ae configuration
- **Cons**: Hidden directory is hard to discover; team members may overlook it; some projects have `.gitignore` excluding `.claude/`; not suitable for outputs that need version control (plans, decisions)

### C: Flat layout under project root (improved status quo)

Keep a flat layout under `docs/` but with unified prefixes:

```
docs/
  ae-analyses/
  ae-discussions/
  ae-plans/
  ae-reviews/
```

- **Pros**: Flat structure, shorter paths; close to existing habits
- **Cons**: Prefix approach is inelegant; `docs/` directory becomes cluttered; no real namespace isolation

## Recommendation

Recommend **A: `docs/ae/`**. One level of nesting yields clean namespace isolation, and the outputs are fundamentally documentation (plans, analyses, decisions), so placing them under `docs/` is semantically correct. `.claude/` is suitable for configuration and runtime state, not for knowledge outputs that need team sharing and version control.
