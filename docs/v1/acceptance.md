# AE v1 — acceptance criteria

> **Status:** current. States the minimum for calling AE v1 released. Nothing
> here is satisfied yet, and this document does not claim otherwise.

The previous release gate was G0–G7, eight false-pass fixtures, seventeen host
failure arms, six dogfood classes, a full qualification catalog, a rollout lock,
and a generated evidence dossier — all before a user could run the flow. That
gate was not wrong about what a mature system should prove. It was wrong about
when.

This one is smaller, and every criterion is observable by running AE rather than
by reading a document.

## 1. Release criteria

AE v1 is releasable when all six hold:

| # | Criterion |
|---|---|
| 1 | The V1 solo flow has been used for real work on this repository, repeatedly, and the runs are recorded. |
| 2 | The V2 Agent Teams flow has completed at least one real feature including a finding that required rework and re-review. |
| 3 | The Kernel integrity criteria in §3 all fail closed. |
| 4 | The Agent Teams handoff criteria in §4 hold, including under lost coordination state. |
| 5 | The cross-family seat behaves per §5 — or is honestly reported as unavailable, which is also a pass. |
| 6 | Knowledge holds no authority per §6. |

V4 and V5 are not release prerequisites. V4 improves the product over time; V5
responds to failures that, by definition, have not happened yet.

## 2. The user-observable flow

A person who installs AE v1 must be able to do this, and see each step:

```text
state an intent
  → read an exact Contract and accept, edit, or reject it
  → watch the work happen across seats they can see
  → read findings, and see what was done about each one
  → see a mechanical status that is computed, not asserted
  → give or withhold the final sign-off
```

Two properties must be true of that experience:

- **Nothing between "accept" and "sign off" can change what was accepted.** An
  amendment is visible, human-confirmed, and re-proven.
- **A small task stays small.** If forming a Contract for a one-line fix costs
  more than the fix, v1 has failed its own CF-09 criterion regardless of how
  sound the rest is.

## 3. Kernel integrity criteria

These are the eight completion false-pass cases from the earlier plan (F1–F8),
retained because they are the right cases — now written against V1's actual
Kernel rather than against a specification.

Each must fail closed with a typed reason, not merely fail:

| # | Case | Must produce |
|---|---|---|
| K1 | A test command passes having discovered zero tests | `invalid` — vacuous observation |
| K2 | Evidence bound to a superseded Contract revision | `stale` |
| K3 | Contract bytes altered after approval | `invalid` — identity mismatch |
| K4 | Evidence references an artifact that does not exist | `invalid` — unresolved reference |
| K5 | A cross-family claim with no correlated backend observation | `invalid` — uncorrelated, or `unavailable` |
| K6 | Manual edit of a status field, or a hand-written completion marker | Not accepted; the Gate recomputes from facts |
| K7 | Completion written by anything other than the single completion writer | Refused |
| K8 | A seat claiming an authority it was not assigned | Refused — authority comes from assignment, not from the message |

Plus two properties:

- **Determinism.** The Gate, given the same accepted facts, produces the same
  status. Replay diverges zero times.
- **Absence is never success.** Every "no evidence" path reaches `pending`, not
  `passed`.

## 4. Agent Teams handoff criteria

| # | Criterion |
|---|---|
| H1 | Every handoff in [`design.md` §8.2](design.md#82-the-handoffs-that-must-close) lands in a durable artifact, not only in a mailbox or task list. |
| H2 | With the shared task list and teammate messages lost or lagging mid-run, the state reconstructs from those artifacts. This is demonstrated, not assumed. |
| H3 | A task marked completed, a mailbox message, a summary, or `/goal` never advances the Gate. |
| H4 | Each finding reaches the seat that must act on it and carries a disposition; an undispositioned finding blocks acceptance. |
| H5 | Where the Contract requires independence, the reviewing seat is a fresh context, and the implementer is not the sole reviewer of its own material claim. |
| H6 | Exactly one seat holds product mutation for a feature at any time. |

## 5. Cross-family criteria (optional)

Cross-family is optional by design. Both outcomes below are acceptable
individually; the failure is claiming a property AE did not observe.

| # | Criterion |
|---|---|
| X1 | A Contract-declared cross-family review runs through `agent-proxy` and returns a `Review` in the same shape as a same-family seat. |
| X2 | `requested`, `observed`, and `effective` identity stay distinct end to end. A request field is never reported as an effective-family claim. |
| X3 | With the provider unavailable, the proof reports `unavailable` and reaches a human decision. No silent same-family substitution. |
| X4 | There is exactly one Gate and one workflow. Cross-family adds a seat, not a pipeline. |

## 6. Knowledge non-authority criteria

| # | Criterion |
|---|---|
| N1 | No knowledge output modifies an active Contract. |
| N2 | No knowledge output satisfies an Evidence obligation. |
| N3 | No Gate result changes because history says a case usually passes. |
| N4 | An agent's own summary is never ingested as a learned fact. |
| N5 | Every suggestion reaches a Contract or a policy only through review and a human decision, and that decision is recorded. |

## 7. Open items for the human

These need a decision and are not resolvable from the code or the handoff.

| # | Item | Why it needs a person |
|---|---|---|
| 1 | **Confirm the minimum v1 scope.** V0 cannot exit without it. | This is the scope reduction itself. |
| 2 | **F-084/F-085 were untracked to restore the gitignore guard** (`8641610`); the files stay on disk and on their source branch. Confirm that is the disposition you want, rather than keeping them tracked and relaxing the guard. | The consolidation chose the policy-conformant option to keep the suite green; reversing it is the user's call. |
| 3 | **F-082 duplicate identity across the live/done inventory.** Carried forward, still unresolved, from the earlier plan's open blockers. | It is a data-disposition decision. It no longer blocks anything in v1, because rollout is deferred. |
| 4 | **Whether the archived `finalized/**` specification should stay in `docs/`** now that it is a design input rather than the plan. | It is 3,159 lines of archived normative prose. Keeping it is defensible; so is moving it beside the other design history. |
| 5 | **Whether v1 ships as `0.15.x` or `1.0.0`** of the `ae` plugin (currently `0.14.2`). | The name "AE v1" and the plugin's semver are not the same thing, and conflating them would be a release claim. |

## 8. What this document does not do

It is not a Gate, a waiver, a scorecard, or a receipt. It states what would have
to be true. Whether it is true is decided by running AE, and a `PASS` here would
be a claim this file has no standing to make.
