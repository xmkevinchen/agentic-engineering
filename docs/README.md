# docs/ — what is current, what is history

> Reorganized 2026-08-28 along the deletion-first decision
> ([`v1/x-experiment.md`](v1/x-experiment.md)). Statuses here are the
> authority; physical moves are deferred to the delete itself so links break
> once, not twice. **A document claiming currency that this table calls
> historical is wrong, not this table.**

## Current

| Document | Why it lives |
|---|---|
| [`v1/x-experiment.md`](v1/x-experiment.md) + [`v1/x-workflow.md`](v1/x-workflow.md) | The pivot evidence and its verbatim instrument — the seed of `ae:go`. |
| [`prd/ae-v1.md`](prd/ae-v1.md) | Users, jobs, quality counters stand; G-02 and the fence carry a status amendment. |
| [`references/hooks.md`](references/hooks.md) | The consolidated hooks reference: measured enforcement, official semantics, Codex convergence, AE's minimal hook set. |
| [`references/cc-plugin-contract.md`](references/cc-plugin-contract.md) | Host dependencies + mitigations; hook detail lives in `hooks.md`. |
| [`references/claude-code-plugin-api.md`](references/claude-code-plugin-api.md) | Host API facts. |
| [`references/cross-family-rationale.md`](references/cross-family-rationale.md) | The kept capability's design rationale. |
| [`references/model-effort-matrix.md`](references/model-effort-matrix.md) | Model/effort guidance. |
| [`agent-authoring.md`](agent-authoring.md) | Roles survive the delete (proxies, adversarial close-out); authoring guidance stays. |
| [`quickstart.md`](quickstart.md) | Describes the shipped plugin; rewritten when `ae:go` lands. |

## Dies with what it documents (historical at the delete)

| Document | Tied to |
|---|---|
| [`agent-teams-policy.md`](agent-teams-policy.md) | The coordination protocol being deleted. |
| [`references/trace-schema.md`](references/trace-schema.md) | The telemetry layer (consumers never arrived — script audit). |
| [`references/verify-by-kinds.md`](references/verify-by-kinds.md) | The old harness vocabulary, unless `ae:go` adopts a slimmed form. |
| [`references/pre-merge-integration-review.md`](references/pre-merge-integration-review.md) | The old review process. |
| [`references/prompt-patterns.md`](references/prompt-patterns.md) | Re-judged when the kept agents are slimmed. |

## Historical

| Location | What it is |
|---|---|
| [`v1/`](v1/README.md) | The v1 design record — built, archived at tag `v1-kernel-archive`, superseded by deletion-first. One living document inside: the x experiment. |
| [`ae-v1-design-history/`](ae-v1-design-history/) | Three independent proposals and their cross-review. No authority. |
| [`references/finalized/`](references/finalized/) | The frozen AE 1.0 specification. Demoted earlier; unchanged. |
| [`prd/archive/`](prd/archive/) | Retired feature-level PRD. |
| [`architecture-graph.md`](architecture-graph.md) · [`L-feature-gate.md`](L-feature-gate.md) · [`loom-dogfood-feedback-v0.12.md`](loom-dogfood-feedback-v0.12.md) | Artifacts of earlier eras. |
