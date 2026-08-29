# The Harness loop — nodes, delivery contracts, and return paths

> **Status: historical (2026-08-28).** This graph describes the archived
> Kernel's loop (tag `v1-kernel-archive`). Every node remains implemented and
> none is reachable — which is no longer a gap to close but the archived state.
> See [`x-experiment.md`](x-experiment.md).

> **Status: current.** Companion to [`design.md`](design.md). It expands §8's
> roles and handoffs into the whole graph: every node, what each owes the next,
> and every edge that goes backwards. Where it appears to contradict `design.md`
> about what v1 *is*, `design.md` is current and this document is wrong.

`design.md` §8.2 draws the handoffs that must close as a chain with one loop.
That chain is true and is not the whole graph: the return paths live in §10's
prose, the stage-level rings live in
[`handover.md`](../../plugins/ae/handover.md), and nothing has drawn them
together. This document is that drawing.

**Why it exists before the entry point is built.** An entry point is a way in to
*something*. Deciding its shape before the graph is named lets the first fixture
decide the product's semantics by accident.

## 1. One loop, two views

Two vocabularies describe AE and they are not two systems:

| View | Vocabulary | What it is |
|---|---|---|
| **Kernel** | Contract, Assignment, Attempt, Observation, Review, Disposition, Gate, Acceptance | The durable record. What actually happened, and what completion rests on. |
| **Skills** | `analyze`, `discuss`, `plan`, `work`, `review` | Controllers and views over that loop. |

This is settled, not proposed — `design.md` §1.1: *"Those commands are
controllers and views **over the loop**; they are not the definition of
completion, and none of them is mandatory for a small task."*

So: **one loop; the skills are a view onto it.** A skill may drive several nodes
or none. `work` typically drives Attempt and Observation; `review` drives Review
and Disposition; a small task may reach Completion with no skill invoked at all.
Nothing below requires a skill to have run — see N10, and AC4 in `F-088`.

## 2. The graph

Read the markers before the boxes. **This is not a picture of what runs today** — every
node in it is implemented in the Kernel and nothing calls any of them.

| marker | meaning |
|---|---|
| `[built]` | implemented and exercised by the suite |
| `[built·opt]` | implemented, and legitimately **absent** from a passing run — a Contract that declares no independence requirement reaches Acceptance without it |
| `[by hand]` | implemented, and so far performed only manually, as a recorded bootstrap |
| `[3a]` | does not exist; `F-088` adds it |
| `[N-n]` | deliberately absent, with the non-goal that holds it out |

```text
   ╔══════════════════════════════════════════════════════════╗
   ║  [3a]  entry point — none exists; v1/bin/ is empty and   ║
   ║        no skill, script or manifest reaches the Kernel   ║
   ╚═══════════════════════════┬══════════════════════════════╝
                               │
                       ┌─ intent ─┐
                       ▼          │
  ┌──────────────► 1 Formation    │                    [built]
  │                    │          │
  │                    ▼          │
  │              2 Activation ◄── human (exact bytes)   [by hand]
  │                    │
  │                    ▼
  │              3 Assignment                           [built]
  │                    │
  │                    ▼
  │        ┌────► 4 Attempt ◄──────────────┐            [built]
  │        │           │                   │
  │        │           ▼                   │
  │        └──── 5 Observation             │  rework:   [built]
  │                    │                   │  the deliverable moves,
  │                    ▼                   │  and any review bound
  │              6 Review ──► 7 Disposition│  to the old one stops
  │                    │        [built·opt]│  answering
  │            [built·opt]                 │
  │                    │   ┌───────────────┘
  │                    ▼   │  [N7] a finding reaching the seat that must act
  │              8 Gate    │       on it would attach here. The record exists;
  │                    │   │       the routing does not, and no host hook can
  │        unavailable │   │       supply it: refusing a deliverable retries
  │           ┌────────┤   │       the same worker instead of returning the
  │           │        │   │       choice to whoever should make it.
  │           ▼        │   │
  │      stop / human  │ passed                         [built]
  │                    ▼
  │       ┌──────────────────────────────┐
  │       │  9 Completion                │              [built]
  │       │    └─ Sign-off ◄── human     │  one human action, not two:
  │       │       (withhold → stop)      │  the owner calls complete,
  │       │  ──► Acceptance              │  and complete signs off
  │       └──────────────┬───────────────┘
  │                      │
  │                      ▼
  └───────────── 10 Run Record                          [built]
    (Contract wrong: new revision,
     every prior pass re-proven)
                         │
   ╔═════════════════════▼════════════════════════════════════╗
   ║  [3a]  reader — none exists. The surface asserts          ║
   ║        completion from a hand-editable markdown field     ║
   ║        instead of reading the Acceptance                  ║
   ╚══════════════════════════════════════════════════════════╝
```

