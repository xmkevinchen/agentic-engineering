---
id: F-084
title: "Analysis: Contract formation is the missing left half of AE 1.0"
type: analysis
created: 2026-08-23
---

# Contract formation is the missing left half of AE 1.0

## TL;DR

- **Question**: How should facts, intent, alternatives, decisions, and unknowns
  become an exact Contract candidate without giving pre-Contract Skills truth
  or completion authority?
- **Current judgment**: `/ae:plan` must compile and present a digest-bound
  formation basis produced inline or by analyze/discuss; it cannot be the sole
  epistemic author.
- **Key open questions**: the minimal formation object, materiality ownership,
  adaptive topology triggers, and the exact coverage/approval binding.
- **Next step**: independently review this draft plan, then freeze its AC bytes
  only after F-083 closes and the user confirms the exact revision.

The user-originated observations and scope direction are preserved separately
in `formation-basis.md`; the draft below derives from them rather than treating
the planner's summary as the source.

## The distinction the current design needs to preserve

Four questions currently sit too close together:

| Question | Correct owner |
|---|---|
| What facts and constraints are present? | source observation and analysis |
| What outcome and trade-offs does the user want? | deliberation plus human decision |
| Which exact revision is authoritative? | approval, lock, and activation routine |
| Has the authoritative revision been satisfied? | admissible evidence, Gate, Finalizer |

The finalized specification closes the last two questions in detail. It says
that analyze/discuss produce draft inputs, but it does not yet require a
traceable, loss-detecting handoff from those inputs to the candidate Contract.
Calling the outputs non-authoritative is correct; treating them as dispensable
prose is not.

## Failure model

F-084 must protect at least these failures:

| ID | Failure |
|---|---|
| CF-01 | A user-stated material constraint disappears from the candidate. |
| CF-02 | A repository fact is inverted, generalized, or cited to the wrong source. |
| CF-03 | A discussion decision or trade-off is replaced by the planner's preference. |
| CF-04 | A rejected alternative silently returns as the implementation strategy. |
| CF-05 | A material unknown is hidden or relabeled non-material so activation proceeds. |
| CF-06 | The planner invents a material AC or scope expansion without presenting it as a proposal. |
| CF-07 | An Intent/Scope item has no AC, or an AC has no falsifier/executable proof, yet coverage passes. |
| CF-08 | Formation inputs change after coverage or approval while the old result is reused. |
| CF-09 | A simple task is forced through unnecessary analyze/discuss/Team ceremony. |

These are different from evidence tampering. SHA-256 can prove that the reviewed
candidate bytes did not change; it cannot prove that a material input was omitted
before those bytes were produced.

## Required conceptual model

The design should distinguish two linked lifecycle phases:

```text
Contract Formation Phase
observe → frame → deliberate → synthesize → challenge → approve/activate

Proof Execution Phase
execute → observe → adjudicate → reduce → finalize
```

These phases are orthogonal to—not replacements for—the finalized authority
planes. The cross-product is explicit:

| Lifecycle phase | Coordination Plane | Truth Plane |
|---|---|---|
| Contract Formation | analyze/discuss projections, research/Team telemetry, planner presentation | candidate identity, canonical coverage result, human approval, lock/activation, and the activation-selected immutable formation provenance |
| Proof Execution | Strategy, work/review control, dispatch and diagnosis telemetry | activated Contract, canonical Evidence Ledger events, Gate reduction, and sole Finalizer writes |

A phase name therefore grants no authority. Before activation, analysis,
discussion, and planning outputs remain Coordination Plane projections and an
unselected sealed basis remains inert candidate material. Only the existing
Truth Plane routines may record coverage/approval/activation or later proof and
lifecycle facts.

Formation needs a minimal, closed, digest-bound representation covering:

- an exact delivered-input manifest for foreground user turns, selected
  repository sources, host observations, and prior decisions, together with the
  source-selection method and its known completeness boundary;
