---
id: F-084
title: "AE 1.0 Contract Formation Phase"
status: active
created: 2026-08-23
origin_bl: ""
size: M
theme: ae-v1
depends_on: [F-083]
---

# F-084 — AE 1.0 Contract Formation Phase

Define the missing upstream half of AE 1.0: how repository facts, human intent,
assumptions, alternatives, trade-offs, and unresolved questions become the exact
Contract candidate that coverage reviews and a human may approve.

This feature does **not** give `/ae:analyze`, `/ae:discuss`, a Team, or any Agent
completion authority. It makes their useful outputs first-class,
digest-bound **formation inputs** while preserving the existing authority chain:

```text
formation inputs → Contract candidate → coverage → human approval → activation
                                                        ↓
                         Evidence → Gate → sole Finalizer
```

## Why this is part of v1

The finalized v1 specification strongly defines which Contract revision is
authoritative and which evidence is admissible, but it does not give the same
operational precision to how the Contract's material semantics are formed.
Without that closure, AE can reliably prove a Contract whose source constraint,
decision, assumption, or unresolved question was silently lost during planning.

F-084 closes that gap in the v1 specification. F-085 implements the accepted
design. Neither may be treated as v1+ work. F-085's generic `pre_rollout`
qualification gates P3.8 rollout publication; its post-enforce P6 evidence and
independent final acceptance gate the later v1 release, not the rollout that
makes that evidence reachable.

## Sequencing

- F-083 remains unchanged and closes only its already-frozen Phase-0 bootstrap
  boundary.
- F-084 starts after F-083 and produces the human-confirmed formation design and
  normative specification amendment.
- F-085 depends on F-084 and on F-083's exact feasible
  `implementation_next_allowed:P0.1` checkpoint; its packages join the named
  P0/P1/P2/P3 milestones rather than pretending the Gate kernel already exists.
- Planning artifacts are currently draft. No `goal.frozen.md` exists until the
  exact Acceptance Criteria are presented and confirmed.
