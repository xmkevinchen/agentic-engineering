---
title: "AE 1.0 Contract Formation Phase"
type: plan
created: 2026-08-23
status: draft
discussion: ""
feature: F-084
material_revision: M0-candidate
strategy_revision: S0
authority: bootstrap_non_authoritative
---

# Feature: AE 1.0 Contract Formation Phase

## Goal

Amend the AE 1.0 specification so that an exact Contract candidate is visibly
and reviewably derived from repository facts, human intent, assumptions,
unknowns, alternatives, and decisions, while `/ae:plan` remains a compiler and
activation controller and all pre-Contract material remains outside completion
authority.

## Contract boundary

This plan is a candidate. Its Acceptance Criteria are not frozen and no work
order is authorized until the user confirms the exact text and a byte-identical
`goal.frozen.md` is created after F-083's current bootstrap boundary closes.
The bootstrap source for this candidate is `formation-basis.md`; any material
departure from its user inputs must be shown as a typed proposal or disposition.

The work may modify the normative `.ae/1.0/finalized/` documents and create
design fixtures. It must not modify production Skills, Gate/runtime code,
F-083's plan/goal/attempts, or publish any rollout authority. F-085 owns
implementation after this design is accepted.

## Non-goals

- Do not give analyze/discuss/Team output proof, approval, lifecycle, or
  completion authority.
- Do not make `/ae:analyze → /ae:discuss → /ae:plan` a mandatory command chain.
- Do not introduce another Contract, reducer, Ledger, finalizer, daemon,
  workflow engine, Pattern DSL, or general orchestrator.
- Do not let a trace link turn pre-Contract prose or self-report into Evidence.
- Do not claim semantic correctness can be established by hashes or structural
  validation alone.
- Do not implement F-085 production changes in this feature.

## Verification-dimension mapping

| Analysis dimension | Acceptance Criteria |
|---|---|
| Authority separation | AC1, AC7, AC8 |
| Silent omission/invention | AC2, AC3, AC5, AC8 |
| Proportionality | AC4 |
| Human comprehensibility | AC6 |
| Identity/staleness | AC2, AC5, AC6 |
| Specification consistency | AC9, AC10 |

## Steps

### Step 1 — Freeze the formation gap and failure model (AC1, AC8)

Map the current finalized statements and Skill behavior against CF-01–CF-09.
Separate missing semantics from existing reusable candidate/source/coverage/
approval machinery. Record every proposed new mechanism together with the
specific failure it protects.

Expected files: `.ae/features/active/F-084-contract-formation-plane/formation-failure-map.md`

human-gate: true

### Step 2 — Define the minimal formation object and views (AC2, AC3, AC5)

Specify one closed, versioned formation representation—or prove an existing
object can carry the properties without ambiguity. Define canonicalization,
raw-byte digests, an exact delivered-input manifest and selection boundary,
bidirectional source→formation→Contract trace, source citations, materiality,
assumption/unknown states,
decision and rejected-alternative semantics, Intent/Scope/AC/proof trace links,
planner proposals, omissions, and human dispositions. Define a deterministic
business-safe view separately from machine identity. Specify inert candidate
storage, activation-selected immutable Contract-provenance storage, replay and
commit-snapshot inclusion, and the deletion/rebuild boundary for prose
projections.

Expected files: `.ae/features/active/F-084-contract-formation-plane/formation-model.md`,
`.ae/features/active/F-084-contract-formation-plane/formation-fixtures.md`,
`plugins/ae/tests/specs/test-contract-formation-trace.sh`,
`plugins/ae/tests/specs/test-contract-formation-loss-matrix.sh`,
`plugins/ae/tests/specs/test-contract-formation-semantic-delta.sh`,
`plugins/ae/tests/fixtures/contract-formation-spec/**`

human-gate: false

### Step 3 — Define adaptive formation topology (AC4)

Specify observable task-geometry triggers and the inline and explicit modes.
Both modes must produce the same required properties. Teams and named patterns
remain strategy choices, never formation or proof authority. A shared formation
controller/producer may run inline in the plan session, but plan cannot seal its
own basis or waive required properties by self-reporting that a task is simple.

