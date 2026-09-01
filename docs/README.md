# docs/

> The shape of this directory is the claim: what is at the top level is
> current, and everything historical lives under [`history/`](history/README.md).
> **A document claiming currency that this index contradicts is wrong, not
> this index.**

## Start here

| Document | What it is |
|---|---|
| [`rebuild.md`](rebuild.md) | **Why AE was rebuilt, what the minimum is, and what comes next.** The evidence behind the delete, the state of the tree today, the known gaps, and the ordered roadmap. |

## Current

| Document | What it is |
|---|---|
| [`quickstart.md`](quickstart.md) | Getting started with the shipped plugin. |
| [`workflow-graph.html`](workflow-graph.html) | The stage graph as designed — five stage skills, two human gates, the return edges, and what each stage may refuse. Open it in a browser. |
| [`discuss-graph.html`](discuss-graph.html) | The discuss stage drawn on its own: three rounds, the seats, and where the loop ends. |
| [`agent-authoring.md`](agent-authoring.md) | Writing your own agent for a stage to spawn. |
| [`references/hooks.md`](references/hooks.md) | Hooks: measured enforcement, official semantics, Codex convergence, AE's minimal set. |
| [`references/cc-plugin-contract.md`](references/cc-plugin-contract.md) | Host dependencies and mitigations. |
| [`references/claude-code-plugin-api.md`](references/claude-code-plugin-api.md) | Host API facts. |
| [`references/cross-family-rationale.md`](references/cross-family-rationale.md) | Why cross-family review exists; the capability is kept. |
| [`references/model-effort-matrix.md`](references/model-effort-matrix.md) | Which model and effort each skill and agent declares. |
| [`references/prompt-patterns.md`](references/prompt-patterns.md) | The prompt structure the surviving agents are written in, and which parts of it were measured dead. |

## Removed with what they documented

The delete took the coordination protocol, the telemetry layer, the knowledge
graph and the old harness vocabulary, and their documents went with them —
`agent-teams-policy.md`, `architecture-graph.md`, `references/trace-schema.md`,
`references/verify-by-kinds.md`, `references/pre-merge-integration-review.md`.
`x-experiment.md` went the same way once [`rebuild.md`](rebuild.md) carried its
measurements. They are in the branch history; nothing in the current tree refers
to them.

## History

[`history/`](history/README.md) — the eras in reading order: the frozen 1.0
specification, the archived v1 design set (tag `v1-kernel-archive`), the
pre-delete product requirements, the experiment's instrument, and the
spec-formation record.

One historical item stays outside `history/` because a suite test pins its path:
[`prd/archive/`](prd/archive/). The frozen 1.0 specification used to be the
second such exception, under `references/finalized/`; the pin turned out not to
exist — the frozen corpus cites those files by content hash and by bare name,
never by a path under `docs/` — so it now lives at
[`history/finalized/`](history/finalized/README.md) with the rest of the
history.
