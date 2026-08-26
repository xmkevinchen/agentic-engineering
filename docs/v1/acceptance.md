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
| 5 | One **negative arm must actually run** before release: a Contract declaring `cross_family_required`, with the provider forced unavailable, reports `unavailable`, performs no same-family substitution, and records the human's `wait`/`stop`/`amend` decision bound to that Contract revision and run. The arm produces no Acceptance — `unavailable` is not `passed` — and needs none. Owned by V1 (§5). A *successful* cross-family invocation stays optional with V3. |
| 6 | Knowledge holds no authority per §6, tested against the knowledge surfaces that exist at release time. |

**V3, V4, and V5 are not release prerequisites** — but read that precisely for
V3. What V3 adds is a *successful* cross-family invocation and the correlation it
makes exercisable — X1 and X2b — and that stays optional. Criterion 5's negative arm is **not** optional: it is owned by V1 and
must have run before release. Using a cross-family seat in production is a
choice; proving that a missing one cannot become a pass is not.

V4 improves the product over time. V5 responds to failures that, by definition,
have not happened yet.

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

## 5. Cross-family criteria

*Using* a cross-family seat is optional. *Proving it cannot degrade silently* is
not. The failure this section guards is claiming a property AE never observed —
and that failure is reachable whether or not anyone ever runs a successful
cross-family invocation.

| # | Criterion | Required for release | Owner |
|---|---|---|---|
| X1 | A Contract-declared cross-family review runs through `agent-proxy` and returns a `Review` in the same shape as a same-family seat. | **Optional** — this is the successful path | V3 |
| X2a | The `requested` identity **the Contract states** appears in AE's dispatch-attempt and unavailable records with an identical **canonical-JSON encoding** (equivalently, an identical canonical digest), bound to the same Contract revision and run, while `observed` and `effective` are **absent — not `null`, not empty**. A request field is never reported as an effective-family claim. | **Yes** | V1 |
| X2b | A **populated** `observed` identity correlates correctly to `effective` — the archive's account of what the backend did is what gets claimed. | **Optional**, with X1 | V3 |
| X3 | With the provider unavailable, the proof reports `unavailable`, records the human's decision, and performs no silent same-family substitution. | **Yes** — this is release criterion 5's negative arm | V1 |
| X4 | There is exactly one Gate and one workflow. Cross-family adds a seat, not a pipeline. | **Yes** | V1 |

X1, X3, and X4 are unambiguous. X2 is the one that needed splitting, and an
earlier draft of this table got it wrong by claiming the whole property was
provable against an unavailable provider.

It is not. An unavailable run proves that AE does not *invent* an effective
identity out of nothing — that is X2a, it is the half that matters most, and V1
owns it. It cannot exercise the correlation logic that runs when the archive
actually reports what a backend did, because nothing answered. That is X2b, and
it needs a provider that answers.

X2a's boundary is deliberately drawn at AE's own records, not at the provider.
An unavailable run may stop before the backend handoff, so it cannot show what a
provider received — that is *exact input handoff*, and V3 owns it. What V1 can
and must show is that AE preserved the request it was given and claimed nothing
about an observation it never made.

**X2b may be N/A only when the release's dispatch graph contains no edge that
can deliver a cross-family request to a backend that answers.** The evidence is
an enumeration of the release manifest's closed member set and its activation
entry points — the same shape of argument as the foundation corpus's
semantic-blindness scan, which enumerates modules from disk rather than trusting
a hand-kept list. It is not an observation of any provider's state.

