# Stage handovers — refusing, re-dividing, escalating

> Source: F-086 (2026-08-27). Two Kernel dogfood runs and twenty review rounds.
> Single source of truth for what one pipeline stage owes the next and may refuse
> from it. Path from any `plugins/ae/skills/<x>/SKILL.md` = `../../handover.md`.

## The rule

**A handover contract is not what a stage produces. It is what the next stage will
refuse it for.** It has two halves and neither works alone:

- **Push** — before handing anything over, run every check the receiving stage will
  run. What is handed over must already be something that stage would accept.
- **Pull** — the receiving stage **may refuse what it is given** and send it back.

Push alone is the sender guessing at a standard nobody wrote down. Pull alone is the
receiver complaining after the cost is sunk.

### Refusing

A refusal **names the admission check that failed**. One that does not name one is not
a refusal, it is a preference, and it does not stop the work.

**A refusal goes back one stage, never to the start.** That is what makes it cheap
enough to use. One refusal is a loop iteration, not a restart.

### What each stage may refuse

| receiving | may refuse for |
|---|---|
| discuss / plan, from analyze | the premise verdict's citation does not hold when re-run — the file, the line or the command does not say what the verdict claims |
| plan, from analyze or discuss | a criterion with no falsifier and no `judgement` mark, so plan would have to invent the standard it is planning against |
| work, from plan | a step with no falsifier, or one marked `Self-closing: no` with nothing named as covering it |
| review, from work | a deterministic AC with no `FALSIFIED_AC` record — the check has only ever been green |
| analyze, from anywhere | a criterion that cannot be met however the work is divided |

An upstream verdict is **provisionally true**: proceed on it, and it stays refutable.
That is why it is recorded as a citation — `file:line` or a command — and not as "I
checked". Anyone downstream can re-run the citation, and a citation that does not hold
refutes the verdict.

This is the model the V1 Kernel already uses on itself: a Contract cites its sources by
digest and quote, and **approval verifies the quoted passage is actually in the file**
before accepting. The pipeline had the citing half and not the verifying half.

## Re-dividing is not escalating

Two different actions, and confusing them is expensive.

| what you see | what to do |
|---|---|
| findings keep arriving, and the work does not shrink | **re-divide.** The partition is wrong, not the criterion. Ask *what is generating these* and cut along that axis instead. Still inside the loop. |
| the criterion cannot be met however the work is divided | **escalate.** Leave the loop, go back to analyze. |
| the premise's citation does not hold | **escalate.** Back to analyze; the item may end there. |

**Only a principled error leaves the loop.** Findings arriving faster than expected, a
change turning out larger than expected, edits landing in more places than expected —
none of these is a reason to escalate. They are all reasons to cut differently.

### The evidence for that distinction

Twenty review rounds on the V1 Kernel. **The first fourteen each found something real
and fixed one thing, and the set never shrank** — the partition was by instance. Round
fifteen asked *"is this the tail, or is something generating these?"* and the next five
rounds closed five families.

Round fifteen was not an escalation. It was a **re-division**, inside the same loop.
Nothing triggered it; someone happened to ask. The existing fix-loop circuit breaker
cannot catch it either — it counts consecutive failures of one test file, and here every
round succeeded at fixing a different thing. From inside the loop everything looked fine.

**So the trigger is the rate, not the failures:** several consecutive rounds each
producing findings, with no round changing the structure, means stop and ask what is
generating them.

## What needs a signature, and what does not

Almost nothing does. The rule is narrow on purpose:

> **A change needs a signature when it changes what someone already agreed to.**
> Everything else is edited in place, inside the loop, by whoever is holding it.

The discriminator is **direction relative to the frozen criteria**, not size:

| the change | signature |
|---|---|
| **toward** the criteria — a re-cut stack, a merged step, a different order, a rewritten paragraph | **no**, however much of the plan moves |
| **to** the criteria — the property, or the falsifier | **yes** |

Work that moves toward a standard does not need permission to move; that is what having
the standard was for.

The pipeline already draws this line and it is drawn in the right place: **only the goal
is frozen** — the acceptance criteria — and the plan around it stays editable while work
runs (`plan/SKILL.md`, Freeze the GOAL). Steps get reordered, wording gets fixed, the
stack gets re-cut; none of that touches what anyone agreed to. Requiring ceremony for
those would end the loop, which is the thing the loop exists to keep cheap.

### The one place it applies

**A criterion changed after it was frozen.** That is the whole list.

It arrives one way: review finds that a fix would change what a criterion *means*, which
is an escalation back to analyze rather than a defect in the code. What happens next was
not written down anywhere:

1. analyze amends the criterion — the property, the falsifier, or both.
2. **The goal is re-frozen**, and that is the signature point. The prior frozen goal is
   not edited; a new one supersedes it and the old one stays readable, because work
   already done was done against it.
3. The amendment records **what changed and why**, beside the goal rather than inside it.

An amended criterion is a new agreement about what "done" means. Work completed under the
prior one was not wrong — it met the standard that was in force — and a record that
overwrites the old standard makes that impossible to see afterwards.

### Who decides, inside the loop

**One gate, and it is the same one.** The frozen criteria are the agreement between the
human and the loop. Inside them, the loop is autonomous:

| situation | who |
|---|---|
| the criteria are unchanged | **the loop** — including re-opening a discussion, re-cutting the stack, choosing a different design, discarding work and redoing it |
| a criterion must change | **the human**, once, at the signature point |

**A design that fails at acceptance is not an escalation.** It is the loop working: the
criteria held, the design did not, so the loop goes back to discuss, decides differently,
and comes forward again. Nobody agreed to the design. Asking permission to change it stops
the loop to confirm something no one had a stake in.

This is not a preference about ceremony. **A loop that pauses for a human on every
deviation is not a loop** — it runs at the speed of someone's inbox, and the person becomes
the obstacle rather than the authority. The authority is exercised once, on the criteria,
and then the loop is trusted to reach them.

**What remains genuinely the human's**, and stays that way:

- changing a criterion — the property or the falsifier;
- a decision the criteria do not cover at all, where proceeding either way would be a
  guess about intent rather than about implementation;
- anything outside the loop's authority to begin with — spending money, sending
  something outward, touching what it was not granted.

Everything else that feels like it needs asking is either already answered — look it up —
or answerable by evidence — go and check. Both are cheaper than asking, and both are
the loop doing its job.

### The plan is expected to change

A loop that cannot change its plan is not a loop. Re-cutting the stack mid-work — merging
two steps, splitting one that would not close, reordering after learning something — is
**the normal in-loop action**, the same re-division described above. It needs no
signature and no approval, because nobody agreed to the stack; they agreed to the goal,
and the goal is frozen separately for exactly this reason.

What it does need is a **line saying it happened**: one entry in the milestone notes
naming what was re-cut and why. Not a gate — information. How the stack actually went
compared with how it was drawn is the most useful thing anyone learns from a completed
feature, and it is invisible if the plan is quietly rewritten to match the outcome.

The existing drift check is a narrower version of the same idea and stays as it is: it
watches which **files** a step touched against the ones it declared, and an unexpected one
is explained rather than forbidden. This is that, one level up, watching the **steps**.

### Why the Contract is different, and is not the general case

F-086's Contract is byte-frozen and gets an `amendments.md` beside it, because for a
Contract the bytes **are** the agreement: change one and the thing that was accepted no
longer exists. That is correct for a Contract and it is not a template for everything
else. Most artifacts in a pipeline are working notes, and treating a working note as a
contract is how a process acquires ceremony nobody can point at a reason for.
