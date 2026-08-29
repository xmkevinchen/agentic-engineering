# docs/

> The shape of this directory is the claim: what is at the top level is
> current; what documents a thing that dies with the big delete says so; and
> everything historical lives under [`history/`](history/README.md).
> **A document claiming currency that this index contradicts is wrong, not
> this index.**

## Current

| Document | What it is |
|---|---|
| [`x-experiment.md`](x-experiment.md) | Why deletion precedes the rewrite — the four benchmark runs and their limits. |
| [`x-workflow.md`](x-workflow.md) | The exact 182-line instrument those runs executed; seed of the unified entry. |
| [`prd/ae-v1.md`](prd/ae-v1.md) | Users, jobs, quality counters; carries a status amendment for G-02 and the fence. |
| [`references/hooks.md`](references/hooks.md) | Hooks: measured enforcement, official semantics, Codex convergence, AE's minimal set. |
| [`references/cc-plugin-contract.md`](references/cc-plugin-contract.md) | Host dependencies and mitigations. |
| [`references/claude-code-plugin-api.md`](references/claude-code-plugin-api.md) | Host API facts. |
| [`references/cross-family-rationale.md`](references/cross-family-rationale.md) | Why cross-family review exists; the capability is kept. |
| [`references/model-effort-matrix.md`](references/model-effort-matrix.md) | Model and effort guidance. |
| [`agent-authoring.md`](agent-authoring.md) | Authoring roles; roles survive the delete. |
| [`quickstart.md`](quickstart.md) | The shipped plugin's quickstart; rewritten when the unified entry lands. |

## Generated

| Document | Producer |
|---|---|
| [`architecture-graph.md`](architecture-graph.md) | `graph-render-docs.py` (knowledge tooling; leaves with that plugin when factored out). |

## Dies with what it documents (still live; historical at the delete)

| Document | Tied to |
|---|---|
| [`agent-teams-policy.md`](agent-teams-policy.md) | The coordination protocol. |
| [`references/trace-schema.md`](references/trace-schema.md) | The telemetry layer (consumers never arrived). |
| [`references/verify-by-kinds.md`](references/verify-by-kinds.md) | The old harness vocabulary. |
| [`references/pre-merge-integration-review.md`](references/pre-merge-integration-review.md) | The old review process. |
| [`references/prompt-patterns.md`](references/prompt-patterns.md) | Re-judged when the kept agents are slimmed. |

## History

[`history/`](history/README.md) — the eras in reading order, including the
archived v1 design set (tag `v1-kernel-archive`), the spec-formation record,
and earlier artifacts. Two historical items stay outside `history/` because
mechanical references pin their paths: [`references/finalized/`](references/finalized/README.md)
(a frozen spike schema) and [`prd/archive/`](prd/archive/) (a suite test).
