---
name: work
description: "Execute the plan one step per commit, leaving on disk the evidence that each
criterion's check can fail."
argument-hint: "<plan file path>"
user-invocable: true
effort: high
---

# /ae:work — execute the plan, one step per commit

Turn an approved plan into commits, leaving behind the evidence that each criterion's
check can actually fail.

## Input

Three things. The plan at **$ARGUMENTS**; the signed criteria in `<feature-dir>/acceptance.md`,
`<feature-dir>` being the plan's parent directory; and, when `<feature-dir>/review/returns/` holds
anything, **the items still open on those returns** — that is what a review sent back, and it is
the third thing this pass is working from rather than a file you may or may not go and read.
**List that directory; do not take the set of returns from whatever handed you this task.** A
return can be written after your task was, and then it is on disk and in nothing you were told —
observed, with fifty-four seconds in it.
Reread all three from disk at the start of every step — never from memory, which compaction
drops without saying so.

Do not execute criteria the human has not confirmed. If a step names nothing that would
turn red, send the plan back rather than inventing the missing check.

## Deliverable

Commits on the branch, and a working log at `<feature-dir>/log.md`.

**The log is structured by pass, and a pass heading reads `## Pass N`.** The first pass under
its own heading, and every pass after it under its own, opening with what sent the work back —
the findings, as `review.md` states them. The form is fixed so a reader can find a pass, not
because anything counts these headings; what the loop's bound counts is how many returns
have carried the same open item. **A pass that supersedes an earlier pass's result says
so at the
earlier claim**, not
only in the later pass. This file is a record, so a superseded green stays in it; a reader who
can attribute both claims still cannot tell which is true, and sixty lines is enough to hide
the correction.

**Two kinds of file sit in the feature directory and take opposite treatment.** `analysis.md`,
`acceptance.md`, `plan.md` and `review.md` hold what is true now and are edited in place — so
every statement in them belongs to the current pass, and **none of them carries pass history**.
Saying which pass produced the current state is not history and is not excluded: it dates the
value, it does not accumulate earlier ones beside it. `log.md` holds what happened. Do not go
looking for superseded values in the first kind, and do not edit them out of the second.

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
- **Every occurrence of a check failing is recorded, not the first one per criterion.**
  The loop's bound is not counted over these — it counts how many returns have carried
  the same open item. What needs them is the
  judged bound beside it, which triggers on whether the work *shrinks*: a session that hits
  the same red four times and writes it up once reads as convergence it did not have.
- **Nothing lands in a commit unaccounted for** — either the step it belongs to, or the
  review finding it answers. Anything else is reverted, or the reason it belongs is
  recorded.
- **Every finding ends somewhere visible** — fixed, rejected with the reason, or deferred
  with the condition that will resolve it. That covers both kinds: the ones this stage turns
  up as it goes, and the ones that arrived open on a return. A finding that just disappears
  is a process failure.
- **The log says, item by item, what this pass did with each one it was handed** — naming each
  by the identity the return gave it, not by describing it again. Not that it addressed the
  list: which ones, and what happened to each. A pass that engaged an item and a pass that
  never looked at it are otherwise the same on disk, and a reader who has to match your prose
  to a return's prose is doing the judgement the identities exist to remove.
- **The plan tracks reality.** Merge steps, split one that will not close, reorder after
  learning something — then record what changed and why. That needs no permission. Only
  a change to what a criterion *means* does, and that one goes back to analysis through
  the human.

Three more hold. Each has a section below.

### A verification the plan named that this stage does not perform

**Record it, and record whose it is.**

Declining one can be right: the reader who judges the work belongs to review, and settling it
here would be the author signing off their own work. What is not right is declining silently:
the plan named it, this stage is where it came due, and a verification that disappears between
the stage that named it and the stage that never learned it was owed is a criterion nobody
checked.

### A criterion this stage cannot check

**Record it, and route it by which of two states it is in.**

**No method exists** — the criterion is defective. It goes back to analysis through the human,
since a signed criterion is not yours to move. `ended: criterion-defective` in `log.md`.

**A method exists and a precondition of the world is absent** — the run has to happen somewhere
this stage is not, or after something that has not happened yet. That one is **blocked, not
unchecked**: say what exactly would unblock it, under `ended: blocked`, with a `blocked_by:`
carrying an id and one line for each thing waited on and the detail in the body — the same two
fields `analyze/SKILL.md` uses, for the same reason. That is what the entry's
blocked-on-a-missing-capability rule already requires, and what the word "unchecked" quietly
drops.

Either way the stage stops with work outstanding, and the marker is what says so: a `log.md`
that stops for a reason and one that stops because the run broke off are otherwise the same
file.

Never invent a substitute check, and never report either kind satisfied.

### A claim the plan makes about the repository, found false

**Correct it in `plan.md`, not only in the log.** A plan is written by reading and executed
by doing, so this is the defect a plan is most likely to carry, and the log is not where the
next reader meets it. Record the correction here and make it there. This covers a plan that
misread the tree and a plan whose claim was true when written and is not now; both arrive the
same way and neither is a criterion change.

**Unless the false claim is the criterion's own words**, carried into the plan. Then the plan is
not where it gets fixed: editing it would make the plan misquote what was signed, and leaving it
leaves the plan asserting something false. What is wrong is the criterion, which rests on a
premise that does not hold — that goes back to analysis through the human, by the route above.
Say in `plan.md` that the row has no subject, so the next reader is not the one who discovers it.

## Refused by review when

A criterion's check was never seen red, or files changed that no step accounts for.

## Human gate

None here. Stop only when a criterion must change; everything else is yours to decide,
note, and continue.
