---
name: work
description: "Execute plan (TDD + commit + review, pre-checks chain). Recommended: Sonnet or above"
argument-hint: "<plan file path>"
user-invocable: true
effort: high
---

# /ae:work — execute the plan, one step per commit

Turn an approved plan into commits, leaving behind the evidence that each criterion's
check can actually fail.

## Input

The plan at **$ARGUMENTS** and the acceptance criteria it carries; `<feature-dir>` is the
plan's parent directory. Reread the plan from disk at the start of every step — never from
memory, which compaction drops without saying so.

Do not execute criteria the human has not confirmed. If a step names nothing that would
turn red, send the plan back rather than inventing the missing check.

## Deliverable

Commits on the branch, and a working log at `<feature-dir>/log.md`.

## What must be true of it

- **One step, one commit.** The message says what changed and why, and the project's
  checks are green when it lands.
- **Every check was seen failing before the work that made it pass.** Watching it go red
  first is one way; planting a defect once it is green is another. A check that already
  passed before the change is too loose — fix the check.
- **The log carries the evidence, not the conversation.** For each criterion: the check
  that was run and what it said when it failed; for a criterion that is judged rather
  than run, where the thing to be judged lives. Review must be able to re-run or
  re-judge every criterion from the files alone.
- **A criterion nothing can check is recorded as unchecked.** Never invent a substitute
  check, and never report such a criterion satisfied.
- **Nothing lands in a commit unaccounted for** — either the step it belongs to, or the
  review finding it answers. Anything else is reverted, or the reason it belongs is
  recorded.
- **Every finding raised along the way ends somewhere visible** — fixed, rejected with
  the reason, or deferred with the condition that will resolve it. A finding that just
  disappears is a process failure.
- **The plan tracks reality.** Merge steps, split one that will not close, reorder after
  learning something — then record what changed and why. That needs no permission. Only
  a change to what a criterion *means* does, and that one goes back to analysis through
  the human.

## Refused by review when

A criterion's check was never seen red, or files changed that no step accounts for.

## Human gate

None here. Stop only when a criterion must change; everything else is yours to decide,
note, and continue.