**What the two `[3a]` bands mean together.** The loop is complete and sealed at both ends:
nothing can get in, and nothing downstream reads what comes out. `F-088` opens both, and
changes no node semantics — all twelve public Kernel operations already map onto a node
above.

**`[by hand]` is not a defect.** `F-086` activated its own Contract manually and recorded
that it was doing so, because the machinery that would activate it mechanically is the work
that Contract authorized. What that record says its first mechanical run must reproduce is
still owed.

**`[built·opt]` is why no criterion may demand every node.** V1's terminating Contracts
declare no independence requirement, so a run can reach a valid Acceptance having never
obtained a Review or disposed a finding. A check asserting all ten nodes were traversed
would fail on a correct run.

## 3. How to read a node contract

Following [`handover.md`](../../plugins/ae/handover.md)'s rule, which this
document applies to Kernel nodes rather than to pipeline stages:

> **A handover contract is not what a stage produces, it is what the next stage
> will refuse it for.**

So each node below states four things, and the third is load-bearing:

| Field | Meaning |
|---|---|
| **Produces** | The record kinds and objects it writes. A node that persists nothing is not a node. |
| **Operation** | The Kernel API that performs it. Named so a claim about a node is checkable against code. |
| **Refused for** | What the *next* node refuses it for. This is the contract. |
| **May not be produced by** | The authority constraint — who is disqualified, and why. |

## 4. The node contracts

### 1 — Formation

| | |
|---|---|
| Produces | `formation_opened`, `contract_approved_genesis` / `contract_approved_revision`, the `Contract` object |
| Operation | `openFormation`, `approve` |
| Refused for | A Contract whose provenance does not carry the material inputs it cites; a criterion with no falsifier and no `judgement` mark; bytes whose digest does not match what was shown |
| May not be produced by | Nothing is disqualified here — but Formation cannot *activate* what it forms (node 2) |

Formation ends with a candidate, not an active Contract. `design.md` §7.3 keeps
formation and proof in different phases for this reason.

### 2 — Activation (human boundary)

| | |
|---|---|
| Produces | `human_decision_activation` |
| Operation | the approval path in `approve` |
| Refused for | An approval that names a digest other than the bytes on disk; an approval attributable to a model |
| May not be produced by | **Any model.** AC-14: collected through the host's interaction surface, recorded, attributable to the Human Owner |

The assurance a digest carries is content, not readership — `F-086`'s activation
record states this about its own bootstrap and it remains true of every
activation.

### 3 — Assignment

| | |
|---|---|
| Produces | `assignment_issued`, the `Assignment` object |
| Operation | `issueAssignment` |
| Refused for | An Assignment bound to a Contract revision that is no longer current; a boundary wider than the Contract's scope |
| May not be produced by | An Assignment nobody authorized — the regress AC-5 exists to end |

### 4 — Attempt

| | |
|---|---|
| Produces | `attempt_opened` |
| Operation | `openAttempt` |
| Refused for | An attempt opened for obligations its Assignment did not grant |
| May not be produced by | — |