Expected files: `.ae/features/active/F-084-contract-formation-plane/task-geometry.md`

human-gate: true

### Step 4 — Make plan a compiler and coverage a source-aware challenger (AC3, AC5, AC6)

Define how plan consumes exact formation inputs, presents every material
addition/deletion/reinterpretation, and emits a candidate plus trace. Define
source-first coverage delivery from the complete declared input manifest,
reverse delivered-input disposition checks, new or reused typed findings,
single-flight
identity, and the boundary between deterministic structural checks and semantic
evaluator judgment.

Expected files: `.ae/features/active/F-084-contract-formation-plane/formation-model.md`, `.ae/features/active/F-084-contract-formation-plane/formation-fixtures.md`

human-gate: false

### Step 5 — Close human approval, activation, staleness, and amendment (AC3, AC6)

Define the safe view a human approves, including unresolved material questions,
assumptions, decisions, rejected alternatives, proposed additions, omissions,
AC/proof traces, and coverage findings. Bind approval/lock/activation to the
exact candidate and formation identities. Any material input drift must stale
coverage/approval. Define bounded or paged exact delivery: every material item
appears exactly once under a root manifest/digest, page order/count is closed,
and the human completes the full delivery before approval. Host truncation or
an inability to deliver all pages is `unavailable`, never permission to
summarize away material content. Post-activation changes use the existing
amendment ratchet.

Expected files: `.ae/features/active/F-084-contract-formation-plane/formation-model.md`,
`.ae/features/active/F-084-contract-formation-plane/human-safe-view.md`,
`plugins/ae/tests/specs/test-contract-formation-binding.sh`,
`plugins/ae/tests/fixtures/contract-formation-spec/**`

human-gate: false

### Step 6 — Preserve the Evidence boundary (AC7, AC8)

Specify which formation observations remain provenance-only and how a fact that
must close a proof is recaptured or admitted by a qualified producer. Prove that
formation artifacts cannot be recorded through public endpoints as canonical
proof, coverage, judge, human, or lifecycle events.

Expected files: `.ae/features/active/F-084-contract-formation-plane/authority-matrix.md`,
`.ae/features/active/F-084-contract-formation-plane/formation-fixtures.md`,
`plugins/ae/tests/specs/test-contract-formation-authority.sh`,
`plugins/ae/tests/fixtures/contract-formation-spec/**`

human-gate: true

### Step 7 — Update the v1 specification and freeze the F-085 interface (AC1, AC9)

Update `README.md`, `philosophy.md`, `design.md`, `implementation-plan.md`,
`migration-map.md`, and `acceptance-and-evaluation.md` consistently. Add the
F-085 implementation dependency and staged v1 cutover/rollout/release gates.
Produce a field/producer/consumer/authority matrix and fixture catalog sufficient
for implementation without inventing material semantics during coding. Define
digest-bound interface checkpoints that join formation changes to each affected
P0/P1/P2/P3 package before that package's exit is accepted; name the checkpoint
producer, fresh reviewer, raw review artifact, identity fields, and acceptance
consumer instead of treating implementation-plan table rows as authorities.

Expected files: `.ae/1.0/finalized/{README,philosophy,design,implementation-plan,migration-map,acceptance-and-evaluation}.md`,
`.ae/features/active/F-084-contract-formation-plane/f085-interface.md`,
`plugins/ae/tests/specs/test-contract-formation-doc-consistency.sh`

human-gate: true

### Step 8 — Independent review (AC4, AC8, AC10)

Fresh review receives the pre-change finalized source set, new specification,
formation model, failure matrix, fixtures, and cross-document diff before the
author's summary. It must separately judge authority preservation, semantic
closure, task-geometry proportionality, implementability, and unnecessary
mechanism.

Expected files: `.ae/features/active/F-084-contract-formation-plane/review.md`

human-gate: true

## Acceptance Criteria

### AC1: The finalized v1 model contains a complete Contract Formation Phase
- verify_by: judge
- judge-class: fact-claim
- fixture: per-feature