The distinction that matters: **`agent-proxy` existing in the repository is not
that edge.** The bridge is already on the mainline and v1 does not rebuild it
([`design.md` §5](design.md#5-agent-proxy)). What would make the path reachable
is a released dispatch path that reaches it. V1 needs Contracts to be able to
declare `cross_family_required` at all — X3 depends on that — so the honest
position is a clean fork:

- V1's dispatch reaches only a result that cannot answer, and the member/entry-
  point enumeration shows there is no edge to a live backend → X2b is an
  evidenced N/A; or
- the release wires that edge → X1 and X2b **must run**, whatever any provider
  happens to be doing at release time.

Three weaker forms were considered and rejected, and are recorded so they do not
grow back:

| Rejected as N/A evidence | Why |
|---|---|
| Every configured provider reports `unavailable` | Credentials, quotas and networks recover; the path is then live in a release that never proved it. A temporary observation is not a structural fact — the exact substitution this document exists to refuse. |
| A release-bound selector disables it | AE's selector is editable project configuration; a user flips it and the unproved path is live. Making it sound needs an immutable release capability manifest treating each activation as a separately qualified release — [deferred to V5](mechanism-disposition.md#3-defer). A v1 criterion may not rest on a deferred mechanism. |
| "The V3 integration code is not published" | Undefined boundary. The bridge it would integrate is already published, so omitting something labelled V3 proves nothing about whether generic dispatch can still reach a live backend. |

As with any AE N/A, the unreachability itself needs evidence; an unevidenced
blank is not an N/A.

## 6. Knowledge non-authority criteria

These are not deferred to V4. A knowledge surface **already exists** — the
`.ae/graph` corpus and the skills that read it — so N1–N6 are testable from V1
onward, against that surface, and [V1 owns that test](implementation-plan.md#v1--minimal-kernel--solo-workflow).
A criterion whose only implementer sits in a non-prerequisite slice is a hidden
release blocker, which is the same defect in a different place. Were they scoped to V4 only, they would be
vacuously true for any release that skips V4, which is precisely the shape of
false assurance this document exists to avoid.

| # | Criterion |
|---|---|
| N1 | No knowledge output modifies an active Contract. |
| N2 | No knowledge output satisfies an Evidence obligation. |
| N3 | No Gate result changes because history says a case usually passes. |
| N4 | An agent's own summary may serve as advisory background only. It never becomes a repository fact, an Evidence Package field, or a Gate input without a producer that observed the thing being claimed. |
| N5 | Every suggestion reaches a Contract or a policy only through review and a human decision, and that decision is recorded. |
| N6 | The existing `.ae/graph` corpus contributes nothing to any Gate status. Deleting it changes no proof result. |

## 7. Open items for the human

These need a decision and are not resolvable from the code or the handoff.

| # | Item | Why it needs a person |
|---|---|---|
| 1 | ~~Re-confirm the minimum v1 scope.~~ **Re-confirmed 2026-08-25**, superseding 2026-08-24. The widened scope is accepted in full: formation provenance inside the Contract, the cross-family unavailable arm, and the `.ae/graph` isolation tests including N6's delete-differential. V1 is larger than first confirmed, and the first real dogfood run arrives correspondingly later. | Resolved. |
| 2 | **F-084/F-085 were untracked to restore the gitignore guard** (`80cff4b`); the files stay on disk and on their source branch. Confirm that is the disposition you want, rather than keeping them tracked and relaxing the guard. | The consolidation chose the policy-conformant option to keep the suite green; reversing it is the user's call. |
| 3 | **F-082 duplicate identity across the live/done inventory.** Carried forward, still unresolved, from the earlier plan's open blockers. | It is a data-disposition decision. It no longer blocks anything in v1, because rollout is deferred. |
| 4 | **Whether the archived `finalized/**` specification should stay in `docs/`** now that it is a design input rather than the plan. | It is 3,159 lines of archived normative prose. Keeping it is defensible; so is moving it beside the other design history. |
| 5 | **Whether v1 ships as `0.15.x` or `1.0.0`** of the `ae` plugin (currently `0.14.2`). | The name "AE v1" and the plugin's semver are not the same thing, and conflating them would be a release claim. |

## 8. What this document does not do

It is not a Gate, a waiver, a scorecard, or a receipt. It states what would have
to be true. Whether it is true is decided by running AE, and a `PASS` here would
be a claim this file has no standing to make.
