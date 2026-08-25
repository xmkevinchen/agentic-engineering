---
title: "AE 1.0 formation-aware Skills and activation"
type: plan
created: 2026-08-23
status: draft
discussion: ""
feature: F-085
material_revision: M0-candidate
strategy_revision: S0
authority: bootstrap_non_authoritative
---

# Feature: AE 1.0 formation-aware Skills and activation

## Goal

Implement the accepted Contract Formation Phase so that AE preserves material
facts, intent, assumptions, decisions, alternatives, unknowns, and traceability
through Contract candidate generation, coverage, human approval, activation,
and amendment—without granting pre-Contract Skills or coordination artifacts
proof or completion authority.

## Preconditions

- F-083 has an accepted continuation checkpoint with
  `implementation_next_allowed: P0.1`; every P0.G lane is valid, all required
  capabilities are feasible, and the same exact support arm is bound. An honest
  accepted `not_feasible`, `inconclusive`, or `implementation_next_allowed:none`
  result leaves F-085 implementation blocked rather than authorizing work.
- F-084 has an exact human-confirmed frozen goal and accepted independent review.
- The F-084 schema/authority/interface digest is fixed in this feature's source
  set before the first implementation request. Its `f085-interface.md` defines
  the generic digest-bound checkpoint schema, package mutation-owner producer,
  canonical fresh non-author review artifact, and package-exit consumer; a
  mainline work-package row is never treated as an independently accepted
  interface by itself.
- F-085 is a release-train integration feature, not a linear replacement for
  the missing kernel. Its steps bind the accepted P0/P1/P2/P3 milestones below;
  they neither reimplement those components nor call absent APIs.

### Mainline milestone bindings

| F-085 step | Join point in the mainline | Gate imposed by F-085 |
|---|---|---|
| Step 1 | after accepted P0.1 and while P0.2 canonical schema/runtime work is open | formation schema/identity and its checkpoint join P0.2 before P0.2 exits or freezes authoritative schemas |
| Step 2 | after Step 1 and before affected P3.2/P3.4/P3.5 Skill/reader packages exit | formation producers and projections land before those package exits; no absent Gate API is emulated |
| Step 3 | while P1.2, P1.4, and P1.5 are open | source/input, candidate, compiler, and plan-review changes join each package before its exit; each emits the F-084 checkpoint identity |
| Step 4 | while P1.4/P1.5 are open, then while P2.1/P2.2 are open | coverage/view changes consume the same formation identity before every affected package exit |
| Step 5 | while P1.3/P1.5/P1.7 and P2.3 are open | recorder, activation, status, and amendment changes join before—not after—each affected package exit, without adding another recorder/reducer |
| Step 6 | after Steps 1–5, before affected P3 package exits and then after P3.6/P3.7 but before P3.8 | pre-cutover checks gate affected P3 exits; a separate pre-rollout shadow end-to-end phase gates rollout publication |
| Step 7 | only after P3.8/P3.10 make enforce dogfood reachable, during P6 | release-phase AE-on-AE dogfood and independent acceptance gate final v1 release, never the earlier cutover that makes them possible |

No work package may emulate a missing authority with prose, schema-shaped Skill
JSON, or an attempt-local producer.

## Non-goals

- Do not redesign the accepted F-084 semantics during implementation.
- Do not make Team, debate, analyze, or discuss mandatory for every feature.
- Do not treat a formation citation as proof that the cited claim is true or
  that the activated Contract is satisfied.
- Do not restore legacy plan status, review verdict, Task, directory, or Skill
  prose as lifecycle truth.
- Do not add a second Gate, recorder, Contract, or finalizer.
- Do not publish P3.8 rollout until the `pre_rollout` subset of AC12 and all
  earlier applicable ACs pass. Do not publish final v1 release until every AC,
  including post-enforce AC13, and the enclosing release gates pass.

## Verification-dimension mapping

| Analysis dimension | Acceptance Criteria |
|---|---|
| Shared representation | AC1 |
| Analyze/discuss fidelity | AC2, AC3 |
| Plan compilation | AC4, AC5 |
| Authority boundary | AC8, AC9 |
| Adaptive UX | AC5, AC7 |
| Staleness/recovery | AC7, AC8, AC10 |
| Plan-review boundary | AC14 |
| Non-regression and staged release | AC11, AC12, AC13 |

## Steps

### Step 1 — Shared formation primitives (AC1, AC9)

Implement the accepted closed schema, JCS/raw-byte identity, source reference
validation, deterministic renderer/safe view, semantic projection/diff, and
positive/negative fixtures. The implementation must be project-semantic-blind
and contain no F-084/F-085 special cases.

Expected files: `plugins/ae/schemas/contract-formation-v1.schema.json`, `plugins/ae/runtime/formation/**`, `plugins/ae/tests/fixtures/contract-formation/**`

