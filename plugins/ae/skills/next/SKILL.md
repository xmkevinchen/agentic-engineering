---
name: ae:next
description: Suggest the next pipeline step based on project state
user_invocable: true
---

# /ae:next — Next Step Suggestion

Reads project state and suggests the single most important next action. Suggest-only — never auto-invokes another skill.

## Inference Chain

Execute these checks in order. Stop at the first match and output the suggestion.

### Step 0: Active feature with actionable plan (GTD primary path)

Check: `.ae/features/active/*/index.md` has at least one feature whose plan-linkage chain (per `ae:dashboard` "Plan linkage" rule — Plan 051+: feature-dir `<feature-dir>/plan.md` first, legacy `output.plans/*.md` with matching `discussion:` field as fallback) yields a plan file with `status: reviewed` AND ≥ 1 `- [ ]` checkbox. Plans are scanned across BOTH `.ae/features/active/F-*/plan.md` (primary) and `output.plans/*.md` (legacy fallback).

For each match, the most-actionable feature has a plan with the highest pending-step ratio (most work remaining). Tiebreaker: highest `id:` (most recent feature first).

```
Active feature with pending work: [feature title] ([N/M] steps done)

Run: /ae:work [linked-plan-path]
```

If multiple at same priority → apply tiebreaker. If still tied → go to Step 9.

This step is the GTD primary path. When `.ae/features/active/` is empty (cold start, post-archive of last feature, or pre-Plan-050 project), this step has no match and the inference falls through to Steps 1-11 below — which retain the legacy/cold-start behavior.

### Step 1: No pipeline config

Check: `.claude/pipeline.yml` does not exist.

```
No pipeline.yml found.

Run: /ae:setup
```

### Step 2: Cold start (no output files)

Check: `pipeline.yml` exists, but no files exist in any `output.*` directory AND `.ae/features/active/` is empty.

```
Project configured but no work started yet.

GTD entry points (recommended):
  /ae:backlog <idea>    — Capture: drop a one-line idea into the inbox
  /ae:roadmap           — Clarify: see promote candidates from backlog
  /ae:analyze <BL-NNN>  — Organize: promote a BL into a feature dir

Direct pipeline (when scope is already clear):
  /ae:analyze <topic>   — research a topic before deciding
  /ae:discuss <topic>   — structured design discussion with agent team
  /ae:plan <feature>    — create an execution plan with acceptance criteria
  /ae:work              — execute plan (TDD + commit + review per step)
  /ae:review            — deep multi-agent review (feature completion gate)

Start with:
  /ae:backlog <idea>    — if you have ideas to capture but aren't sure which to work on
  /ae:plan <feature>    — if requirements are already clear
  /ae:analyze <topic>   — if you need to research first
```

### Step 3: Active analysis

Check: any discussion `index.md` has `pipeline.analyze: in_progress`.

```
Analysis in progress: [title]

Run: /ae:analyze [discussion-dir-path]
```

If multiple → apply tiebreaker (highest ID). If unique → output directly. If tie → go to Step 9.

### Step 4: Active discussions

Check: any discussion `index.md` has `pipeline.discuss: in_progress` or has topic subdirectories with `summary.md` frontmatter `status: pending` or `status: revisit`.

```
Discussion in progress: [title]

Run: /ae:discuss [discussion-dir-path]
```

If multiple → apply tiebreaker (highest ID). If unique → output directly. If tie → go to Step 9.

### Step 5: Concluded discussions without plan

Check: any discussion `index.md` has `pipeline.discuss: done` AND `plan:` field is empty string `""` or missing AND `pipeline.plan` is in `{pending, in_progress}` or missing.

**Guard** — TWO fields must be checked (they are distinct):
- `plan:` (top-level) is the plan-file path — `""` or missing means no plan file exists yet. Necessary but not sufficient.
- `pipeline.plan:` (under `pipeline:`) is the lifecycle state enum. If missing, treat as `pending`. Fire Step 5 only when the state is `pending` or `in_progress`.

| `pipeline.plan:` value | Step 5 fires? |
|---|---|
| `pending` | YES |
| `in_progress` | YES |
| (missing) | YES (fallback → pending) |
| `skipped` | NO (discussion explicitly decided no plan is needed) |
| `done` | NO (plan already exists — should have been caught earlier in chain) |

*Note: this table only disambiguates the `pipeline.plan:` dimension. Both preconditions from the opening check must still hold — Step 5 fires only when `plan:` (top-level) is empty/missing AND the `pipeline.plan:` value above says YES.*

```
Discussion concluded, ready for planning: [title]

Run: /ae:plan
```

If multiple → apply tiebreaker (highest ID). If unique → output directly. If tie → go to Step 9.

### Step 6: Draft plans awaiting review

Check: any plan file has `status: draft`.

```
Plan drafted but not yet reviewed: [title]

Run: /ae:plan-review [plan-file-path]
```

If multiple → apply tiebreaker (highest ID). If unique → output directly. If tie → go to Step 9.

### Step 7: Reviewed plans with uncompleted steps

Check: any plan file has `status: reviewed` AND contains `- [ ]` checkboxes.

