# docs/

> The shape of this directory is the claim: what is at the top level is
> current, and everything historical lives under [`history/`](history/README.md).
> **A document claiming currency that this index contradicts is wrong, not
> this index.**

## Current

| Document | What it is |
|---|---|
| [`workflow-graph.html`](workflow-graph.html) | The stage graph as designed — five stage skills, two human gates, the return edges, and what each stage may refuse. Open it in a browser. |
| [`x-experiment.md`](x-experiment.md) | Why deletion precedes the rewrite — the four benchmark runs and their limits. |
| [`x-workflow.md`](x-workflow.md) | The exact 182-line instrument those runs executed; seed of the unified entry. |
| [`prd/ae-v1.md`](prd/ae-v1.md) | Users, jobs, quality counters; carries a status amendment for G-02 and the fence. |
| [`references/hooks.md`](references/hooks.md) | Hooks: measured enforcement, official semantics, Codex convergence, AE's minimal set. |
| [`references/cc-plugin-contract.md`](references/cc-plugin-contract.md) | Host dependencies and mitigations. |
| [`references/claude-code-plugin-api.md`](references/claude-code-plugin-api.md) | Host API facts. |
| [`references/cross-family-rationale.md`](references/cross-family-rationale.md) | Why cross-family review exists; the capability is kept. |
| [`references/model-effort-matrix.md`](references/model-effort-matrix.md) | Model and effort guidance. |
| [`references/prompt-patterns.md`](references/prompt-patterns.md) | Patterns the kept agents are written against; re-judged when those agents are slimmed. |
| [`agent-authoring.md`](agent-authoring.md) | Authoring roles; roles survive the delete. |
| [`quickstart.md`](quickstart.md) | Getting started with the shipped plugin. |

## Removed with what they documented

The delete took the coordination protocol, the telemetry layer, the knowledge
graph and the old harness vocabulary, and their documents went with them —
`agent-teams-policy.md`, `architecture-graph.md`, `references/trace-schema.md`,
`references/verify-by-kinds.md`, `references/pre-merge-integration-review.md`.
They are in the branch history; nothing in the current tree refers to them.

## History

[`history/`](history/README.md) — the eras in reading order, including the
archived v1 design set (tag `v1-kernel-archive`), the spec-formation record,
and earlier artifacts. Two historical items stay outside `history/` because
mechanical references pin their paths: [`references/finalized/`](references/finalized/README.md)
(a frozen spike schema) and [`prd/archive/`](prd/archive/) (a suite test).