human-gate: false

### Step 2 — Analyze/discuss producers (AC2, AC3)

Refactor analyze/discuss/consensus to emit or extend the shared formation basis
with provenance, assumptions, unknowns, alternatives, decisions, trade-offs,
and rejected alternatives. Preserve rich human-readable outputs as projections.
All Team/research activity remains telemetry; only the dedicated formation
producer may seal a formation object, and sealing does not create a canonical
proof event.

Expected files: `plugins/ae/skills/analyze/SKILL.md`, `plugins/ae/skills/discuss/SKILL.md`, `plugins/ae/skills/consensus/SKILL.md`, `plugins/ae/runtime/formation/**`

human-gate: true

### Step 3 — Plan compiler, plan-review, and adaptive path (AC4, AC5, AC14)

Make plan consume an exact basis sealed by the shared formation producer and
generate trace-complete candidate semantics plus every typed material delta. A
shared formation controller may provisionally select inline or explicit work
from the accepted task-geometry policy; plan cannot seal the basis or self-label
a task simple to waive properties. Plan may request dedicated coverage/approval/
activation operations but cannot write their authoritative events itself.
Plan-review receives the exact source/formation/candidate identities source-
first, reports typed formation and proof-executability gaps, and cannot approve,
activate, record proof, or substitute a prose verdict for canonical coverage.

Expected files: `plugins/ae/skills/plan/SKILL.md`,
`plugins/ae/skills/plan-review/SKILL.md`, `plugins/ae/runtime/formation/**`,
`plugins/ae/tests/fixtures/contract-formation/**`,
`plugins/ae/tests/scripts/test-contract-formation-plan-review.sh`

human-gate: false

### Step 4 — Coverage and human approval (AC6, AC7)

Deliver formation/source-first input manifests to fresh coverage evaluators;
normalize typed findings verbatim; render and completely deliver the exact human
safe view; bind approval to the accepted formation/candidate/coverage/view
identities. Structural validation and semantic evaluator authority remain
distinct.

Expected files: `plugins/ae/runtime/coverage/**`, `plugins/ae/runtime/contract/**`, `plugins/ae/tests/fixtures/contract-formation/**`

human-gate: true

### Step 5 — Activation, amendment, Evidence boundary, and status (AC8, AC9, AC10)

Bind lock, activation, current pointer, staleness, amendment, and status to the
accepted identities while storing selected formation bytes as Contract
provenance rather than proof events. Preserve producer ACL and the single Gate.

Expected files: `plugins/ae/runtime/contract/**`, `plugins/ae/runtime/gate/**`, `plugins/ae/tests/fixtures/contract-formation/**`

human-gate: false

### Step 6 — Pre-cutover and pre-rollout qualification (AC11, AC12)

First run the schema, Skill, plan-review, formation-authority, legacy, and
non-finalizing controls that do not depend on P3 finalization; that generic
pre-cutover qualification gates only the affected P3 package exits. After P3.6
and P3.7 exist, run the separate shadow formation-through-finalization,
crash/retry/staleness, and simple/complex controls; that pre-rollout phase gates
P3.8. Neither phase claims enforce AE-on-AE evidence that only P3.8/P3.10 makes
reachable. Disposition every replaced handoff and temporary producer.

Expected files: `plugins/ae/tests/scripts/test-contract-formation-*.sh`,
`plugins/ae/runtime/release/contract-formation-qualification/**`,
`.ae/features/active/F-085-formation-aware-skills/build-notes.md`

human-gate: false

### Step 7 — Post-enforce dogfood and release acceptance (AC12, AC13)

Only after P3.8/P3.10 make enforce execution reachable, join the generic release
qualification to P6: run the release-required AE-on-AE formation-through-
finalization dogfood, full authority regression, documentation/as-built check,
and fresh independent review. The resulting release phase can block final v1
release but cannot retroactively be a prerequisite of P3 cutover or rollout.

Expected files: `plugins/ae/runtime/release/contract-formation-qualification/**`,
`.ae/features/active/F-085-formation-aware-skills/{build-notes,review}.md`

human-gate: true

## Acceptance Criteria

### AC1: One shared formation representation is implemented and closed
- verify_by: integration
- verify: `sh plugins/ae/tests/scripts/test-contract-formation-schema.sh`
- fixture: project

The implementation validates the exact F-084 schema and canonicalization digest,
binds the exact delivered-input manifest/selection boundary, enforces
bidirectional delivered-input→formation→Contract trace, rejects unknown/missing/
duplicate/wrong-kind/circular/dangling/silent-drop/silent-invention fields and
refs, and renders deterministic machine and human projections. Re-generation
from the same inputs is byte-identical. Unselected bases are inert candidate
objects; activation-selected bytes are immutable Contract provenance included in
replay and commit snapshots. Analyze/discuss prose remains rebuildable. No
Skill-specific shadow representation can be consumed by candidate generation,
coverage, approval, or activation.

