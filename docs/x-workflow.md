# The x workflow — the experiment's instrument, verbatim

> **Status: evidence record (2026-08-28).** This is the exact skill the four
> benchmark runs executed (`/x:work` from the local plugin at ~/Projects/x,
> commit a032d11), reproduced verbatim so [`x-experiment.md`](x-experiment.md)'s
> claims about "the 182-line workflow" resolve to bytes in this repository.
> It is the seed of the post-delete unified entry (`ae:go`), not itself a
> shipped skill.

```markdown
---
name: work
description: Run a work item through a staged workflow — analyze, plan (human confirms the acceptance criteria), work, review (human signs completion). Argument is the task itself, or a path to a file describing it.
---

# /x:work — the workflow

You are running a piece of engineering work through a staged workflow. Each stage
has one responsibility, consumes the previous stage's deliverable, and produces
one deliverable of its own. A stage may refuse what it is given and send it back.
The human sets the goal and signs twice; everything else is yours.

The work item is the argument — free text, or a path to a file describing it.
Derive a short slug from it; every deliverable below lives in `.x/<slug>/` in
the project root.

```
        intent (human)
           │
           ▼
       1 ANALYZE ──── premise fails → stop, report why
           │
           ▼
      [2 DISCUSS] ─── only if a decision is genuinely contested
           │
           ▼  ← HUMAN CONFIRMS the acceptance criteria
       3 PLAN
           │
           ▼
       4 WORK ◄──────────┐
           │             │ findings needing rework
           ▼             │
       5 REVIEW ─────────┘
           │
           ▼  ← HUMAN SIGNS completion
         done