- source observations and citations;
- human intent and explicit constraints;
- assumptions and confidence/validation state;
- unknowns with materiality and disposition;
- alternatives, decisions, rejected alternatives, and trade-offs;
- derivation links into Intent, Scope, AC, falsifier, proof, and source set;
- planner-introduced proposals and intentional omissions/out-of-scope decisions.

Trace is bidirectional: every material delivered input must be retained or have
a typed visible disposition, and every material candidate semantic must derive
from such an input or a visible Agent proposal. This cannot prove that the
delivered repository/source universe contains every fact in the world; it makes
the selection boundary explicit and lets coverage report source incompleteness
instead of silently asserting omniscience.

Before activation, a sealed formation basis is an inert candidate-stage object.
When an activation selects it, its exact bytes become immutable Contract
provenance stored under the Contract authority tree and included in replay/
commit snapshots. It is authoritative only for “which formation inputs and
dispositions this Contract bound,” not for whether source claims are true or a
proof passed. Human-readable analyze/discuss pages remain replaceable
projections; the formation basis is not a Ledger event or completion Evidence.
F-084 must justify every new object by a concrete failure above and prefer one
reusable basis/view over per-Skill formats.

## Task geometry, not a mandatory pipeline

The formation properties apply to every candidate, but the coordination topology
should scale:

- A small, explicit, local change may let `/ae:plan` invoke a shared formation
  producer inline in the same session. The producer seals the basis; plan only
  consumes its identity and presents candidate deltas.
- Ambiguity, multiple viable architectures, cross-cutting scope, material
  unknowns, safety/compliance trade-offs, irreversible choices, or conflicting
  goals should trigger explicit analysis and/or discussion.
- Team, debate, cross-family, or Doodlestein remain optional strategies selected
  only when the task geometry or a proof requirement earns them.

The same trace and unresolved-question properties must hold in both modes. Plan
cannot self-certify “simple” to waive a missing property: a shared policy may
select a provisional path, while deterministic validation and coverage reject
missing inputs, dispositions, or deliberation. A command name is not evidence
that formation occurred.

## Boundary with Evidence

Pre-Contract observations explain why a candidate was formed. They do not
automatically prove that an activated Contract has been satisfied. If a baseline
or observation must close a proof, a qualified producer must capture it under an
explicit admissibility rule and bind it to the activated revision. Discussion
prose and Agent self-report never become proof by being referenced from the
formation object.

## Existing pieces to reuse

The finalized design already contains useful components rather than a blank
slate: candidate identity, source/input manifests, source-first delivery,
coverage review, typed findings, the human safe view, approval binding,
activation, staleness, and amendment. F-084's job is to connect those pieces to
formation provenance and loss detection, not to add a second Contract or Gate.

### Verification considerations

| Dimension | Verification approach |
|---|---|
| Authority separation | Producer/consumer matrix plus negative fixtures that submit formation objects to proof/lifecycle endpoints |
| Silent omission/invention | CF-01–CF-08 mutation corpus with typed expected failures |
| Proportionality | One inline simple positive control and explicit complex-task controls with equal output properties |
| Human comprehensibility | Golden safe views showing source → decision → Contract trace and all material deltas |
| Identity/staleness | Raw-byte/JCS digest, replay, drift, presentation-only, and approval-reuse fixtures |
| Specification consistency | Cross-document terminology, identity, state, and dependency review before acceptance |

## Deliverable boundary

F-084 is a design/specification feature. It must produce:

1. one coherent formation model and authority table;
2. the minimal artifact/schema and trace semantics;
3. inline-versus-explicit task-geometry rules;
4. plan compiler, coverage, human-view, activation, staleness, and amendment
   behavior;
5. positive and adversarial acceptance fixtures;
6. consistent amendments to the finalized v1 documents;
7. a frozen implementation interface for F-085.

It does not implement production Skills or runtime code.
