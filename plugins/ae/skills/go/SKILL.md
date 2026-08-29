---
name: go
description: Run a work item through the staged workflow — analyze, plan (the human confirms the acceptance criteria), work, review (the human signs completion). The argument is the work item itself, or a path to a file describing it.
user-invocable: true
---

# /ae:go — the workflow

Run a piece of work through five stages. Each stage has one responsibility, consumes the
stage before it, and produces one deliverable of its own. A stage may refuse what it is
given and send it back. The human sets the goal and signs twice; everything else is yours.

Every deliverable lives in this work item's feature directory,
`.ae/features/active/F-NNN-<slug>/`, written below as `<feature-dir>`.

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

## The stages

Each stage is executed by its own skill. This document is the graph; what a stage owes is
in that skill, and is not repeated here.

| | stage | skill | deliverable | the next stage may refuse it for |
|---|---|---|---|---|
| 1 | ANALYZE | `/ae:analyze` | `<feature-dir>/analysis.md` | a criterion with no falsifier and no judgement mark; a premise answer with no evidence |
| 2 | DISCUSS | `/ae:discuss` | a decision record in `<feature-dir>/` | a question it opened still open; a reason citing nothing a reader can open; a record that exists only in the conversation |
| 3 | PLAN | `/ae:plan` | `<feature-dir>/plan.md` | a step that names no check to turn red; a criterion whose text differs from the analysis |
| 4 | WORK | `/ae:work` | commits, plus `<feature-dir>/log.md` | a criterion's check never seen red; files changed that no step accounts for |
| 5 | REVIEW | `/ae:review` | `<feature-dir>/review.md` | — |

DISCUSS runs only when a decision is genuinely contested — two defensible options leading to
materially different work. Nothing contested → skip it, and say so in the plan.

## The two gates

**→ HUMAN CONFIRMS**, at the end of PLAN. The criteria are presented first; that is the thing
being confirmed. The step cut is advisory. Work does not start without it.

**→ HUMAN SIGNS**, at the end of REVIEW. Done means the human signed — not tests green, not a
pass verdict. A gate the executed party can open is not a gate.

## Return edges

Review sends implementation defects back to WORK. That is the ordinary loop and needs
nobody's permission.

If a criterion itself turns out wrong or unmeetable, that goes back to ANALYZE — and
**changing a criterion always requires the human**, because the criteria are what was
confirmed. Work already done was done against the criteria as confirmed.

Everything else — re-planning, re-cutting steps, redoing work — is yours to do without asking.

## Ground rules (every stage)

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
