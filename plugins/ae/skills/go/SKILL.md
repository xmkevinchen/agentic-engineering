---
name: go
description: "Run a work item through the whole workflow — analyze, discuss, plan, work, review.
The human confirms the acceptance criteria once they stop moving, and signs completion. Invokes
each stage's skill in turn. The argument is the work item itself, a path to a file describing
it, or an existing F-NNN to resume."
user-invocable: true
---

# /ae:go — run the work item through the workflow

You are running one piece of work end to end. This document is the whole programme: the
order of the stages, what every stage obeys, and where the work stops for a human. **What a
stage does is in that stage's own skill — invoke it, do not re-derive it here.**

The work item is **$ARGUMENTS**. Everything it produces lives in one feature directory,
written below as `<feature-dir>`; `/ae:analyze` creates it.

```
        intent (human)
           │
           ▼
       1 ANALYZE ──┬── material only the human has → ask, loop here on F-NNN
           │       ├── nothing to do, or already decided → stop, item closed
           │       └── several items, not one → stop, the human picks the cut
           ▼
      [2 DISCUSS] ─── one run per question ANALYZE named; none named → skipped
           │       ──► premise wrong → returned-<id>.md, back to ANALYZE
           │
           ▼  ← HUMAN CONFIRMS the acceptance criteria
       3 PLAN
           │
           ▼
       4 WORK ◄──────────┐
           │             │ findings needing rework
           ▼             │
       5 REVIEW ─────────┘
           │             ╌╌╌► a criterion changes — back to ANALYZE, via the human
           ▼  ← HUMAN SIGNS completion
         done
```

## Running it

Invoke each stage's skill. After it returns, read its deliverable off disk and check it
against what the next stage would refuse it for, below, before going on — a stage that would
be refused is sent back now, not discovered three stages later.

An `F-NNN-<slug>` as the argument is a resume: read what that directory already holds and
enter at the first thing not done.

### 1 · Analyze

**Invoke `/ae:analyze` with the work item.**

It may not deliver, in any one of three ways. None of the three is a failure, and none of them
is yours to work around.

- *Material only the human has* — this loops rather than exits. Pass each request on in the
  words it was made, add nothing, and put the answer back into the same step. The directory and
  `analysis.md` exist from the first pass, with the asks in `blocked_by:` and no `acceptance.md`
  yet, so the human can come back to `/ae:go F-NNN-<slug>` instead of the original request.
- *Nothing to do, or already decided the other way* — this closes the item. Report what was
  found and stop. That is a result.
- *Several items, not one* — this replaces it. Put the proposed cut to the human and run this
  step again on each piece they keep, one feature directory each.

Otherwise read `<feature-dir>/analysis.md` and `<feature-dir>/acceptance.md`, and send it back
when a criterion has no falsifier and no judgement mark, or an answer rests on no evidence.

### 2 · Discuss

**Invoke `/ae:discuss` once per id in the analysis frontmatter's `discuss:` list.** An empty
list is a decision already made, not an omission, and you do not second-guess it into a
discussion. Each run settles one id.

**Read the feature directory before you invoke anything: a `returned-<id>.md` means that id is
back at step 1, not here** — a discussion that sent a question back does not want it re-run, it
wants the analysis changed.

Then read each decision record. Send it back on any one of these counts:

- a question it opened is still open;
- its reason cites nothing a reader can open;
- it exists only in the conversation;
- it changed what a criterion means without changing `acceptance.md` to match;
- one party argued both sides and the record does not say why no other was reachable.

A decision that changes what a criterion means changes `acceptance.md` before the signature,
not after.

### → HUMAN CONFIRMS the criteria

The criteria have stopped moving; this is where they are confirmed.
**If `<feature-dir>/returns/` holds any numbered file, move them into the next free
`<feature-dir>/returns/superseded-N/` once the human confirms** — those returns were taken
against criteria that are no longer the ones signed, and the bound counts returns against the
criteria in force.
Present `acceptance.md` — that is the thing being confirmed. Show alongside it the questions
the analysis named and how each was settled, and, when it named none, that it named none:
that judgement is the one most worth disagreeing with, and it is invisible unless shown.
**Wait.** Planning does not start without it.

### 3 · Plan

**Invoke `/ae:plan` with the feature directory.**
Then read `<feature-dir>/plan.md`. Send it back when a step names no check to turn red, or a
step accounts for no criterion. The plan cites criteria by id; it does not restate them.

### 4 · Work

