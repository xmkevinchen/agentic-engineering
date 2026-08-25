# AE v1 — design history

> **Status:** current index over historical material. Nothing linked from here
> is a current plan. Everything linked from here is preserved.

The consolidated design in [`design.md`](design.md) is much smaller than what
came before it. That is the point — but the reasoning that produced the larger
version is not wrong, and it is not thrown away. This page says where it lives
and how to read it.

## 1. The archived specification

**[`../references/finalized/`](../references/finalized/)** — the AE 1.0
specification as frozen on 2026-08-23.

| Document | What it holds |
|---|---|
| `design.md` | Objects, states, authority boundaries, Claude Code binding (1,476 lines) |
| `acceptance-and-evaluation.md` | The G0–G7 release gates and expected failure behavior |
| `implementation-plan.md` | The P0–P6 dependency order and cutover |
| `philosophy.md` | Design principles and how trade-offs were made |
| `migration-map.md` | Implementation facts as of 2026-08-22 |
| `source-evaluation.md` | Why each source proposal was inherited, corrected, or dropped |

**Its status changed.** It was the sole current v1 specification. It is now a
**normative design input and audit record**: the reasoning behind the invariants
and the authority model, retained in full. Where it and the consolidated design
disagree, the consolidated design is current — because the disagreement is
deliberate and recorded in
[`mechanism-disposition.md`](mechanism-disposition.md).

Its bytes are unchanged. Its README carries a status note pointing here.

## 2. The design-formation archive

**[`../ae-v1-design-history/`](../ae-v1-design-history/)** — how the frozen
specification was produced: independent research from three directions, then
cross-review, then adjudication.

| Directory | Contents |
|---|---|
| `claude/` | Claude/Claude Code original research, live measurements, and proposal |
| `codex/` | Codex original design, implementation plan, and Patterns research |
| `fable-v1/` | An independent blind-written proposal, the merge proposal, and the final cross-review |

None of it carries specification authority, and none of it is edited
retroactively.

## 3. The implementation-thinking branch

**Branch `docs/ae-v1-implementation-thinking` @ `8d8b1cc`** — deliberately not
merged.

It holds F-083's bootstrap reasoning: the frozen goal, the decision register,
material revisions M3 and M4 with their criteria diffs, the E3 execution
amendments, the handoff protocol, and the early implementation plan.

Read it to answer *why the bootstrap phase took the shape it did* — including
why the recursive qualification line of work was eventually stopped. Its plans
and goals are historical. Merging it would create a second authority in the tree,
which is exactly the condition this consolidation removed; the branch and commit
are preserved instead.

## 4. The pre-acceptance documentation set

**[`superseded/`](superseded/)** — three documents drafted from the frozen
specification before implementation was complete:

| Document | What it was for |
|---|---|
| `design-and-limitations.md` | The as-built design and trust boundary, with `RELEASE-BLOCKER` markers where observation was still owed |
| `usage-guide.md` | How a person would use v1 in a Claude Code session |
| `acceptance-dossier.md` | The evidence index that would justify release |

They are superseded as current guidance because they describe the larger v1.
They are retained verbatim — only relative links were repaired when they moved —
because their framing is the clearest statement of the product's intent, and
because §12 of `design-and-limitations.md` is still the best short account of
what AE cannot promise. Both survive in the consolidated design.

## 5. The v1+ roadmap

**[`v1-plus-roadmap.md`](v1-plus-roadmap.md)** — still current, still
non-normative, still holding zero authority.

It is not history: it is the live list of candidate directions (portable
runtime, native Codex frontend, Loom control plane, GitHub/OpenHands adapters,
multi-writer execution) with an admission model that has no ambiguous `planned`
state. Nothing in it is a v1 requirement, gate, or waiver, and nothing in it may
become a v1 blocker.

Its §3.2 — *native teams first; cross-family bridge only for the remaining gap*
— is the reasoning behind [`design.md` §4](design.md#4-the-workflow-harness) and
[§5](design.md#5-agent-proxy).

## 6. The implementation record

**[`../../plugins/ae/docs/references/v1-foundation-freeze.md`](../../plugins/ae/docs/references/v1-foundation-freeze.md)**
— the WP-P0.1 freeze record.

It is neither history nor a second authority: it documents what the executable
corpus under `plugins/ae/tests/foundation/` actually does, including a section
on what it deliberately does *not* establish. That corpus is kept and still
runs. See [`mechanism-disposition.md` §5](mechanism-disposition.md#5-disposition-of-the-p01-corpus).

## 7. Reading order

Someone who needs the whole story, in order:

1. [`design.md`](design.md) — what AE v1 is now
2. [`implementation-plan.md`](implementation-plan.md) — how it gets built
3. [`mechanism-disposition.md`](mechanism-disposition.md) — what was dropped and why
4. [`branch-disposition.md`](branch-disposition.md) — where each branch went
5. [`superseded/design-and-limitations.md`](superseded/design-and-limitations.md) — the larger v1, for contrast
6. [`../references/finalized/design.md`](../references/finalized/design.md) — the full frozen reasoning
7. `docs/ae-v1-implementation-thinking` @ `8d8b1cc` — how the bootstrap phase reasoned

Steps 1–3 are enough to work on AE. Steps 4–7 are for understanding why it looks
like this.
