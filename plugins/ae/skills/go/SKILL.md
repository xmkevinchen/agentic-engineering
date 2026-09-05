---
name: go
description: "Run a work item through the whole workflow — analyze, discuss, plan, work, review. The human confirms the acceptance criteria once they stop moving, and signs completion. Invokes each stage's skill in turn. The argument is the work item itself, a path to a file describing it, or an existing F-NNN to resume."
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
**If the feature directory holds any `returned-N.md`, move them into `<feature-dir>/returned/`
once the human confirms** — those returns were taken against criteria that are no longer the
ones signed, and the bound counts returns against the criteria in force.
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

**Before sending it back, count the returns — including the one you are about to make.** A
return is review handing findings back to work, and each one leaves a file: review writes
`<feature-dir>/returned-N.md` at the moment it sends findings back. The third return ends the
loop: re-cut the step, or conclude the criterion is unmeetable and take it back to step 1.

**Count the files, never what this session remembers.** `returned-1.md`, `returned-2.md`, and so
on — the count is how many exist, and the one you are about to write is the next number. The
count that lives in a session is reset by an ordinary resume, and a loop nobody is watching is
exactly the one whose bound must survive the watcher leaving.

A feature that has none of these files has taken no returns this bound can see. That is the
honest answer for a feature worked before the files existed, and it starts from zero rather
than pretending to a history nothing recorded.

**Re-signed criteria start a new loop, and the files move rather than go.** When the human
confirms `acceptance.md` again — after a criterion changed, or after this bound sent the work
back to step 1 — move every `returned-N.md` into `<feature-dir>/returned/` before planning
starts. The count is the files at the top of the feature directory, so it is zero again; the
ones underneath stay readable, and the next numbering starts from one. Without this a feature
that took the bound's own exit would come back already at three and stop before it worked.

**This count cannot tell a loop that is converging from one that is stuck.** Three returns
that each fixed something real count the same as three that changed nothing. What tells
those apart is the rate bound under *When things go wrong* — several rounds each fixing
something real while the work does not shrink — and it fires earlier, on softer evidence.
Read it first. This one is the backstop for when nobody does.

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
- **The third return** — a return is review handing findings back to work; the bound is at
  step 5, where the loop is actually taken, and it is counted off `log.md` and `review.md` by
  the rule stated there. The count exists because that loop is unattended: nothing else is
  watching it repeat, so what ends it cannot be a judgement the loop makes about itself. It
  counts returns and nothing inside them, so it cannot tell converging from stuck — the
  bullet below is what does. A loop that waits on a human is not this one — it advances only
  when they answer, and they can see they were asked.
- **Several rounds each fixing something real, and the work does not shrink** — real to the
  round that found it, which is why every round looks fine from inside; whether it was real
  is what the next round keeps re-opening. The trigger is the rate, not the failures. Stop and ask what is
  *generating* these, then cut along that axis. That is a re-division, still inside the loop —
  not an escalation. Only a criterion that cannot be met however the work is divided leaves it.
- **Blocked on a missing capability** — record it as blocked with what exactly would unblock
  it; finish everything else; report at the end. Do not invent a substitute check and call it
  passed.
- **Only stop and wait for the human when** a criterion must change, a signature point is
  reached, or proceeding under any assumption would make the work worthless. Everything else:
  decide, note the decision, continue.