**An attempt may narrow its grant and never widen it.** Downstream nodes must
re-check the *narrower* grant, not the Assignment's broader one. Restoring the
broader grant downstream is the defect that reached a wrong Acceptance during
`F-086` — the one that mattered most of the five structural families, because it
produced a wrong *pass* rather than a wrong refusal.

### 5 — Observation

| | |
|---|---|
| Produces | `command_result`, `observation`, `input_observed`, `input_gone`, `artifact_recorded`, `capability_unavailable`, `dispatch_attempt`, `evidence_package` |
| Operation | `runObservation`, `observeInput`, `submitObservation`, `recordDispatch`, `recordUnavailable`, `recordPackage` |
| Refused for | A run that exercised nothing — a vacuous observation is not a pass; evidence bound to a superseded Contract revision; a reference to an artifact that does not exist |
| May not be produced by | The caller may not supply the command. `runObservation` resolves it from the approved Contract, so the producer cannot point the run at a decoy |

`dispatch_attempt` carries the *requested* families and, only where a seat
answered, the observed one. **Absence is not emptiness**: a requested family that
never answered supports no claim about what ran.

### 6 — Review

| | |
|---|---|
| Produces | `review` — carrying the reviewer, the family, the deliverable identity reviewed, the findings, and the reviewer's raw output |
| Operation | `obtainReview`, `reviewsFor` |
| Refused for | A reviewer who is the run's granted `attempt_producer`; a review bound to a deliverable identity that is not the run's; a family not among the Contract's requested families; a command that exited non-zero or returned nothing |
| May not be produced by | **The reviewed party.** And no caller supplies the command or the family — the Kernel resolves the family through its own registry and stamps what it resolved |

**The Kernel does not review anything.** Its whole contribution is that the
producer could not choose the reviewer, the command, or the family. Whether the
reply is a judgement or a canned string is visible in the recorded raw output and
is not something the Kernel can decide.

### 7 — Disposition

| | |
|---|---|
| Produces | `finding_disposed` |
| Operation | `disposeFinding`, `undisposedFindings` |
| Refused for | Completion refuses while any finding raised by the answering review has no disposition |
| May not be produced by | — (routing a finding to the seat that must act on it is N7, deferred; see §6) |

### 8 — Gate

| | |
|---|---|
| Produces | `gate_result`, `gate_completed` |
| Operation | `status`, and the reduction in `gate.mjs` |
| Refused for | Nothing refuses the Gate — it is a pure reduction over accepted facts and has no opinion |
| May not be produced by | The Gate holds no business judgement and does not schedule agents |

**Absence is never success.** Every "no evidence" path reaches `pending`, and a
required capability that could not be used reaches `unavailable` — never
`passed`. Given the same accepted facts the Gate produces the same status;
replay diverges zero times.

### 9 — Completion, with sign-off inside it

| | |
|---|---|
| Produces | `human_signoff`, `completion_committed`, the `Acceptance` object; and `human_decision_choice` / `_judgement` / `_unavailable` for the judgements the Contract reserves |
| Operation | `complete`, which calls `signOff` itself (`kernel.mjs:1758`); plus `decideWorth`, `decideRetreat` |
| Refused for | A sign-off predating the Gate result (`signoff_before_gate`); a sign-off naming a review other than the one that answered; verdicts that do not read `passed` |
| May not be produced by | **Any model**, and never inferred from silence. The Acceptance may be written by **nothing but the single completion writer** — a hand-written completion marker or an edited status field is not accepted; the Gate recomputes from facts |

**Sign-off is not a node you traverse before completion — it is the human boundary
*inside* it.** An earlier drawing of this graph had them as two sequential nodes, which
implied calling `signOff` and then `complete`; since `complete` calls `signOff` itself, that
sequence would record the human twice. There is one human action here: the owner calls
`complete`, and completion signs off as part of committing.

`signOff` stays public so its own refusal — a sign-off that predates the Gate — can be
attempted directly and shown to fail. That is a testing surface, not a step in the walk.

