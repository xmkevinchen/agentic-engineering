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
| 5 | Every cross-family criterion in §5 has run — both the unavailable arm and the successful path. AE ships a live cross-family capability, so AE must show it does not lie about what answered. |
| 6 | Knowledge holds no authority per §6, tested against the knowledge surfaces that exist at release time. |

**V4 and V5 are not release prerequisites. V3 is** — reversed on 2026-08-25 after
four failed attempts to write an exemption for it.

The exemption was supposed to say when the successful cross-family path is
unreachable and therefore need not be proven. Every formulation named a condition
that can change without a release: provider state recovers, a selector is
editable project configuration, and "the integration code is unpublished" has no
boundary — the bridge it would integrate is already on the mainline. The release
manifest closes file membership and integrity, not reachability: it carries no
dispatch nodes, no host entry points, no capability declarations, and the
launcher sits outside the member set by design. Meanwhile `plugin.json` registers
three MCP servers and a dozen skills already reference cross-family.

So the capability is live and v1 cannot evidence otherwise. A live path must be
proven. The lesson was not that the evidence standard needed one more revision —
it was that the exemption should never have existed.

**Two different things stay separate**: *using* a cross-family seat remains
optional and risk-driven, chosen per Contract ([`design.md` §5.1](design.md#51-cross-family-is-risk-driven-not-ceremonial)).
*Proving the shipped capability does not misreport what answered* is mandatory.
A user may never declare `cross_family_required`; AE still may not ship a path
that could pass off a request as an observation.

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

*Using* a cross-family seat is optional and risk-driven, chosen per Contract.
*Proving the shipped capability cannot misreport what answered* is mandatory.
The failure this section guards is AE claiming a property it never observed, and
that failure is reachable because the capability is live: `plugin.json` registers
the Codex, Gemini, and OpenAI-compatible MCP servers, and the bridge is already
on the mainline.

All five must run before release.

**Who declares it.** A user may never write `cross_family_required` into a
Contract of their own, and that stays their choice — so the obligation cannot
rest on one appearing. The release therefore requires one to exist: a
**release-qualification Contract** declaring `cross_family_required`, over real
AE-on-AE work.

It is an ordinary `Contract` producing an ordinary `Acceptance` — not a seventh
durable object. "Release-qualification" is the release policy's description of
it, nothing more. And **AE does not declare it.** A human release owner
commissions or approves the work, approves the `cross_family_required` risk
requirement, is the Contract's declared final signer, and gives the Acceptance
sign-off. AE proposing its own material boundary and approving it is precisely
what [`design.md` §7.2](design.md#72-the-rules) forbids; a Contract that
self-authorized would be invalid under AE's own formation model.

Two things it must not become:

- **A mock.** Every slice runs on real repository work. A path proven only
  against a test double is a path proven against a test double.
- **Ceremony.** Real work is not enough on its own — an arbitrary genuine task
  could be pushed through a cross-family seat purely to exercise the path, which
  is [CF-09](design.md#71-the-failures-formation-exists-to-prevent) wearing a
  release badge. The Contract must record why *that* work earns source
  independence. Reviewing the V3 bridge and its identity correlation is the
  natural candidate: the artifact under review is the machinery that decides
  what another model's answer may be claimed to be, so having a different family
  review it is warranted on the work's own merits, not on the release's need.

**These are distinct Contracts and distinct runs.** The unavailable arm (X2a,
X3) is V1's non-terminating test-corpus Contract, which produces no Acceptance
by construction. The qualification Contract (X1, X2b) is V3's, and it
terminates. Nothing requires them to be the same Contract, and they cannot be.

| # | Criterion | Owner |
|---|---|---|
| X1 | A Contract-declared cross-family review runs through `agent-proxy` and returns a `Review` in the same shape as a same-family seat. | V3 |
| X2a | The `requested` identity **the Contract states** appears in AE's dispatch-attempt and unavailable records with an identical **canonical-JSON encoding** (equivalently, an identical canonical digest), bound to the same Contract revision and run, while `observed` and `effective` are **absent — not `null`, not empty**. A request field is never reported as an effective-family claim. | V1 |
| X2b | A **populated** `observed` identity correlates correctly to `effective` — the archive's account of what the backend did is what gets claimed. | V3 |
| X3 | With the provider unavailable, the proof reports `unavailable`, records the human's decision, and performs no silent same-family substitution. | V1 |
| X4 | There is exactly one Gate and one workflow. Cross-family adds a seat, not a pipeline. | V1 |

The split between X2a and X2b is about *when each is exercisable*, not about
whether either is required. An unavailable run proves AE does not invent an
effective identity out of nothing — X2a, bounded deliberately at AE's own
records, because a run that stops before the backend handoff cannot show what a
provider received. Only a backend that answers exercises the correlation from a
populated `observed` to `effective` — X2b. V1 owns the first, V3 the second, and
the release needs both.

### Why there is no N/A exemption here

Four formulations were attempted, and each named a condition that can change
without a release. They are recorded so none grows back:

| Rejected as evidence of unreachability | Why |
|---|---|
| Every configured provider reports `unavailable` | Credentials, quotas and networks recover; the path is then live in a release that never proved it. A temporary observation is not a structural fact — the exact substitution this document exists to refuse. |
| A release-bound selector disables it | AE's selector is editable project configuration; a user flips it and the unproved path is live. Making it sound needs an immutable release capability manifest treating each activation as a separately qualified release — [deferred to V5](mechanism-disposition.md#3-defer). A v1 criterion may not rest on a deferred mechanism. |
| "The V3 integration code is not published" | Undefined boundary, and the bridge it would integrate is already published. |
| Enumerating the release manifest's members and activation entry points | The manifest closes file membership and integrity, not reachability. Its members carry only role, ref, digest and length; there are no dispatch nodes, no host entry points, no capability declarations, and the launcher is outside the member set by design. "Activation entry point" was an undefined boundary replacing an undefined boundary. |

The foundation corpus's semantic-blindness scan was cited as precedent for the
last of these. That analogy overreached: the scan enumerates `.mjs` files under
one explicitly closed directory and supports a *lexical* claim about forbidden
vocabulary. Runtime reachability spans host manifests, skills, agents,
configuration, and dynamic tool selection, and no equivalent closed universe is
defined in v1.

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
| 1 | ~~Re-confirm the minimum v1 scope.~~ **Re-confirmed 2026-08-25**, superseding 2026-08-24: formation provenance inside the Contract, the cross-family unavailable arm, and the `.ae/graph` isolation tests including N6's delete-differential. | Resolved. |
| 1b | ~~Decide what to do about the unwritable X2b exemption.~~ **Decided 2026-08-25:** delete it. X1 and X2b are required and **V3 becomes a release prerequisite**. The alternatives were to define a closed dispatch universe — which is the deferred active-release qualification pulled back into v1 — or to drop cross-family from the v1 Kernel while the skills keep using it, which is the two-truths problem v1 exists to remove. | Resolved. v1 is larger again, and the release is correspondingly later. |
| 2 | **F-084/F-085 were untracked to restore the gitignore guard** (`80cff4b`); the files stay on disk and on their source branch. Confirm that is the disposition you want, rather than keeping them tracked and relaxing the guard. | The consolidation chose the policy-conformant option to keep the suite green; reversing it is the user's call. |
| 3 | **F-082 duplicate identity across the live/done inventory.** Carried forward, still unresolved, from the earlier plan's open blockers. | It is a data-disposition decision. It no longer blocks anything in v1, because rollout is deferred. |
| 4 | **Whether the archived `finalized/**` specification should stay in `docs/`** now that it is a design input rather than the plan. | It is 3,159 lines of archived normative prose. Keeping it is defensible; so is moving it beside the other design history. |
| 5 | **Whether v1 ships as `0.15.x` or `1.0.0`** of the `ae` plugin (currently `0.14.2`). | The name "AE v1" and the plugin's semver are not the same thing, and conflating them would be a release claim. |

## 8. What this document does not do

It is not a Gate, a waiver, a scorecard, or a receipt. It states what would have
to be true. Whether it is true is decided by running AE, and a `PASS` here would
be a claim this file has no standing to make.