**Invoke `/ae:work` with the plan path.**
Then read the commits and `<feature-dir>/log.md`. Send it back when a criterion's check was
never seen red, or when files changed that no step accounts for.

### 5 · Review

**Invoke `/ae:review` with the plan path.**
Then read `<feature-dir>/review.md`. Implementation defects go back to step 4 — the ordinary
loop, needing nobody's permission. A finding that would change what a criterion *means* goes
back to step 1, and only through the human.

### Before sending it back, count

**Before sending it back, count — and what you count is an item, not a return.** A return is
review handing findings back to work, and it leaves a numbered file in `<feature-dir>/returns/`
listing the items that failed, each with an identity. **An item still open on three consecutive
returns ends the loop:** re-cut the step, or conclude the criterion is unmeetable and take it back
to step 1.

**Count over the files, never over what this session remembers.** For each item still open, count
back through `returns/` and see how many consecutive returns have carried it. The count that lives
in a session is reset by an ordinary resume, and a loop nobody is watching is exactly the one whose
bound must survive the watcher leaving.

A feature with no `returns/` has taken no returns this bound can see. That is the honest answer for
one worked before the files existed, and it starts from zero rather than pretending to a history
nothing recorded.

**Re-signed criteria start a new loop, and the files move rather than go.** When the human confirms
`acceptance.md` again, move everything in `returns/` into the next free
`<feature-dir>/returns/superseded-N/` before planning starts. Items open against criteria that were
then rewritten are not open against the ones now signed, so their counts do not carry.

**Three shapes, and only one of them is this count's.**

- **One item that will not close.** Three consecutive returns carrying it, and this count ends the
  loop. That is what it is for.
- **Items that close while the same trouble comes back wearing a new one.** Every item resolved,
  every round raising fresh ones from the same source. This count never fires — each item's run is
  one — and the rate bound under *When things go wrong* is what catches it, because that is exactly
  its trigger: several rounds each fixing something real while the work does not shrink. **Read it
  first.** It fires earlier and on softer evidence, and it is the one that sees a pattern this
  count is blind to by construction.
- **Genuinely new work each round, converging.** Neither fires, and neither should.

**The rate bound reads the record, not the count** — including `returns/superseded-N/`, where a
re-signature puts the evidence that a pattern has been running longer than the current loop. A
feature that has circled through two signatures reads as zero here and reads as itself there.

### → HUMAN SIGNS completion

**→ HUMAN SIGNS.** Show what changed, what was verified and how, every finding's
disposition, and what was not checked. Done means the human signed — not tests green, not a
pass verdict. A gate the executed party can open is not a gate.

## What every stage obeys

- **Criteria are settled before work starts, then never edited silently.** Work drifts toward
  whatever got built; settled criteria are what stop that.
- **A check must be seen failing before the work that makes it pass.** A check that has only
  ever been green proves nothing. Where no automated check is possible, say so explicitly
  instead of inventing one.
- **The author of a thing never reviews it alone.** Fresh eyes: a different agent with a clean
  context, a different model family, or the human.
- **Every finding gets an explicit disposition** — fixed, rejected with a reason, or deferred
  with a named condition. A finding that just disappears is a process failure.
- **A deliverable holds what is true now, not how it got there.** These files are what the
  next stage and the next session know. A superseded criterion kept beside the current one is
  a wrong memory that reads like a right one; a version history in the file is the same thing
  spread out. Change the file and take the signature again — re-signing is cheap, and the
  history is in version control for whoever actually needs it.
- **Deliverables are files on disk, not messages.** If the conversation were lost, the next
  stage must be able to proceed from the files alone.
- **Done means the human signed.** Tests green, review passed, agent confident — none of these
  is completion. Only the signature is.

Re-planning, re-cutting steps, redoing work — all yours, without asking. Only a change to
what a criterion *means* needs the human.

## When things go wrong

- **A check refuses your input** — read what it expected against what it saw, fix, retry. Do
  not ask the human about mechanical refusals.
- **One item, three returns running** — the bound is at step 5, where the loop is actually
  taken, and what it counts is how many consecutive returns have carried the same open item,
  by the rule stated there. The count exists because that loop is unattended: nothing else is
  watching it repeat, so what ends it cannot be a judgement the loop makes about itself. It
  reads identities and never what an item says, so it is blind to the trouble that closes
  under one name and reopens under another — the bullet below is what sees that, and it fires
  first. A loop that waits on a human is not this one — it advances only when they answer, and
  they can see they were asked.
