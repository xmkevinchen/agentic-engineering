---
id: F-085
title: "Analysis: Formation-aware Skills implementation surface"
type: analysis
created: 2026-08-23
---

# Formation-aware Skills implementation surface

## TL;DR

- **Question**: How can Claude Code Skills implement the accepted Formation
  Phase without recreating Skill-local truth or mandatory ceremony?
- **Current judgment**: use one shared formation schema/producer/validator and
  make analyze/discuss producers, plan a compiler, coverage a challenger, and
  activation the only Contract commit path.
- **Key open questions**: exact interfaces remain blocked on F-084 and the
  accepted v1 recorder/candidate/coverage implementation sequence.
- **Next step**: keep this plan draft until F-084 is accepted; then bind its
  exact design digest before implementation planning.

## Purpose

F-085 turns the accepted F-084 formation model into shared runtime behavior. It
must strengthen analyze/discuss as epistemic producers without restoring the
pre-v1 failure in which Skill prose, review verdicts, or workflow state could
declare completion.

## Current implementation mismatch

The current Skills predate the v1 proof kernel:

- analyze primarily creates a feature directory and analysis prose;
- discuss persists a rich council/Team process but has no closed handoff into a
  Contract candidate;
- plan can synthesize AC directly and currently treats plan review/status as its
  own lifecycle;
- plan-review checks a plan rather than an exact formation/candidate identity;
- work/review/dashboard/next still contain legacy completion and state-inference
  behavior that the broader v1 implementation will replace.

F-085 must not patch these independently with multiple ad hoc formats. The
accepted F-084 object and shared producer/validator should be the single seam.

## Anticipated implementation areas

Exact paths remain subject to F-084, but the implementation is expected to
touch:

- one versioned formation schema and deterministic renderer/view;
- formation producer/validator and canonicalization helpers;
- `/ae:analyze`, `/ae:discuss`, `/ae:consensus`, `/ae:plan`, and
  `/ae:plan-review`;
- candidate generation, coverage input construction, approval delivery,
  activation, status diagnostics, and amendment;
- host telemetry for optional research/Team execution, kept outside canonical
  proof authority;
- regression, mutation, adversarial, live-host, and dogfood fixtures;
- old prose handoff and completion-inference disposition.

## Integration constraints

1. F-083 remains immutable history and must emit the exact feasible
   `implementation_next_allowed:P0.1` continuation; an accepted stop/block result
   leaves implementation blocked.
2. F-084 must be accepted before implementation request issuance.
3. One repository mutation owner and bounded work packages remain mandatory.
4. Formation writers cannot write canonical proof/lifecycle events.
5. Coverage and activation use dedicated recorder/commit authority; a Skill
   cannot gain authority by emitting schema-shaped JSON.
6. Simple tasks retain a short path; explicit analyze/discuss is selected by
   task geometry, not globally required.
7. Existing legacy feature readers remain governed by the v1 rollout/migration
   plan; formation support cannot silently reinterpret legacy prose as a v1
   formation basis.

## Suggested integration steps

| Step | Result |
|---|---|
| WP-FORM-1 | Schema/identity joins P0.2 after accepted P0.1 |
| WP-FORM-2 | Analyze/discuss/consensus formation producers before P3 Skill cutover |
| WP-FORM-3 | Plan compiler, plan-review boundary, and semantic delta join P1.2/P1.4/P1.5 before each package exit |
| WP-FORM-4 | Coverage and safe-view approval join P1 and P2 generalization |
| WP-FORM-5 | Activation, staleness, amendment, Evidence ACL, and status join each affected P1/P2 package before its exit |
| WP-FORM-6 | Pre-cutover qualification before affected P3 exits, then post-P3-finalizer shadow qualification before rollout |
| WP-FORM-7 | Post-enforce P6 AE-on-AE dogfood, complete release qualification, and fresh acceptance before final release |

Each package should use the same Codex-plan → Claude-Code-work → fresh
Codex-review separation established for F-083, with no custom per-attempt
evidence generator after the shared v1 producer is available.

### Verification considerations

| Dimension | Verification approach |
|---|---|
| Shared representation | Closed-schema, canonicalization, duplicate/shadow-format, and deterministic-render tests |
| Analyze/discuss fidelity | Controlled source/decision cases independently re-derived by a fresh reviewer |
| Plan compilation | CF-01–CF-06 semantic mutation matrix and exact trace/delta comparison |
| Authority boundary | Producer ACL and endpoint forgery matrix across proof, coverage, activation, and finalize |
| Adaptive UX | Paired inline-simple and explicit-complex end-to-end controls with cost/ceremony observations |
| Staleness/recovery | Source drift, replay, crash, retry, amendment, pointer, and approval-reuse tests |
| Non-regression | Existing completion false-pass, Gate replay, finalizer, Skill, and live-host suites |
