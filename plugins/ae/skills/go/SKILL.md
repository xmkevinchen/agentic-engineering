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

Invoke each stage's skill. After it returns, and before the next stage is invoked, run
the check. `check-stage-delivery.py` ships beside this skill at `scripts/check-stage-delivery.py`
under the plugin root — in a checkout of AE itself that is `plugins/ae/scripts/`, and in an
installed copy it is under the installed plugin. Locate it once and reuse the path:

```sh
python3 <plugin-root>/scripts/check-stage-delivery.py <feature-dir> <stage>
```

Its whole input is those two arguments. It never reads this conversation or the stage's own
account of what it wrote, which is why it can contradict a stage that reported success — and
why it is not the stage marking its own work. **A non-zero exit is not advice.** Close what it
names, here, before going on: a stage that would be refused is sent back now, not discovered
three stages later.

**First, read which kind of refusal it is.** A check that refuses your *input* — the path you
gave it resolves nowhere — is the ordinary mechanical refusal under *When things go wrong*: read
what it expected against what it saw, fix the argument, retry, and send no stage anywhere. Only a
check reporting on a *deliverable* is what the rest of this governs. The script draws that line
in its own messages and says which one you have; a reader who skips them will re-invoke a stage
over a mistyped path.

**Closing it means invoking the stage again with what the check said** — not writing the missing
part yourself, which makes you the author of a deliverable nobody then checks, and not going on.
**What sends it to the human is the same gap surviving, not the check failing twice.** A second
run that fails on a different gap has closed the first one; run it again. A gap the stage has now
had two goes at and not closed is not something a third fixes. A stage that keeps producing fresh
gaps without shrinking is the rate bound under *When things go wrong*, not this.

Re-invoking needs the stage's argument, and for every stage but ANALYZE that is a file the
stage before it left. ANALYZE writes the feature directory and `analysis.md` as its first act
so a resume has the work item too. **If even that is missing — nothing on disk and the work
item only in a conversation you no longer have — stop and say so.** That is the one case where
the instruction above cannot be carried out, and improvising past it means writing the
deliverable yourself or going on, which are the two moves it forbids.

Exit 0 means no mechanical violation, not that the stage conformed. Then read the deliverable
yourself against what the next stage would refuse it for, below.

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
**If any item is still open, go down the list with the human as they confirm** — each one is
either closed here, because the criterion it failed is no longer the one signed, or it stays open
and keeps the count it has. An item that is still a problem against the criteria now in force does
not stop being one because a different criterion changed.
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
Then read `<feature-dir>/review.md` and route on its verdict, which is written to be routed on:
`fail` sends the open items back to step 4 — the ordinary loop, needing nobody's permission;
`criterion-unsettled` goes to step 1 through the human, because what is in question is a
criterion they signed; `pass` goes to the signing gate below. A review that ended `blocked`
judged nothing to route on — close what it waited on and invoke it again.

Within a `fail`, a finding that would change what a criterion *means* still goes back to step 1
through the human, even though the rest of the items go to step 4.

**Send it back when the verdict is not one of those three**, or when a criterion's verdict says
only that it was read. A review that qualifies a pass in prose has left the next step to you to
guess, and a criterion nobody ran a check against is a verification still owed, not a judgement.

### Before sending it back, count

**Before sending it back, count — and what you count is an item still open, not a return.** A
return leaves a numbered file in `<feature-dir>/review/returns/` listing the items review found,
each with an identity: some still open — handed back to work — and some closed on arrival,
rejected or deferred rather than sent back. **An item open on three returns
ends the loop:** re-cut the step, or conclude the criterion is unmeetable and take it back
to step 1.

**Count over the files, never over what this session remembers.** For each item still open, count
back through `review/returns/` and see how many have carried it — counting the one that raised
it and every one since that did not close it. The count
that lives
in a session is reset by an ordinary resume, and a loop nobody is watching is exactly the one whose
bound must survive the watcher leaving.

A feature with no `review/returns/` has taken no returns this bound can see. That is the honest
answer for
one worked before the files existed, and it starts from zero rather than pretending to a history
nothing recorded.

**Re-signed criteria do not reset anything on their own.** The count is not a thing kept beside
the items; it is what the items on `review/returns/` say. So when the human confirms `acceptance.md`
again, nothing moves and nothing is renumbered — each open item is closed at the gate or carried,
and a carried item keeps every return it has stood on. `review/returns/` is one sequence for the
life of
the feature, which is why `N.k` never collides and why nothing has to decide where numbering
restarts.

The reason not to zero them: an item that is still a problem against the criteria now in force has
not stopped being one because some other criterion changed. Zeroing loses exactly the item worth
keeping.

**Three shapes, and only one of them is this count's.**

- **One item that will not close.** Three returns carrying it, and this count ends the
  loop. That is what it is for.
- **Items that close while the same trouble comes back wearing a new one.** Every item resolved,
  every round raising fresh ones from the same source. This count never fires — each item's run is
  one — and the rate bound under *When things go wrong* is what catches it, because that is exactly
  its trigger: several rounds each fixing something real while the work does not shrink. **Read it
  first.** It fires earlier and on softer evidence, and it is the one that sees a pattern this
  count is blind to by construction.
- **Genuinely new work each round, converging.** Neither fires, and neither should.

**The rate bound reads the record, not the count** — every return the feature has, including the
ones whose items were closed at a confirmation gate. A pattern that has run through two signatures
is invisible to a count of open items and plain in the files.

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
- **A stage that ends without its full deliverable set says so in what it did write.** An
  `ended:` field in the frontmatter of the deliverable it got as far as writing, naming which
  ending it was; absent when the stage delivered. Each stage's own skill lists the values it
  has, and none is invented here. Without it, a directory left by a legitimate stop and one
  left by a run that broke off are the same shape on disk, and nobody — the next stage, the
  human, or a check — can tell which happened.
- **Done means the human signed.** Tests green, review passed, agent confident — none of these
  is completion. Only the signature is.

Re-planning, re-cutting steps, redoing work — all yours, without asking. Only a change to
what a criterion *means* needs the human.

## When things go wrong

- **A check refuses your input** — read what it expected against what it saw, fix, retry. Do
  not ask the human about mechanical refusals.
- **One item, three returns running** — the bound is at step 5, where the loop is actually
  taken, and what it counts is how many returns have carried the same open item,
  by the rule stated there. The count exists because that loop is unattended: nothing else is
  watching it repeat, so what ends it cannot be a judgement the loop makes about itself. It
  reads identities and never what an item says, so it is blind to the trouble that closes
  under one name and reopens under another — the bullet below is what sees that, and it fires
  first. A loop that waits on a human is not this one — it advances only when they answer, and
  they can see they were asked.
- **Several rounds each fixing something real, and the work does not shrink** — the trigger is
  the rate, not the failures: real to the round that found it, which is why every round looks
  fine from inside, and whether it was real is what the next round keeps re-opening. This is
  the shape the count above is blind to, and it fires earlier and on softer evidence. Stop and
  ask what is *generating* these, then cut along that axis. That is a re-division, still inside
  the loop — not an escalation. Only a criterion that cannot be met however the work is divided
  leaves it.
- **Blocked on a missing capability** — record it as blocked with what exactly would unblock
  it; finish everything else; report at the end. Do not invent a substitute check and call it
  passed.
- **Only stop and wait for the human when** a criterion must change, a signature point is
  reached, or proceeding under any assumption would make the work worthless. Everything else:
  decide, note the decision, continue.
