---
id: F-085
title: "AE 1.0 formation-aware Skills and activation"
status: active
created: 2026-08-23
origin_bl: ""
size: L
theme: ae-v1
depends_on: [F-084]
---

# F-085 — AE 1.0 formation-aware Skills and activation

Implement the human-confirmed F-084 Contract Formation Phase across the Claude
Code-first AE runtime and user-facing Skills.

F-085 is intentionally blocked on F-084 and on F-083 producing the exact
all-valid/all-feasible same-arm continuation checkpoint with
`implementation_next_allowed:P0.1`. An accepted no-go or inconclusive F-083
result does not authorize implementation. Its packages then join the named
P0/P1/P2/P3 kernel milestones; they do not assume recorder, candidate, coverage,
activation, or Gate APIs already exist. The executable pre-cutover phase gates
affected P3 exits, the post-P3-finalizer shadow phase gates rollout, and only the
post-enforce P6 phase plus independent implementation review gates final release.
Later evidence is never made a prerequisite of the cutover that makes it
reachable.

Expected result:

```text
analyze/discuss → digest-bound formation inputs
plan            → trace-preserving Contract compiler
plan-review     → formation + Contract coverage challenger
human           → exact safe-view approval
activation      → exact candidate + formation commit
work/review     → unchanged Evidence production/adjudication boundary
Gate/finalizer  → unchanged completion authority
```

No `goal.frozen.md` exists while this plan is draft.
