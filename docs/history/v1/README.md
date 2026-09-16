# AE v1

> **This directory is now a historical record with one living document.**
> The v1 it describes was designed, built to 531 passing assertions, and then
> **archived by its own signed decision record** — proven, unconsumed, and
> reopened only on named observed events. The built artifact is preserved at
> tag `v1-kernel-archive`; the current account of why is
> [`rebuild.md`](../../rebuild.md), and the instrument that replaced this
> design is reproduced verbatim in [`x-workflow.md`](../x-workflow.md).
>
> The former rule — that `design.md` and `implementation-plan.md` override
> anything that contradicts them — is **revoked**. Where this directory
> conflicts with the post-delete workflow, this directory is the history.

## Where the current account lives

Nothing in this directory is current. [`rebuild.md`](../../rebuild.md) carries
what the minimal-workflow experiment established, what replaced this design, and
what remains to be done; [`x-workflow.md`](../x-workflow.md), beside this
directory, is the 182-line instrument those benchmark runs executed.

## The historical set

Every document below carries its own status banner. They are retained as the
record of what was designed, what it cost, and what that taught — the
counter-example the rewrite was measured against — not as guidance.

| Document | What it was |
|---|---|
| [`design.md`](design.md) | The consolidated v1 design: Kernel, Harness, cross-family, formation. |
| [`node-contracts.md`](node-contracts.md) | The loop graph of the archived Kernel, with per-node delivery contracts. |
| [`implementation-plan.md`](implementation-plan.md) | The V1–V5 slice plan; V1 completed, the rest will not be built in this shape. |
| [`acceptance.md`](acceptance.md) | What "released" was going to mean. |
| [`mechanism-disposition.md`](mechanism-disposition.md) | Dispositions of pre-v1 mechanisms — accurate as history. |
| [`branch-disposition.md`](branch-disposition.md) | Where each source branch's thinking went. |
| [`history.md`](history.md) | The reading order of the still-earlier material. |
| [`v1-plus-roadmap.md`](v1-plus-roadmap.md) | Post-1.0 candidates for a 1.0 that will not ship in this shape. |
| [`superseded/`](superseded/) | The pre-acceptance documentation set. |

The plugin's shipped behavior is described by the repository's
[README](../../../README.md) and [CHANGELOG](../../../CHANGELOG.md). The rewrite that
supersedes this directory's plans is tracked on branch `feature/the-big-delete`.