```

Return edges: review sends implementation defects back to WORK. If a criterion
itself turns out wrong or unmeetable, that goes back to ANALYZE — and changing a
criterion always requires the human, because the criteria are what was confirmed.
Everything else — re-planning, re-cutting steps, redoing work — is yours to do
without asking.

## Ground rules (apply to every stage)

- **Criteria are settled before work starts, then never edited silently.** Work
  drifts toward whatever got built; frozen criteria are what stop that.
- **A check must be seen failing before the work that makes it pass.** A check
  that has only ever been green proves nothing. Where no automated check is
  possible, say so explicitly instead of inventing one.
- **The author of a thing never reviews it alone.** Review means fresh eyes:
  a different agent with a clean context, or the human.
- **Every review finding gets an explicit disposition** — fixed, rejected with a
  reason, or deferred with a named condition. A finding that just disappears is
  a process failure.
- **Deliverables are files on disk, not messages.** If the conversation were
  lost, the next stage must be able to proceed from the files alone.
- **Done means the human signed.** Tests green, review passed, agent confident —
  none of these is completion. Only the signature is.

## Stage contracts

### 1 · ANALYZE

**Responsibility:** establish that the problem is real and define what "done"
means — before any solution exists.

**Input:** the work item, the repository.

**Deliverable:** `.x/<slug>/analysis.md` containing:
- *Premise* — three answers with evidence (file:line or a command): Does this
  problem exist today? Has it already been decided the other way somewhere?
  Can success be checked by a command — and if not, what would checking look like?
- *Acceptance criteria* — one row per criterion: an id, the property that must
  hold, and the falsifier (the concrete search/test/question that would expose
  the property NOT holding). A criterion with no falsifier is a wish; either
  find one or mark the row `judgement` and leave it to human review.

**Refused by the next stage when:** a criterion has no falsifier and no
`judgement` mark, or a premise answer has no evidence behind it.

**A `no` premise ends the item.** That is a success, not a failure — report it
and stop.

### 2 · DISCUSS (optional)

**Responsibility:** resolve a genuinely contested decision — one where two
defensible options lead to materially different work.

**Input:** the analysis, the specific contested question.

**Deliverable:** a decision record in `.x/<slug>/`: the options, the choice,
the reason, and what evidence would reopen it.

**Skip it** when no decision is contested. Note "discuss skipped: nothing
contested" in the plan and move on. Do not hold a discussion as ceremony.

### 3 · PLAN

**Responsibility:** decide the method — how the work is cut into steps and how
each criterion will be verified. The criteria themselves are NOT yours to edit;
copy them exactly from the analysis (copy the text programmatically or quote it
verbatim — retyping introduces silent drift).

**Input:** `analysis.md`, any decision records.

**Deliverable:** `.x/<slug>/plan.md` containing:
- Steps, dependency-ordered. Each step: what it does, which criteria it serves,
  which files it expects to touch, and its falsifier (what turns red→green).
- Per criterion: how it will be verified (a command to run, an artifact a human
  will judge, or an honest "manual — human confirms").

**→ HUMAN CONFIRMS here.** Present the criteria and the plan. The human is
confirming the acceptance criteria above all; the step cut is advisory.

**Refused by the next stage when:** a step names no falsifier, or a criterion
in the plan differs from the analysis text.

**Worth one cheap round:** before showing the human, have one fresh-context
agent read the plan against the criteria and answer: does any step build
something no criterion asks for, and would any criterion still be unmet even if
every step passed? Fix what it finds first. Scope questions like these have
caught the worst defects; coverage questions catch fewer.

### 4 · WORK

**Responsibility:** execute the plan, one step per commit.

**Input:** `plan.md` — reread it from disk at each step; do not trust memory.

**Per step:**
1. Write or run the step's check first; observe it fail. Record one line in the
   working log: `RED: <check> — <what the failure said>`.
2. Implement until the check passes. Run the project's test suite.
3. Commit. One step, one commit; the message describes the change and why.
4. If reality disagrees with the plan (a step won't close, a better cut
   appears), change the plan and note what changed and why. That needs no
   permission — only criteria changes do.

**Deliverable:** commits, plus `.x/<slug>/log.md` (the RED lines, decisions
made, anything rejected and why).

**Refused by the next stage when:** a criterion's check was never seen red, or
files changed that no step accounts for.

### 5 · REVIEW

**Responsibility:** judge the work against the criteria — nothing else.

**Input:** the diff, `plan.md`, the working log. Reviewer must be fresh eyes
(see Roles).

**Ask exactly four questions:**
1. Does the delivered work satisfy each criterion? (check the falsifier
   actually ran and actually bit)
2. Would a planted defect have been caught? (pick the most load-bearing
   criterion and try it)
3. Did anything get built that no criterion asked for — and does anything
   the criteria demand remain missing? *(this question finds the worst
   defects; do not skip it)*
4. What was NOT checked? List it honestly — this list is for the human.

**Deliverable:** `.x/<slug>/review.md` — per criterion verdict with evidence,
findings with severity, and the not-checked list. Findings that are
implementation defects go back to WORK; a wrong criterion goes back to ANALYZE
via the human.

**→ HUMAN SIGNS here.** Show: what changed, what was verified and how, every
finding's disposition, and what was not checked. The human signs or doesn't.

## Roles

Other roles exist beyond you: the agent types this session offers, and any the
project defines under `.claude/agents/` — each explains itself in its
description. Default is solo — bring in a role when a stage contract demands
fresh eyes or an independent judgment would change what you do next, never for
ceremony. When you spawn one, tell it its role, what to read, and the one
question it must answer.

## When things go wrong

- **A check refuses your input** — read what it expected vs what it saw, fix,
  retry. Do not ask the human about mechanical refusals.
- **Same failure three times** — stop repeating. Either re-cut the step, or
  conclude the criterion is unmeetable and take it back to ANALYZE.
- **Blocked on a missing capability** — record it as blocked with what exactly
  would unblock it; finish everything else; report at the end. Do not invent a
  substitute check and call it passed.
- **Only stop and wait for the human when:** a criterion must change, a
  signature point is reached, or proceeding under any assumption would make the
  work worthless. Everything else: decide, note the decision, continue.
```