The normative documents distinguish observation, framing, deliberation,
synthesis, coverage, human approval, activation, proof execution, Gate
reduction, and finalization. These are lifecycle phases orthogonal to the
existing Truth Plane and Coordination Plane, not replacement authority planes.
Each stage has an explicit producer, input, output, authority-plane owner,
mutation right, and next consumer. No stage describes `/ae:plan` as the sole
epistemic source of Contract semantics, and no pre-Contract stage gains
completion authority. An unselected sealed basis is inert candidate material;
activation makes its exact bytes immutable Contract-formation provenance under
the Contract authority tree and commit snapshot, while analyze/discuss pages
remain rebuildable projections. That provenance proves what the Contract bound,
not whether a source claim is true or a proof passed.

Fresh Codex first reads the pre-F-084 finalized authority model, the exact
user-originated `formation-basis.md`, CF-01–CF-09, and the raw specification diff
without the author's conclusion. For every material stage/authority claim it
returns `{claim, verdict, source citations, independently re-derived owner/input/
output/authority, mismatch}`; a holistic pass or self-consistency-only reading
is invalid.

### AC2: Delivered formation inputs and Contract semantics have bidirectional trace without becoming proof
- verify_by: integration
- verify: `sh plugins/ae/tests/specs/test-contract-formation-trace.sh`
- fixture: project

A closed delivered-input manifest binds exact foreground user turns, selected
repository sources, observations, and prior decisions plus the selection method
and known completeness boundary. Fixtures prove both directions: every material
delivered item is retained or has a typed visible disposition, and every Intent,
Scope item, AC, falsifier, proof, and material selector derives from one or more
delivered items or an explicitly presented Agent proposal. Missing, duplicate,
dangling, wrong-digest, excluded-source, circular, wrong-kind, silent-drop, and
silent-invention links fail. Coverage can return `source_set_incomplete`; the
mechanism does not claim an unknowable global source universe is complete. Valid
links establish derivation provenance only, not completion Evidence.

### AC3: Material unknowns, assumptions, omissions, and decisions cannot disappear silently
- verify_by: integration
- verify: `sh plugins/ae/tests/specs/test-contract-formation-loss-matrix.sh`
- fixture: project

Fixtures for CF-01–CF-06 prove that an unresolved material unknown, undisclosed
assumption, dropped constraint/decision, resurrected rejected alternative,
planner-added material semantic, or omitted material input prevents approval or
activation until it receives a typed resolution visible in the human safe view.
Non-material items require an explicit rationale rather than field deletion.

### AC4: Formation scales with task geometry rather than command ceremony
- verify_by: judge
- judge-class: fact-claim
- fixture: per-feature

The design defines inline and explicit formation modes with the same output
properties and observable escalation signals. A small unambiguous positive
control reaches a valid candidate without a separate analyze/discuss/Team run;
ambiguous, cross-cutting, high-risk, irreversible, or materially disputed
fixtures cannot bypass the additional observation/deliberation they require.
Agent count, command count, and presence of a discussion directory are never
validity predicates.

Fresh Codex first reads the preregistered simple/complex task inputs, risk and
ambiguity facts, required formation properties, and raw cost observations, then
reads the topology policy. For every fixture it returns `{fixture, independently
derived minimum required properties, design-selected path, verdict, evidence
cites, excess-or-missing ceremony}`. The design author and formation planner are
excluded from this judge context.

### AC5: Plan compilation exposes every material semantic delta
- verify_by: integration
- verify: `sh plugins/ae/tests/specs/test-contract-formation-semantic-delta.sh`
- fixture: project

Given exact formation inputs, candidate generation emits a deterministic typed
projection of retained, added, omitted, narrowed, widened, and reinterpreted
material semantics. A shared formation producer seals inline or explicit inputs;
plan consumes that identity and cannot seal its own basis or self-classify a
task as simple to waive required properties. Unsupported additions are labeled
Agent proposals; omissions and reinterpretations require visible disposition.
Negative fixtures prove that
editing only prose, IDs, storage paths, ordering, or renderer metadata cannot
hide a material delta or manufacture a new coverage subject.

### AC6: Coverage and human approval bind the same formation and candidate identities
- verify_by: integration
- verify: `sh plugins/ae/tests/specs/test-contract-formation-binding.sh`
- fixture: project

