# AE v1 — consolidated implementation plan

> **Status:** current implementation plan for AE v1. Supersedes the P0–P6 plan in
> [`../references/finalized/implementation-plan.md`](../references/finalized/implementation-plan.md),
> which is retained as a design input and audit record.

## 1. Shape of the plan

The previous plan was horizontal: freeze every schema, qualify every provider,
build every guard, then — at the end — let a user run something. It was
internally coherent and it did not converge. Ten P0 work packages produced two
landed packages, no user-visible flow, and a growing dependency on machinery
that protected against failures nobody had observed.

This plan is vertical. Each slice ends with something a person can actually run
on this repository.

Two rules govern every slice:

1. **No upfront horizontal build.** A schema, guard, or qualification is written
   when the slice that produces *and* consumes it arrives. "We will need it
   later" is not a reason to build it now.
2. **Dogfood before proceeding.** A slice is not finished when its code is
   written. It is finished when it has been used for real work on this
   repository at least once, and what that run exposed has been recorded.

Every slice also has a **retreat condition**: the observation that would mean
the slice was the wrong idea, stated before it is built.

## 2. The slices

| Slice | Delivers | Dogfoodable outcome |
|---|---|---|
| **V0** | Consolidation and product boundary | This document set; no production behavior change |
| **V1** | Minimal Kernel + solo workflow | One real feature accepted end to end by one implementer |
| **V2** | Claude Code Agent Teams workflow | One real feature through Lead → Implementer → QA → Reviewer → Fixer |
| **V3** | Optional cross-family seat | One Contract-declared high-risk review run through agent-proxy |
| **V4** | Knowledge Feedback | Real suggestions produced from V1–V3 records |
| **V5** | Earned hardening | Only fixes for failures that actually occurred |

### V0 — Consolidate and freeze the product boundary

**Deliverables**

- branch merge (done — see [`branch-disposition.md`](branch-disposition.md));
- one branch disposition covering every source branch;
- one current design ([`design.md`](design.md));
- one current implementation plan (this document);
- one mechanism disposition ([`mechanism-disposition.md`](mechanism-disposition.md));
- the minimum v1 scope, after the user confirms it.

**No new production behavior.** V0 changes documents and Git topology only.

**Exit:** the user confirms the scope, and an independent cross-family review
confirms the consolidation is complete and internally consistent.