### AC2: Analyze preserves source facts, assumptions, unknowns, and provenance
- verify_by: judge
- judge-class: fact-claim
- fixture: per-feature

For controlled repositories, analyze emits source observations with exact refs
and digests, distinguishes observation from inference, records assumptions and
material unknowns, and never reports unavailable facts as established. Fresh
Codex first reads the exact foreground-input and repository-source manifest and
independently derives its material facts before reading the sealed basis or
analysis summary. It emits one record per material claim with `{claim, verdict,
source citation, independently re-derived answer, mismatch}`. Formation output
has Contract-provenance potential only when selected by activation; it has no
proof or lifecycle authority.

### AC3: Discuss preserves decisions, alternatives, trade-offs, and unresolved questions
- verify_by: judge
- judge-class: fact-claim
- fixture: per-feature

Controlled discussions prove that adopted and rejected alternatives, decision
reasons, trade-offs, dissent/material uncertainty, human decisions, and open
questions survive into the sealed formation basis. Team consensus or TL scoring
cannot silently resolve a human-owned or material unknown, and absence of Team
support degrades topology rather than deleting semantics.

Fresh Codex first reads the exact user turns, raw option/decision inputs, and
source observations without the discussion conclusion. For every material
question, alternative, decision, rejection, trade-off, and unresolved item it
emits `{item, independently re-derived state, discussion-basis state, verdict,
source citations, mismatch}`. The discussion author and planner are excluded
from the judge context; holistic “the discussion looks complete” is invalid.

### AC4: Plan behaves as a trace-preserving compiler
- verify_by: integration
- verify: `sh plugins/ae/tests/scripts/test-contract-formation-compiler.sh`
- fixture: project

Plan consumes an identity sealed by the shared formation producer and produces
trace-complete Intent, Scope, AC, falsifier, proof, and source semantics plus a
typed material delta. It cannot seal its own basis, elevate projections, or
write authority events. CF-01–CF-06 mutations fail before approval/activation.
Agent proposals,
omissions, narrowing, widening, and reinterpretation are visible and require the
accepted disposition. Plan cannot create approval, activation, proof, or done
events through public recorder endpoints.

### AC5: Inline and explicit formation have equal validity with proportional cost
- verify_by: integration
- verify: `sh plugins/ae/tests/scripts/test-contract-formation-topology.sh`
- fixture: project

A preregistered simple positive control lets a shared formation producer run
inline in the plan session without a separate analyze/discuss/Team run and
satisfies the same schema/trace rules. A shared controller may select a
provisional path from explicit signals; plan self-report cannot waive a missing
input, disposition, or deliberation property. The
ambiguous, cross-cutting, high-risk, irreversible, conflicting-goal, and material-
unknown controls select the required explicit observation/deliberation path.
Changing command count, Agent count, or creating an empty discussion artifact
cannot satisfy a missing property.

### AC6: Coverage detects formation loss and remains independent
- verify_by: judge
- judge-class: fact-claim
- fixture: per-feature

Fresh coverage receives the accepted source/formation/candidate input manifest
without executor/plan conclusions, returns one canonical object, and detects
CF-01–CF-08 with the accepted typed findings. Author anchors, input exclusions,
dispatch/result identity, first-terminal latch, and source completeness prevent
the planner, dispatcher, or another seat from manufacturing a green result.

Fresh Codex first reads the exact foreground/repository input manifest, source
selection boundary, raw formation inputs, and candidate without any planner or
executor conclusion; it independently derives material input dispositions and
Contract coverage. For every delivered input, trace, candidate semantic, and
reported finding it emits `{subject, independently re-derived answer, coverage
answer, verdict, source citations, gap}`. Summary-only judgment is invalid.

### AC7: Human approval is exact, readable, and stale on material change
- verify_by: manual
- fixture: per-feature

The foreground safe view lets the user inspect original intent, facts,
assumptions, unknowns, decisions, rejected alternatives, material deltas,
Intent/Scope/AC/proof trace, and coverage findings without opening machine JSON.
Accept/edit/reject binds the exact formation, candidate, coverage, view, host
operation, and assurance. Any material drift invalidates reuse; edit produces a
new candidate/generation rather than mutating approved bytes. Large views use a
closed root manifest and bounded ordered pages: every material item appears
exactly once, page count/order/digests are fixed, and the host records complete
foreground delivery before accepting a decision. Missing, duplicate, reordered,
truncated, or over-limit delivery returns `unavailable`; summaries may aid
navigation but cannot replace exact pages.

### AC8: Activation and amendment preserve the authority ratchet
- verify_by: integration
- verify: `sh plugins/ae/tests/scripts/test-contract-formation-activation.sh`
- fixture: project