**Tiebreaker**: if multiple plans match, select the most recent plan by ID (highest `id:` number). This matches `ae:work`'s argument inference rule — both skills pick the same plan.

```
Plan ready for execution: [title] ([N/M] steps done)

Run: /ae:work [plan-file-path]
```

Tiebreaker always produces a unique result (IDs are unique), so this step never goes to Step 9.

### Step 8: Completed plans without review

Scan plans across BOTH `.ae/features/active/F-*/plan.md` AND `output.plans/*.md` (union — Plan 051+).

Check: any plan file has all checkboxes `- [x]` AND either:
- For feature-dir plans: sibling `<feature-dir>/review.md` does not exist, OR exists with `verdict: fail`.
- For legacy plans: no review file in `output.reviews/*.md` has a `target:` pointing to this plan, OR exists with `verdict: fail`.

Review-state detection scans BOTH `<feature-dir>/review.md` (feature-resident) and `output.reviews/*.md` (legacy) — no surface-index pointer files needed.

```
All plan steps complete, ready for review: [title]

Run: /ae:review [plan-file-path]
```

If multiple → apply tiebreaker (highest ID). If unique → output directly. If tie → go to Step 9.

### Step 9: Multiple items at same stage — disambiguation

When multiple items match the same inference step, list them and use `AskUserQuestion`:

```
Multiple items need attention:

1. [title-A] — [stage description]
2. [title-B] — [stage description]
3. [title-C] — [stage description]

Suggested: #1 ([title-A]) — most recent.
Which would you like to continue? (number or "1" to accept suggestion)
```

Tiebreaker for suggestion: most recent by ID (highest number), consistent with ae:work.

Only use AskUserQuestion here — not for any other inference step.

### Step 10: Committed sprint items without discussion/plan (legacy sprint awareness)

Check: the current version's sprint backlog (`.ae/backlog/<current-version>/`) contains BL items that have **no matching discussion or plan**.

**Legacy-only step**: the sprint/version-grouped model was retired by Plan 050's GTD rewrite of `ae:roadmap`. This step exists for projects that still have legacy `v<X>.<Y>.<Z>/` subdirectories under `.ae/backlog/` from before the GTD migration. New projects (post-Plan-050) skip this step entirely.

**Current version determination** (legacy heuristic): pick the single non-closed roadmap doc among `.ae/roadmaps/v*.md` (top-level legacy version-grouped files, NOT `.ae/roadmaps/active/*.md` which is the new GTD layout); tiebreaker on multiple = lowest semver version. Skip if `.ae/roadmaps/v*.md` files don't exist or all have `closed:` frontmatter set.

**Item-to-artifact lookup** for each BL in the sprint dir:
- Has discussion: some `.ae/discussions/*/conclusion.md` entities list contains the BL-ID, OR some `.ae/discussions/*/index.md` body references the BL-ID
- Has plan: some plan in `output.plans/` body references the BL-ID (deterministic grep; no stage chain)

Items with NEITHER a discussion nor a plan are "sprint-committed but unworked." Suggest starting work on them rather than falling through to Step 11.

```
Committed in sprint <version> but no discussion/plan yet: BL-XXX (title)

Run: /ae:discuss <BL-ID>   — if scope needs clarification first
  or /ae:plan <BL-ID>       — if scope is clear, plan directly
```

If multiple such items → apply tiebreaker (highest priority, then lowest BL ID). If unique → output directly. If tie → go to Step 9.

Skip this step entirely if:
- No current version exists (no non-closed roadmap doc)
- Legacy flat backlog detected (no `v*/` subdirectories in `.ae/backlog/`)

### Step 11: All work complete

Check: `features/active/` is empty AND no active discussions, no pending plans, no uncompleted work, no committed-but-unworked sprint items, all reviews have `verdict: pass` (or plan `status: done`).

```
All pipeline work is complete.

  /ae:roadmap            — see promote candidates from backlog
  /ae:backlog <idea>     — capture a new idea (frictionless inbox drop)
  /ae:retrospect         — project-level review of recently shipped features
  /ae:plugin-stats       — AE plugin self-development outcome stats
```

## State Reading

Read `pipeline.yml` → `output.*` paths (configurable, not hardcoded). Defaults:
- `output.discussions` → `.ae/discussions/`
- `output.plans` → `.ae/plans/`
- `output.reviews` → `.ae/reviews/`

For each directory, scan frontmatter of index/plan/review files. Handle missing or malformed files gracefully — skip and continue to next file.

## Cross-references

When suggesting an action, also note if other items are active:

```
Run: /ae:work .ae/plans/028-ux-shortcuts.md

(2 other active items — run /ae:dashboard for full view)
```

This gives minimal context without duplicating dashboard's full status view.

## Design Notes

- This skill replaces the originally proposed `/ae:getting-started` — the cold-start branch (Step 2) serves first-time users
- Suggest-only, never auto-invoke: outputting exact commands lets users copy-paste or modify before running
- The inference chain is deterministic: given the same project state, ae:next always produces the same suggestion
- AskUserQuestion is reserved for Step 7 only (genuine ambiguity with multiple items at same stage)