**Retreat:** if the seven questions in [`design.md` §12](design.md#12-the-seven-questions-this-design-must-answer)
still require reading several plans and the archived specification to answer,
the consolidation has not converged and V1 must not start.

### V1 — Minimal Kernel + solo workflow

**The flow that must run:**

```text
human intent
  → Contract candidate + human-readable view
  → human approval
  → one Assignment
  → one Implementer
  → deterministic command Evidence
  → Gate
  → human final sign-off
```

**Scope**

- `Contract`, `Assignment`, `Evidence Package`, `Acceptance` — only these four
  objects; `Review` and `Finding Disposition` arrive with V2.
- Contract identity: exact bytes, canonical digest, human-approved revision.
- **Formation provenance inside the Contract** ([`design.md` §7.2](design.md#72-the-rules)),
  canonicalized and digested with it. Without it V1's own retreat condition —
  "the trace caught nothing" — has nothing to evaluate, and CF-01…CF-08 cannot be
  reconstructed after the forming session is gone.
- **Review-free Acceptance.** V1's *terminating* Contracts — the dogfood and
  production ones — declare no independence requirement, so their Acceptance
  records *"no independent review required by this Contract"* and the Gate checks
  that statement against the Contract. An Acceptance missing a review the
  Contract *did* require is `invalid`. This is what lets V1 terminate without the
  `Review` object.

  V1's test corpus additionally holds one **non-terminating** Contract that
  *does* declare independence — see the unavailable arm below. The two are
  different populations, and conflating them was a real defect in an earlier
  draft of this list: cross-family **is** a source-independence requirement
  ([`design.md` §3.3](design.md#33-independence)), so a Contract that declares it
  cannot also be a Contract that declares none.
- Evidence binding: Contract revision, assignment, attempt, producer, artifact.
- Command evidence with a non-vacuity check — a run that exercised nothing is
  not a pass.
- The Gate as a pure reduction over accepted facts, producing the status
  vocabulary in [`design.md` §3.4](design.md#34-gate-status-vocabulary).
- One completion writer over `atomicFileNoReplace`: `O_EXCL` no-clobber, short-
  write detection, `fsync` of both the file and its parent directory, and
  **final-component** symlink refusal — that is all `O_EXCL` gives. The primitive
  does **not** walk the parent path, so a parent directory swapped for a symlink
  redirects the write. V1's writer therefore runs a component-by-component
  preflight before calling it, reusing the pattern `policy-bundle.mjs`
  already implements and tests (`assertNoSymlinkComponents`), with its own
  negative fixture. **No staging.** A failed write leaves an empty or truncated
  file rather than unlinking a path this call may not own; that is detectable on
  the next read, because the content will not match its digest. Staging via
  temp-file-plus-`link` would change the frozen mechanism, not repair it, and is
  deferred with the rest of durability work.

- **The cross-family unavailable arm.** One Contract in the test corpus declares
  `cross_family_required` — a genuine source-independence requirement — and runs
  with the provider forced unavailable. It must reach `unavailable` with no
  same-family substitution.

  **This arm never produces an Acceptance, by construction.** `unavailable` is
  not `passed`, so the run has no terminal state and needs none: what it proves
  is that a missing capability does not become a pass. It therefore needs no
  reviewer seat and no `Review` object, which is why it belongs in V1 rather than
  in the optional V3.

  What must be durable is the human's decision. The Harness appends one record —
  the choice (`wait` | `stop` | `amend`), bound to the exact Contract revision and
  run identity — to the same event log V1 already appends and replays. It is not a
  seventh durable object; it is an event, and without it "a human decided" is a
  claim with nothing behind it.

  Owner of [`acceptance.md` criterion 5](acceptance.md#1-release-criteria) and of
  [X2a, X3, X4](acceptance.md#5-cross-family-criteria). X2a is bounded at **AE's
  own records**, not at the provider: the exact request the Contract and
  Assignment specified is retained unchanged in the dispatch-attempt and
  unavailable records, bound to the same Contract revision and run, with
  `observed` and `effective` absent. An unavailable run may stop before the
  backend handoff, so it cannot show what a provider received — that is exact
  input handoff, and V3 owns it along with the correlation half (X2b).
- **Knowledge isolation tests.** The `.ae/graph` corpus already exists, so V1
  proves it contributes nothing to any Gate status — including N6's differential:
  delete the corpus, and no proof result changes. Owner of
  [`acceptance.md` §6](acceptance.md#6-knowledge-non-authority-criteria).

**Explicitly not in V1:** Ledger event families beyond what this slice emits,
crash recovery, rollout, migration, provider qualification, Team topology, and
any *successful* cross-family invocation — V1 owns only the unavailable branch.

**Exit:** at least one real change to this repository goes from intent to
accepted through this path, and the run is recorded — including what it cost and
what it got wrong.

**Retreat:** if forming and approving a Contract for a small change takes longer
than the change itself and the trace catches nothing, formation is over-built:
cut it back before adding V2 on top.

### V2 — Claude Code Agent Teams workflow

**The flow that must run:**

```text
Lead → Implementer → QA → Reviewer
                      ↘ finding → Fixer → re-review
                                        → human sign-off
```

**Scope**

- `Review` and `Finding Disposition` objects.
- Seat assignment and input control: what each seat sees, and what it may change.
- Durable semantic handoff on top of Agent Teams: every arrow in
  [`design.md` §8.2](design.md#82-the-handoffs-that-must-close) lands in an
  artifact, not only in a mailbox.
- Finding routing: each finding goes back to the seat that must act on it, and
  carries a disposition.
- Independence enforcement: a fresh session where the Contract requires one; an
  implementer is never the sole reviewer of its own material claim.

**The property that must be demonstrated, not assumed:** kill or lag the shared
task list and the teammate messages mid-run, and the durable handoff still
reconstructs the state. If it cannot, the handoff was not durable.

**Exit:** one real feature completes through the full seat chain, including at
least one finding that required rework and re-review.

**Retreat:** if the Team path is consistently slower and no better than V1's solo
path for the tasks this repository actually has, keep V1 as the default and make
Team an explicitly selected topology rather than a promoted one.

### V3 — Optional cross-family seat

Uses the existing `agent-proxy` bridge. No new workflow, no second Gate.

**Scope**

- exact input handoff into a Codex or Gemini seat;
- raw output capture;
- the correlation half of the identity distinction — [X2b](acceptance.md#5-cross-family-criteria):
  a **populated** `observed` identity maps correctly to `effective`. V1 already
  proved AE does not invent one from nothing (X2a); only a backend that answers
  can exercise what happens when one is actually reported;
- `unavailable` handling that stops rather than silently substituting a
  same-family reviewer;
- the same `Review` shape as a same-family seat.

**Exit (of the slice, not of the release):** one Contract that declares a
high-risk cross-family review runs through the bridge with a provider that
actually answers, and is accepted — [`acceptance.md` X1 and X2b](acceptance.md#5-cross-family-criteria).
V1 already proved the unavailable branch, so V3 does not re-demonstrate it; what
V3 must additionally show is that adding a real provider introduced no second
workflow and no second Gate (X4).

**V3 is not a release prerequisite — but only the successful path is optional.**
The negative arm is mandatory and belongs to V1, not here: release criterion 5
requires it to have actually run ([`acceptance.md` §1](acceptance.md#1-release-criteria),
[§5](acceptance.md#5-cross-family-criteria)). What V3 adds on top is X1 **and
X2b** — a real provider answering, and the correlation that only then becomes
exercisable — and that is the part a release may ship without.

Shipping without it means the successful path is **structurally** absent: the V3
code is unpublished, or a release-bound selector disables it. A provider that
merely happens to be unavailable does not make X1/X2b N/A — it recovers, and the
path is live in a release that never proved it. If V3 ships enabled, X1 and X2b
must run.

A provider being silently swapped for a same-family reviewer blocks the release,
and always did.

**Retreat:** if correlation cannot be observed well enough to distinguish a real
cross-family invocation from a same-family fallback, report cross-family as
`unavailable` for that provider rather than claiming a property AE cannot see.

### V4 — Knowledge Feedback

Built from the real records V1–V3 produced, not from a designed-in-advance
schema.

**Scope**

- recurring-finding summaries;
- Contract-gap suggestions ("this obligation is routinely forgotten");
- reviewer-routing suggestions;
- cost and rework observations, in raw paired records rather than averages.

Every output is a **proposal**. It reaches a future Contract or policy only
through review and a human decision.

**Exit:** at least one suggestion is generated from real history, presented to a
human, and accepted or rejected — with the decision recorded.

**Retreat:** if suggestions are noise at the volume of history v1 actually has,
keep the records and stop generating suggestions. Do not compensate with a
larger graph.

### V5 — Earned hardening

Only for problems that V1–V4 dogfooding actually exposed, and only where the
problem causes a **wrong acceptance** or **unrecoverable damage**. Candidates
include provider qualification, stronger isolation, crash recovery, rollout and
migration, and additional schemas.

**Every V5 mechanism must state, before it is built:**

1. the specific observed failure it prevents;
2. the older complexity it replaces or removes.

A mechanism that cannot name an observed failure does not enter V5. It goes back
to `defer` in [`mechanism-disposition.md`](mechanism-disposition.md) with the
condition that would bring it back.

## 3. Replan of the old P0–P6 packages

Every package from the previous plan, with its disposition. Nothing is renamed
and carried forward.

### P0 — freeze semantics and baselines

| Old package | Original goal | Disposition |
|---|---|---|
| P0.0 | Fix five core skill + gemini-proxy frontmatter | **done** — landed on the mainline (`fafe9af`). Nothing further. |
| P0.G / P0.G-lite | Platform/host primitive feasibility spike | **done** — feasibility established; it authorized P0.1 and nothing more. |
| P0.1 | Freeze runtime/validator/canonical-byte/tree-snapshot/policy-bundle mechanisms | **done and kept** — see [`mechanism-disposition.md` §5](mechanism-disposition.md#5-disposition-of-the-p01-corpus). V1 promotes what it needs from `tests/foundation/lib/`. |
| P0.2 | Freeze *all* authoritative schemas | **replaced** — schemas are frozen per slice, with a real producer and consumer. This ordering was the single largest cause of the previous stall. |
| P0.3 | Freeze reducer, producer ACL, delivery, activation/amend/finalize algebra | **narrowed into V1/V2** — V1 delivers the reducer and the completion-writer rule for its own event set; the amendment algebra arrives with V2's rework chain. |
| P0.4 | Freeze Ledger hash/head/append recovery and lock protocol | **simplified into V1** — append and replay for the events one slice emits. Recovery beyond no-clobber writes is deferred to V5. |
| P0.5 | F1–F8 completion false-pass corpus | **kept, retimed** — these eight are the Kernel's real acceptance criteria, but they are written against V1's actual Kernel rather than a specified one. See [`acceptance.md` §3](acceptance.md#3-kernel-integrity-criteria). |
| P0.6 | AP-01–AP-17 host/pattern failure matrix | **deferred to V5** — a failure matrix over host arms AE does not yet drive is a matrix over guesses. |
| P0.7 | Measured Claude Code capability/session matrix | **narrowed into V2** — probe the capabilities the Harness actually uses, at the point it uses them. |
| P0.8 | Qualify active-release, child isolation, filesystem helper, adapters, renderers | **deferred to V5** — v1 reports `unavailable` instead of asserting qualification it has not performed. |
| P0.9 | Legacy protection archive, shadow epoch, legacy inventory | **deferred** — there is nothing to migrate until v1 is in use. The F-082 duplicate-identity item stays open and is listed in [`acceptance.md` §7](acceptance.md#7-open-items-for-the-human). |
| P0.10 | Pre-register six dogfood scenarios, baseline, cost budget | **absorbed into each slice** — every slice carries its own dogfood exit and records its own cost. |

### P1–P6 — the phases

| Old phase | Original goal | Disposition |
|---|---|---|
| P1 — safe command-proof shadow slice | A command-only feature through seed → candidate → coverage → approval → activation → runner → Ledger → Gate → `finalize --dry-run` | **becomes V1**, minus the shadow machinery. V1 runs the real path rather than a shadow of it, because there is no legacy production path to shadow against yet. |
| P2 — full Contract, proof, and instruction boundary | Generalize to artifact/human/judge proofs, amendment, backend attestation, seat contract | **split** — the seat contract and the review/finding chain become V2; the cross-family backend attestation becomes V3; artifact and human proof modes arrive when a Contract in real use needs them. |
| P3 — work/review/reader/finalize cutover | Cut new features onto the Gate; build the sole finalizer; publish the rollout lock | **split** — the single completion writer is in V1; the reader cutover and rollout lock are deferred with P0.9, for the same reason. |
| P4 — extended host binding and minimal Pattern policy | Expand the Team/provider matrix; shrink default Agent Team usage to task geometry | **partly V2, partly already true** — topology-by-geometry is a design rule in [`design.md` §4.3](design.md#43-topology-is-chosen-not-defaulted). Removing fixed reviewer/Doodlestein hard gates belongs to V2's seat selection. |
| P5 — migration-on-touch and item-by-item retirement | Migrate this project's legacy readers; retire old mechanisms against a protection map | **deferred** — same reason as P0.9. The protection-map discipline (do not delete a guard before its replacement is mutation-tested) is retained as a rule for V5. |
| P6 — dogfood and release | Six dogfood classes, G0–G7 release gates, three consecutive AE-on-AE features | **redistributed** — dogfooding moves into every slice instead of waiting at the end. Release criteria are restated, much smaller, in [`acceptance.md`](acceptance.md). |

## 4. Dependencies between slices

```text
V0 ──▶ V1 ──▶ V2 ──▶ V3
             └──▶ V4 (needs V1–V3 records; V3 optional)
                   └──▶ V5 (needs observed failures from any of V1–V4)
```

- V1 depends on V0 only for scope confirmation, not for new mechanisms.
- V2 depends on V1's Contract, Assignment, Evidence, and Gate being real.
- V3 depends on V2's `Review` object; it adds a seat, not a workflow.
- V4 depends on having real records, which means at least V1 and V2 have run
  more than once.
- V5 depends on an observed failure. It has no schedule.

## 5. What this plan refuses to do

- Build a mechanism before the slice that consumes it.
- Freeze a schema that has no producer.
- Add a guard against a failure nobody has seen.
- Count a passing fixture as a dogfood run.
- Let a deferred item reappear as a slice's prerequisite.
- Reach a release gate before a real user has run the real flow.