Coverage receives the controlled formation/source input before executor or plan
summary, reports typed formation and Contract gaps, and binds the exact formation
basis, candidate, view, input manifest, and raw result. Human approval displays
the exact trace/decision/unresolved/delta view and binds the same identities.
Large views use a closed root manifest plus bounded ordered pages; every material
item appears exactly once, all pages are delivered and acknowledged, and any
missing/duplicate/reordered/truncated/over-limit page makes approval unavailable.
Changing any material formation input, candidate semantic, coverage subject, or
approved view makes reuse stale; presentation-only rebind follows the existing
closed exception and cannot change semantics.

### AC7: Formation observations and completion Evidence remain different domains
- verify_by: integration
- verify: `sh plugins/ae/tests/specs/test-contract-formation-authority.sh`
- fixture: project

Public and adversarial producers cannot turn analysis/discussion/plan artifacts,
Team messages, citations, or self-reports into canonical command, artifact,
human, coverage, judge, activation, or finalization facts. When a pre-Contract
observation is required by a proof, the accepted design names the qualified
producer, activation binding, raw input/output, source snapshot, and assurance
needed to admit it. Missing recapture/admission leaves the proof pending or
unavailable, never passed.

### AC8: The design closes CF-01–CF-09 without creating a second truth system
- verify_by: judge
- judge-class: fact-claim
- fixture: per-feature

For every failure, the review identifies the exact preventing mechanism and an
executable positive/negative fixture. The object/property map proves that the
design reuses the existing Contract candidate, source/input manifests, coverage,
approval, activation, amendment, Ledger, Gate, and Finalizer rather than adding
a parallel state machine. Any mechanism without a mapped failure or consumer is
removed or explicitly deferred.

Fresh Codex first reads the pre-change Contract/Ledger/Gate/Finalizer object and
authority maps, CF-01–CF-09 inputs, and fixture expected outcomes, then reads the
new design. It emits one record per failure and new mechanism with
`{failure/mechanism, independently derived required protection, actual producer/
consumer/storage/authority, verdict, source citations, redundancy or gap}`.
Summary-only approval is invalid.

### AC9: F-085 receives a closed interface and release consumes only generic formation qualification
- verify_by: integration
- verify: `sh plugins/ae/tests/specs/test-contract-formation-doc-consistency.sh`
- fixture: per-feature

The specification provides exact schema/field semantics, producer-consumer ACL,
Skill behavior, CLI/runtime entry points, staleness rules, migration behavior,
fixture catalog, milestone dependencies, and old-mechanism dispositions required
by F-085. `f085-interface.md` is digest-bound and defines a closed generic
interface-checkpoint identity containing at least the accepted formation
interface digest, affected mainline package ID, implementation artifact digest,
producer invocation ref/digest, fresh non-author review ref/raw-result digest,
and decision. It names the package mutation owner as producer, the canonical
fresh review seat/normalizer as reviewer, and the affected package exit gate as
consumer. Every formation change joins an affected P0/P1/P2/P3 package before
that package is accepted; a table row or prose claim is not an interface
authority. The repository release process requires staged generic pre-cutover,
pre-rollout, and release qualification, but production schemas/Gate/rollout code
consume only versioned contract-formation capability/qualification artifacts
bound by release-manifest digest. No production field, policy, join, or runtime
branch names `F-084`, `F-085`, a feature review pointer, or another development-
ticket identity. F-083's frozen Phase-0 Contract remains unchanged.

### AC10: Independent review confirms the amended specification matches its sources and failure claims
- verify_by: judge
- judge-class: fact-claim
- fixture: per-feature

Fresh Codex first reads the pre-change finalized documents, exact formation
input manifest and user turns, CF-01–CF-09 fixtures, and all raw deterministic
test outputs; only then does it read the amended specification and author
summary. For every material normative or comparative claim it emits
`{claim, verdict, evidence citation, independently re-derived answer, unresolved
gap}`. It separately reports cross-document contradictions and whether any new
mechanism lacks a failure/consumer. An accepted review must bind the exact
specification, model, fixture, and test-output digests; prose-only or holistic
approval fails.
