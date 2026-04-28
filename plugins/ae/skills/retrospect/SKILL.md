---
name: ae:retrospect
description: Project-level long-cycle Reflect (GTD Weekly Review) over recently shipped features. Conversational output — no file written.
argument-hint: "[--since <duration>]"
user-invocable: true
---

# /ae:retrospect — GTD Long-cycle Reflect

A periodic look back at what the project has shipped recently, surfaced as a 4-section conversational summary. This is the **project-level Reflect** in GTD's 5-phase model — the long-cycle counterpart to `/ae:dashboard`'s short-cycle orientation.

Output is **conversational only — no file is written**. The user decides what's worth saving (a memory, a backlog item, a discussion); the skill should not pre-empt that judgment with an artifact dump.

> **Looking for AE plugin self-development outcome stats** (rework rate / P1 escape / drift / fix loops / auto-pass)? Use `/ae:plugin-stats`. That skill consumes `.ae/reviews/*` Outcome Statistics; this one consumes `.ae/features/done/`.

## Input

- Default: surface features done in the last 4 weeks.
- `--since <duration>`: customize the window (`--since 2w`, `--since 3m`, `--since 90d`). Bare `--since 4w` is the default; explicit form is for non-standard periods.

## Pre-check

1. Confirm `.claude/pipeline.yml` exists. Missing → `Run /ae:setup first.` Stop.
2. Confirm `.ae/features/done/` exists. Missing → `Project hasn't bootstrapped GTD; run Plan 050 setup first.` Stop.
3. Compute the cutoff date from `--since` (default 4 weeks ago). Today minus the duration.

## State Reading

Scan `.ae/features/done/*/index.md`. For each feature:

- Frontmatter required: `id`, `title`, `status: done`, `created`, `done`.
- Frontmatter optional (read if present): `theme`, `roadmap`, `size`, `origin_bl`, `depends_on`.
- Reader-tolerant per CLAUDE.md → `## Project Management (GTD)` → Reader contract.

Filter to features with `done >= <cutoff date>`. Empty result:

```
No features archived in the last <window>. ae:retrospect needs shipped features
to surface patterns. To start the GTD loop on a fresh project:
  /ae:backlog "<idea>"   — Capture an idea
  /ae:roadmap            — see promote candidates from backlog
  /ae:analyze BL-NNN     — Organize a captured BL into a feature
For AE plugin self-development outcome stats (delivery metrics across the
AE pipeline itself), use /ae:plugin-stats — that's a separate concern.
```

Stop here. Do not synthesize a 4-section report from zero data.

For each in-window feature, also read `<feature-dir>/analysis.md` (if present) and any review file referenced from the feature's plan (look up via the legacy plan path inferred from the linkage chain in `ae:dashboard` "Plan linkage during Plan 050 transition" — best effort, missing chain is OK).

## Output — 4 conversational sections

The skill produces a single conversational message with 4 sections. No file is written.

### (1) Recently shipped

A list of features done in the window, sorted by `done` date descending (most recent first):

```
## Recently shipped (last <window>)

- F-NNN — <title> — done YYYY-MM-DD (theme: <tag>, size: <T-shirt> if both present)
- F-MMM — <title> — done YYYY-MM-DD
- ...
```

If a feature has `roadmap:` set, append ` [→ <roadmap-name>]`. If a feature was originally a captured BL (`origin_bl: BL-NNN` non-empty), append ` (from BL-NNN)`.

When the window has 1 feature → render as a single line, skip "Recently shipped" pluralization. When the window has > 10 features → render the 10 most recent, then `... and <K> more shipped earlier in the window` line.

### (2) Lessons learned

LLM-driven analysis. For each feature in the window, read `analysis.md` (if present) and any associated review file. Extract:

- Decisions that turned out well (what to repeat).
- Decisions that turned out poorly (what to avoid).
- Surprises — things the original plan didn't anticipate.

Synthesize into 3–7 bullets across all features (NOT per-feature):

```
## Lessons learned

- <one-line lesson> — observed in F-NNN (<short evidence cite>) and F-MMM (<cite>).
- <one-line lesson> — observed in F-XXX (<cite>).
- ...
```

Discipline:

- **Cite evidence.** Every bullet must reference at least one feature ID + a brief cite. Speculation without evidence is noise.
- **Don't editorialize.** If `analysis.md` and the review say a decision worked, say it worked. Don't second-guess.
- **No bullets without substance.** If the window has nothing surprising worth surfacing, say so: `No notable lessons in this window — work proceeded as planned.` Better one honest line than five forced bullets.

