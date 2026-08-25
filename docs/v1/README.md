# AE v1

> **AE v1 is not released.** Nothing in this directory claims that v1 is
> implemented, accepted, or available. It is the current design and plan for
> building it.

This directory is the single current source for AE v1's design and
implementation plan. It replaces the several per-branch authorities that
preceded it; where each of those went is recorded in
[`branch-disposition.md`](branch-disposition.md).

## What AE v1 is

A workflow product for running non-trivial engineering work through Claude Code,
built so that "done" means something a human actually agreed to. Four
components: **Contract Formation**, a **Workflow Harness** on top of Claude Code
Agent Teams, an optional **agent-proxy** cross-family seat, and a small
deterministic **Kernel** that decides admissibility.

Start with [`design.md`](design.md) §1.

## Current documents

| Document | Question it answers |
|---|---|
| [`design.md`](design.md) | What is AE v1, what does the Kernel guarantee, and what does it explicitly not? |
| [`implementation-plan.md`](implementation-plan.md) | How does it get built, in what order, and what can be run at each step? |
| [`mechanism-disposition.md`](mechanism-disposition.md) | Which older mechanisms are kept, simplified, deferred, or removed — and why? |
| [`branch-disposition.md`](branch-disposition.md) | Where did each source branch's thinking go? |
| [`acceptance.md`](acceptance.md) | What would have to be true to call v1 released? |
| [`history.md`](history.md) | Where is the earlier design material, and how should it be read? |
| [`v1-plus-roadmap.md`](v1-plus-roadmap.md) | What is worth investigating **after** v1? Non-normative; holds no authority. |

`design.md` and `implementation-plan.md` are the current pair. If anything else
in the repository appears to contradict them about what v1 is or how it is
built, they are current and the other document is historical.

## Historical material

| Location | Status |
|---|---|
| [`superseded/`](superseded/) | The pre-acceptance documentation set — the larger v1's design/limitations, usage guide, and acceptance dossier. Retained verbatim; not current guidance. |
| [`../references/finalized/`](../references/finalized/) | The frozen AE 1.0 specification. **Demoted** from sole current specification to normative design input and audit record. |
| [`../ae-v1-design-history/`](../ae-v1-design-history/) | How that specification was formed: three independent proposals and their cross-review. No authority. |
| Branch `docs/ae-v1-implementation-thinking` @ `8d8b1cc` | F-083 bootstrap reasoning. Preserved, deliberately unmerged. |

Full reading order and the reason for each status is in
[`history.md`](history.md).

## Status

| | |
|---|---|
| Slice reached | **V0** — consolidation and product boundary |
| Production behavior changed by V0 | none |
| Next | The user confirms the minimum v1 scope; an independent cross-family review checks this consolidation. Then [V1](implementation-plan.md#v1--minimal-kernel--solo-workflow). |
| Open decisions | [`acceptance.md` §7](acceptance.md#7-open-items-for-the-human) |

The plugin's shipped behavior is described by the repository's
[README](../../README.md) and [CHANGELOG](../../CHANGELOG.md). This directory
describes work that has not shipped, and must not be linked as a quickstart or
presented as current product behavior.
