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