### (3) Estimate vs actual

For each feature with a `size:` value (T-shirt) AND both `created:` and `done:` dates, compute:

- Estimated effort range from T-shirt (per CLAUDE.md mapping: XS < 1d, S 1d, M 2-3d, L ≈ 1w, XL > 1w).
- Actual elapsed days (`done - created`).
- **Note**: elapsed days is wall-clock, not active work time. A 1-week elapsed feature where the user worked only 2 days is `elapsed = 7d, active = 2d`. The skill cannot distinguish; surface elapsed and let the user interpret.

Render:

```
## Estimate vs actual

| Feature | Size | Estimated | Elapsed | Notes |
|---|---|---|---|---|
| F-NNN | M | 2-3d | 5d | wall-clock; user noted 2 days actual work |
| F-MMM | L | 4-7d | 6d | within range |
| F-XXX | S | 1d | 3d | wall-clock — pause periods are common |

Pattern: <one-line summary, e.g., "M-sized features consistently take 1-2 days longer
in elapsed time than estimated effort suggests; consider that elapsed includes pauses">
```

Features without `size:` are listed below the table:

```
Unsized in window: F-AAA, F-BBB (skip from estimate-vs-actual analysis)
```

If pattern is unclear (1-2 features, no clear bias) → `Pattern: insufficient data; need 5+ sized features in window for a reliable trend.`

### (4) Next promote candidates

Read `.ae/backlog/unscheduled/*.md` for BLs that are:
- `status: open` or `unscheduled` (not yet promoted).
- Not in any feature's `origin_bl:` (per `ae:roadmap` section (a) Filtering Constraints — same dedup rule).

Cross-reference with the in-window features' `analysis.md` and review bodies. Surface BLs that:
- Were cited in the discussions/analyses of recently-done features (LLM grep for the BL ID), but never promoted.
- Have themes matching recently-shipped roadmaps (high-momentum theme; user may want to keep going).

Render:

```
## Next promote candidates

Based on this window's shipped work, these backlog items might be ready for /ae:analyze:

- BL-NNN: <title> — cited 3x in analysis.md of recently-shipped features (theme: <tag>)
- BL-MMM: <title> — same theme as F-NNN/F-MMM (Recently shipped)
- ...

(Run /ae:roadmap for the full Clarify pass.)
```

If nothing surfaces → `No backlog items strongly tied to this window's shipped work. Check /ae:roadmap for the broader Clarify view.`

## Conversational delivery

Render all 4 sections in a single message. The output is **prose with markdown formatting**, suitable for the user to scan in the terminal. Do NOT:

- Write any file.
- Suggest the user save the output (they'll save what they want).
- Run `memory_ingest` automatically — Reflect is for reading, not capturing. The user may decide a lesson is worth a memory and save it manually.

## Principles

- **Conversational, not durable.** No file output. The skill's value is in the moment of reflection, not in the artifact.
- **Evidence cited per bullet.** Every claim references a feature ID + brief evidence; no general "I think" prose.
- **LLM-driven, not algorithmic.** Sections (2) and (4) are qualitative reads. Section (3) is mechanical. Section (1) is a sort.
- **Short window, high signal.** Default 4 weeks because longer windows produce too many shallow patterns; shorter windows usually have too little data. The user can pass `--since` for unusual cases.
- **Reader-tolerant** per CLAUDE.md schema contract.

## Distinction from `/ae:plugin-stats`

`/ae:retrospect` (this skill) reads `.ae/features/done/` — what the **project shipped** (its features). Output is conversational. Frequency: ad-hoc, when the user wants a Weekly Review or end-of-month look-back.

`/ae:plugin-stats` reads `.ae/reviews/*` Outcome Statistics — how the **AE pipeline performed** (rework rate, P1 escape, drift, auto-pass). Output is a persistent file for trend tracking. Frequency: periodic, when the user wants to evaluate process health.

Same project can use both. They answer different questions: *"what did we ship and what did we learn"* (retrospect) vs. *"how is our pipeline performing"* (plugin-stats). The split mirrors OpenAI evals + Google DORA/Four Keys: delivery metrics and product retrospective are intentionally separate.

## Next Steps

The skill never tells the user what to do — it surfaces a snapshot for them to think about. If the conversation prompts a follow-up:

- A lesson worth keeping → user decides to save a memory or open a discussion.
- A promote candidate sticking out → user runs `/ae:analyze BL-NNN`.
- A pattern in estimate-vs-actual → user adjusts their sizing heuristic, no skill call needed.