Only the dedicated commit routine may write lock, activation, and current
pointer after revalidating formation/candidate/coverage/approval identities and
the absence of material unresolved items. Post-activation material changes open
an amendment, retain history, repeat formation/coverage/approval, and in v1
re-prove the revision. Skill JSON, direct file writes, replay, stale approval,
and same-ID replacement all fail closed. Activation no-clobber publishes the
selected formation bytes under the Contract authority tree and binds them into
feature replay and final evidence snapshots; this is provenance authority, not
a Ledger proof observation.

### AC9: Formation cannot forge or satisfy completion Evidence
- verify_by: integration
- verify: `sh plugins/ae/tests/scripts/test-contract-formation-authority.sh`
- fixture: project

Producer ACL and endpoint attack fixtures reject formation objects, analyses,
discussion conclusions, Team messages, citations, and plan summaries presented
as command/artifact/human observations, judge/coverage results, activation, or
finalization. A Contract proof that needs an earlier fact remains pending or
unavailable until the accepted qualified recapture/admission path produces an
exact activation-bound event.

### AC10: Status exposes actionable formation failures without a second truth source
- verify_by: integration
- verify: `sh plugins/ae/tests/scripts/test-contract-formation-status.sh`
- fixture: project

Before activation, status projects draft formation/candidate diagnostics,
unresolved material items, coverage state, and next legal action from accepted
objects. It never reports proof/finalize eligibility. After activation, the
existing Gate remains the only proof/lifecycle reducer; deleting any status,
plan, analysis, discussion, or view projection does not change authoritative
state and projections can be rebuilt byte-equivalently. Deleting or changing
the activation-selected immutable formation basis is instead a Contract-
provenance integrity error, never a projection refresh.

### AC11: Legacy and simplified paths fail safely
- verify_by: integration
- verify: `sh plugins/ae/tests/scripts/test-contract-formation-legacy.sh`
- fixture: project

Legacy prose is never silently adopted as a v1 formation basis. The accepted
migration policy either constructs an explicit conservative formation record
with human disposition or leaves the feature on its legacy reader. Missing host,
Team, model, or provider capability produces a supported solo/manual/unavailable
result without weakening formation or proof requirements.

### AC12: Staged generic formation qualification gates only evidence-reachable milestones
- verify_by: integration
- verify: `sh plugins/ae/tests/scripts/test-contract-formation-release-gate.sh`
- fixture: per-feature

One closed generic contract-formation qualification lineage has monotonic,
digest-bound `pre_cutover`, `pre_rollout`, and `release` phases. `pre_cutover`
contains only schema/ACL/Skill/plan-review/legacy controls that are executable
without P3 finalization and gates the affected P3 package exits. `pre_rollout`
runs only after P3.6/P3.7 and adds shadow formation-through-finalization,
staleness/crash/replay attacks, simple/complex controls, and required live-host
arms before P3.8. `release` runs only after P3.8/P3.10 and adds the P6-required
enforce AE-on-AE dogfood and full G0–G7/release evidence. No earlier phase
requires evidence made reachable only by a later milestone. Each consumer
rejects a missing, stale, failed, unsupported, mismatched, or wrong-phase
qualification. Production schema, Gate, policy, and rollout joins contain no
`F-084`, `F-085`, feature-review pointer, or development-ticket branch. Every
old or temporary mechanism has `delete|retain|pending-audit` disposition.

### AC13: Fresh independent review confirms implementation and documentation match F-084
- verify_by: judge
- judge-class: fact-claim
- fixture: per-feature

Fresh Codex first reads the exact accepted F-084 specification/interface,
formation/source fixtures, raw CF-01–CF-09 results, existing authority-regression
outputs, complete `release` qualification, and source diff without executor summaries. For
every material implementation, authority, compatibility, and as-built/user-doc
claim it emits `{claim, verdict, evidence citation, independently re-derived
answer, unresolved gap}`. It binds the exact source, qualification, test, and
documentation digests. A holistic pass, review of prose alone, or a review by an
implementation author cannot accept the feature.

### AC14: Plan-review challenges exact formation and candidate identities without gaining authority
- verify_by: integration
- verify: `sh plugins/ae/tests/scripts/test-contract-formation-plan-review.sh`
- fixture: project

Plan-review receives the exact delivered-source manifest, sealed formation
identity, candidate identity, semantic delta, and proof recipes before planner
or executor conclusions. Positive fixtures report typed formation-coverage,
Contract-coverage, and proof-executability gaps with exact refs. Forgery fixtures
prove that wrong/stale formation or candidate identity, missing source-first
delivery, prose-only input, author-only self-review, invented disposition, and
summary substitution fail closed. Plan-review may propose findings and request
canonical coverage, but its Skill output and public endpoints cannot create
approval, activation, Evidence, Gate pass, finalization, or a canonical coverage
result.
