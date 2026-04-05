---
name: ae:next
description: Suggest the next pipeline step based on project state
user_invocable: true
---

# /ae:next — Next Step Suggestion

Reads project state and suggests the single most important next action. Suggest-only — never auto-invokes another skill.

## Inference Chain

Execute these checks in order. Stop at the first match and output the suggestion.

### Step 1: No pipeline config

Check: `.claude/pipeline.yml` does not exist.

```
No pipeline.yml found.

Run: /ae:setup
```

### Step 2: Cold start (no output files)

Check: `pipeline.yml` exists, but no files exist in any `output.*` directory.

```
Project configured but no work started yet.

The AE pipeline:
  /ae:analyze  — research a topic before deciding
  /ae:discuss  — structured design discussion with agent team
  /ae:plan     — create an execution plan with acceptance criteria
  /ae:work     — execute plan (TDD + commit + review per step)
  /ae:review   — deep multi-agent review (feature completion gate)

Start with:
  /ae:analyze <topic>   — if you need to research first
  /ae:discuss <topic>   — if you're ready to make design decisions
  /ae:plan <feature>    — if requirements are already clear
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

Check: any discussion `index.md` has `pipeline.discuss: done` AND `plan:` field is empty string `""` or missing.

**Guard**: `plan: ""` means no plan exists — treat empty string as absent.

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

Check: any plan file has all checkboxes `- [x]` AND either:
- No review file in `output.reviews` has a `target:` pointing to this plan, OR
- A review file exists but has `verdict: fail` (needs re-review after fixup)

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

### Step 10: All work complete

Check: no active discussions, no pending plans, no uncompleted work, all reviews have `verdict: pass` (or plan `status: done`).

```
All pipeline work is complete.

  /ae:retrospect         — analyze execution trends and insights
  /ae:discuss <topic>    — start a new design discussion
  /ae:plan <feature>     — plan a new feature directly
```

## State Reading

Read `pipeline.yml` → `output.*` paths (configurable, not hardcoded). Defaults:
- `output.discussions` → `docs/discussions/`
- `output.plans` → `docs/plans/`
- `output.reviews` → `docs/reviews/`

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
