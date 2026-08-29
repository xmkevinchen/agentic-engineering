---
name: go
description: Run a work item through the whole workflow — analyze, plan (the human confirms the acceptance criteria), work, review (the human signs completion). Invokes each stage's skill in turn. The argument is the work item itself, or a path to a file describing it.
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
       1 ANALYZE ──── premise fails → stop, report why
           │
           ▼
      [2 DISCUSS] ─── only if a decision is genuinely contested
           │
           ▼
       3 PLAN
           │
           ▼  ← HUMAN CONFIRMS the acceptance criteria
       4 WORK ◄──────────┐
           │             │ findings needing rework
           ▼             │
       5 REVIEW ─────────┘
           │             ╌╌╌► a criterion changes — back to ANALYZE, via the human
           ▼  ← HUMAN SIGNS completion
         done
```

## Running it

Invoke each stage's skill. After it returns, read its deliverable off disk and check the
handover before going on — a stage that would be refused is sent back now, not discovered
three stages later.

**1 · Invoke `/ae:analyze` with the work item.**
Then read `<feature-dir>/analysis.md`. Send it back when a criterion has no falsifier and no
judgement mark, or a premise answer rests on no evidence.
*A `no` premise ends the item here.* Report what was found and stop; that is a result.

**2 · Invoke `/ae:discuss` only if a decision is genuinely contested** — two defensible
options leading to materially different work. Nothing contested → skip it and say so in the
plan. Then read the decision record. Send it back when a question it opened is still open,
when its reason cites nothing a reader can open, or when it exists only in the conversation.

**3 · Invoke `/ae:plan` with the feature directory.**
Then read `<feature-dir>/plan.md`. Send it back when a step names no check to turn red, or a
criterion's text differs from the analysis.

**→ HUMAN CONFIRMS.** Present the criteria first — that is the thing being confirmed; the
step cut is advisory. **Wait.** Work does not start without it.

**4 · Invoke `/ae:work` with the plan path.**
Then read the commits and `<feature-dir>/log.md`. Send it back when a criterion's check was
never seen red, or when files changed that no step accounts for.

**5 · Invoke `/ae:review` with the plan path.**
Then read `<feature-dir>/review.md`. Implementation defects go back to step 4 — the ordinary
loop, needing nobody's permission. A finding that would change what a criterion *means* goes
back to step 1, and only through the human.

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
- **Deliverables are files on disk, not messages.** If the conversation were lost, the next
  stage must be able to proceed from the files alone.
- **Done means the human signed.** Tests green, review passed, agent confident — none of these
  is completion. Only the signature is.

Re-planning, re-cutting steps, redoing work — all yours, without asking. Only a change to
what a criterion *means* needs the human.

## When things go wrong

- **A check refuses your input** — read what it expected against what it saw, fix, retry. Do
  not ask the human about mechanical refusals.
- **Same failure three times** — stop repeating. Either re-cut the step, or conclude the
  criterion is unmeetable and take it back to ANALYZE.
- **Blocked on a missing capability** — record it as blocked with what exactly would unblock
  it; finish everything else; report at the end. Do not invent a substitute check and call it
  passed.
- **Only stop and wait for the human when** a criterion must change, a signature point is
  reached, or proceeding under any assumption would make the work worthless. Everything else:
  decide, note the decision, continue.