The Acceptance names the review it rested on, and states truthfully whether one
was required. It is a statement that the Contract was satisfied *at acceptance
time* — not a perpetual health claim about the repository today.

### 10 — Run Record

| | |
|---|---|
| Produces | `run_record_clean` / `run_record_caught` — formation and change intervals, trace outcome, and what went wrong |
| Operation | `recordRun`, `runFactsFor`, `retreatCondition` |
| Refused for | — off the completion path |
| May not be produced by | — |

The trace outcome **is a fact about what was recorded, never a judgement**.
Putting it to a person as a decision converts a recorded fact into an opinion
they then have to form.

## 5. Return paths

A return edge that invalidates nothing is a retry, not a loop. Each edge below
names what stops being usable when it is taken — that is what makes the graph a
loop rather than a chain with restarts.

| From | Back to | Taken when | What it invalidates |
|---|---|---|---|
| Observation | Attempt | Evidence is missing or vacuous | Nothing yet. The Assignment stays incomplete; absence is not a pass |
| Review | new Attempt | Changes required | **The deliverable moves.** Any review bound to the old deliverable identity stops answering, and completion re-checks this *at completion*, not at recording |
| Disposition | new Attempt | A finding needs repair | Same as above, and the finding stays open until disposed |
| Gate | Attempt | An obligation reads `pending` | Nothing; the facts are simply not yet there |
| Gate | stop / human | An obligation reads `unavailable` | The run cannot pass. The human waits, amends, or stops — v1 reports rather than degrades |
| Sign-off | stop | The human withholds | Nothing is written. Everything passing is still not completion |
| **any node** | **Formation** | The Contract is wrong or missing a material requirement | **The revision changes, and every prior pass is re-proven.** An old pass is never carried forward |

**The last row is the expensive one, and it is meant to be.** Retrying a locked
recipe, changing implementation order, or adding a temporarily stricter check is
*not* an amendment. Changing a criterion, a falsifier, the observed source, the
proof mode, or a required independence property **is** — and v1 has no amendment
operation, so it means forming a successor Contract.

### The stage-level rings are the same edges, seen from the skills

[`handover.md`](../../plugins/ae/handover.md) states when work leaves a ring:
`work ⇄ review` holds while the fix changes what the code does; it escalates to
plan when the decomposition cannot close; it escalates to analyze when the
criterion cannot be met however the work is divided, or the premise's citation
does not hold. Those are the same three edges as rows 2–3, 4, and 7 above, named
from the view rather than from the record. **Everything else is a re-division
inside the current ring**, needs no signature, and writes no record here.

## 6. What is not in this graph, and why

| Absent | Reason |
|---|---|
| Finding **routing** — a finding reaching the seat that must act on it | N7. The record exists; the routing does not. A host hook cannot supply it: refusing a deliverable retries the same worker rather than returning the choice to whoever should make it |
| Team topology and seats | N7. A cross-family review here is an observation whose command is another family's CLI |
| An amendment **operation** | N9. A Contract is amended by approving a revision whose own bytes carry the predecessor; history chains and the current revision moves |
| Crash recovery beyond no-clobber write safety | N4, behind an observed failure |
| Run lifecycle — pause, resume, restart across sessions | Unbuilt and unmeasured. This is the gap a separate runtime would fill; `acceptance.md` H2 has no evidence of any kind today |

**Nothing above may be added to the graph speculatively.** AC-12 refuses a
persisted kind with no producer and no consumer, *"whether missing or
speculatively added"* — and a node specified but unbuilt is the same failure one
level up. Each absent row names the condition that would admit it.

## 7. What this graph does and does not establish

**Establishes.** Which node produced which record, under which grant, bound to
which Contract revision, judged by which reduction, and signed by whom. Each is
checkable against the ledger without trusting any participant's account of it.

**Does not establish.** That the work is good, that a reviewer read anything,
that a command touched the files it was pointed at, or that a model followed a
prose rule. Those are the `workflow_attested` boundary `design.md` §4 draws, and
the graph does not move it.
