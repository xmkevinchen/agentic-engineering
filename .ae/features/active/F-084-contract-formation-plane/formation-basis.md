---
id: F-084
title: "Bootstrap formation basis: why Contract Formation belongs in v1"
type: formation-basis
created: 2026-08-23
authority: bootstrap_non_authoritative
source_assurance: bootstrap_self_reported_unverified
---

# Bootstrap formation basis

This file dogfoods the distinction F-084 is intended to formalize. It records a
bootstrap selection of user-originated problem and scope statements that led to
the draft Contract, but it is not a frozen Contract, proof, approval event,
canonical Ledger record, or `workflow_attested` host event. This draft does not
bind foreground turn IDs, request/response bytes, host operation identity,
principal/session correlation, or a canonical recorder event; its source
assurance is therefore explicitly self-reported and unverified. Exact AC
confirmation must create a new digest-bound decision record through the
accepted approval path rather than upgrading this file in place.

## Bootstrap-selected user inputs

The quoted strings below are a planner-selected transcription without canonical
turn refs or per-turn digests. They are useful drafting context, not a claim of
complete or exact conversation preservation.

| ID | State | User statement | Formation meaning |
|---|---|---|---|
| U-001 | observed | “v1之前的重点在ae:analyze ae:discuss反而被彻底弱化了” | Analyze/discuss lost product weight, not merely completion authority. |
| U-002 | observed | “Contract跟Evidence要通过什么来，不可能是ae:plan” | Plan cannot be the sole epistemic producer of Contract semantics; Evidence also needs named producers. |
| U-003 | accepted direction | “所以，这个东西需要在v1中加强做对” | Contract Formation is v1 scope, not v1+ deferral. |
| U-004 | accepted direction | “那就需要更新v1现在的工作或者在F083之后加F084/F085” | Preserve the current F-083 boundary and add explicit design/implementation work after it. |
| U-005 | creation authorization | “那就加吧” | Authorizes creation of draft F-084/F-085 artifacts; it does not approve their exact AC bytes or authorize implementation. |

## Derived draft decisions

| ID | Status | Derivation | Candidate decision |
|---|---|---|---|
| D-084-01 | draft | U-001, U-002, U-003 | Add an explicit Contract Formation Phase before the existing Proof Execution Phase, orthogonal to the Truth/Coordination authority planes. |
| D-084-02 | draft | U-002 | Treat plan as compiler/diff presenter/activation controller rather than sole Contract author. |
| D-084-03 | draft | U-001, U-003 | Make analyze/discuss first-class formation producers without proof, approval, or completion authority. |
| D-084-04 | draft | U-004, F-083 frozen scope | Keep F-083 immutable; start F-084 after it, and authorize F-085 only from F-083's feasible P0.1 continuation while its packages join the named mainline milestones. |
| D-084-05 | draft | Existing v1 minimal-topology principle | Require formation properties but allow simple tasks to satisfy them inline rather than through mandatory command ceremony. |

## Material questions still open

- What is the smallest closed formation representation that detects silent
  omission and invention without creating a second truth system?
- Who proposes and who adjudicates materiality before human approval?
- Which task-geometry signals require explicit observation or deliberation, and
  which may remain inline?
- Which pre-Contract observations may be explicitly admitted later, versus
  requiring post-activation recapture as completion Evidence?
- Which finalized schema, candidate identity, coverage finding, safe-view,
  activation, and rollout fields must change?

These questions remain visible inputs to F-084. The draft plan may propose
answers; only exact human-confirmed ACs and the later specification approval can
make those answers binding.
