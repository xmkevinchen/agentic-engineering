# Authoring an opt-in task DAG (F-054 Phase-1)

A plan can opt into DAG execution so a long task advances autonomously on dependency
order instead of top-to-bottom. This is the harness layer-1 — the LLM authors the task
structure, a deterministic skeleton drives advancement (curbs unpredictability), and each
node's harness re-derives its verdict from disk (curbs hallucination). Opt-in: a plan
without `dag: true` runs as a normal linear plan, unchanged.

## Schema

Add `dag: true` to the plan frontmatter, then give each `### Step N` (= a node):

```
### Step 3: build the thing
id: N3
depends: [N1, N2]          # multi-predecessor; omit / [] for a root node
Expected files: src/thing.ts
node_check: file-contains target=src/thing.ts pattern=export
human-gate: false
```

- `id:` — stable node id (referenced by other nodes' `depends:`).
- `depends:` — the node runs only when ALL listed ids are `pass`. Absent ⇒ root.
- `Expected files:` + `verify_by`/`node_check:` — the node's deliverable + harness (reused
  unchanged from F-050/F-051; `check-node.sh` gates the node on them).
- `backend:` (optional) — `subagent` or `agent_teams` ONLY; never `workflow` (workflow is
  the orchestrator level, not a node backend).

`check-dag.sh <plan> validate` checks the graph is acyclic, has no dangling `depends:`, and
that every auto-node has a harness. `/ae:plan-review` runs it as the DAG harness-readiness
gate.

## Execution model

`/ae:work` drives a `dag: true` plan by the **ready-set frontier** instead of document
order:

1. `check-dag.sh <plan> ready <notes>` returns the ids whose `depends:` are all `pass`, or
   a terminal signal: `__DONE__` (every node passed) / `__BLOCKED__` (exit 3 — a node is
   `gate`-escalated and blocks the frontier).
2. Pick a ready node (Phase-1: serial — one at a time).
3. **Commit-before-execute**: write `NODE_STATE <id>: in_progress` to the milestone
   `notes.md` BEFORE the work — so a crash/context-loss resumes from the ledger (an
   interrupted node is re-picked) and never ghost-executes a completed node.
4. Do the work, then advance the node (see provenance below).
5. Recompute the ready-set; repeat until `__DONE__`.

Node states: `pass` (done) · `fail` (re-runnable — retried, bounded by the per-node
iter/cap which yields `gate`) · `in_progress` (re-picked on resume) · `gate`
(cap-exhausted / human-judged — blocks the frontier, needs a human).

## Provenance — the ledger is not evidence

The `NODE_STATE` ledger is the orchestrator's **scheduling/resume state ONLY**. It is never
the source of a node's verdict:

- `check-node.sh` NEVER reads `NODE_STATE` — a node's verdict is ALWAYS re-derived from disk
  (files present, git, `node_check`, `test.command`). A stale `pass`/`in_progress` line can
  never fake a real verdict (preserves the F-050 anti-hallucination guarantee).
- `advance-node.sh` is the ONLY sanctioned writer of `NODE_STATE <id>: pass`. It runs
  `check-node.sh` and writes the verdict from its exit code alone — the work loop / LLM
  cannot hand-write a `pass`. Provenance is the check-node exit code, not the caller's word.

This is the F-049 anti-theater discipline applied at the DAG layer: autonomy is only safe
because a node cannot advance the frontier by claiming success — it must actually pass its
disk-re-derived harness.

## Phasing + honest bounds

Phase-1 (shipped) is deliberately the minimum that delivers dependency-driven autonomy:
flat `id` + `depends`, per-node harness, `check-dag.sh` + `advance-node.sh`, `NODE_STATE`
ledger, **ready-set SERIAL drive**. Later phases, each gated on a real long-task run of the
prior one:

- **Phase-2** — concurrent ready-set spawn + atomic per-node workspace + deliverable-overlap
  safety (two ready nodes writing the same file must NOT co-run).
- **Phase-3** — `may_expand` dynamic growth: a node expands at work time via a plan.md patch
  that passes a mini plan-review (every child has a deliverable + harness). Harness-gated
  growth, never ungated.
- **Phase-4** — derived `backend:` scoring (subagent vs agent_teams).

Honest bounds (do not overclaim): (1) the opt-in DAG reverses F-050's "plan IS the
proto-DAG" on a goal-driven (long-task autonomy) basis, not a failure case; (2) Phase-1 is
SERIAL — parallel speedup is Phase-2 and modest under a serial orchestrator (the win is
autonomous advancement, not raw speed); (3) the DAG is fixed at plan time until Phase-3;
(4) the DAG raises the floor + makes drift visible but does NOT guarantee semantic
correctness — semantic-depth Potemkin remains uncloseable.

## DAG toolchain

The scripts under `plugins/ae/scripts/` that implement this (all deterministic `sh`/`awk`;
each registered in [cc-plugin-contract.md](cc-plugin-contract.md) → Harness toolchain):

- `check-dag.sh <plan> validate` — graph well-formedness (acyclic, no dangling `depends:`,
  every auto-node has a harness, no node `backend: workflow`). Run by `/ae:plan-review`.
- `check-dag.sh <plan> ready <ledger>` — the ready-set / terminal signal.
- `dag-next.sh <plan> <ledger>` — the thin driver: one call → `LEGACY`/`DONE`/`BLOCKED`/
  `NEXT <id> <step#>` + commit-before-execute. This is what `/ae:work` loops on.
- `advance-node.sh <plan> <step#> <id> <ledger>` — the ONLY writer of `NODE_STATE pass`;
  runs `check-node.sh` (disk-re-derived verdict) and records it from the exit code alone.

End-to-end behavior is exercised by `tests/scripts/test-dag-e2e.sh` (builds a real
`dag: true` plan and drives it through `dag-next` → `advance-node` to `DONE`).
