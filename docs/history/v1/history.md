# AE v1 — design history

> **Status:** current index over historical material. Nothing linked from here
> is a current plan. Everything linked from here is preserved.

The consolidated design in [`design.md`](design.md) is much smaller than what
came before it. That is the point — but the reasoning that produced the larger
version is not wrong, and it is not thrown away. This page says where it lives
and how to read it.

## 1. The archived specification

**[`../finalized/`](../finalized/)** — the AE 1.0
specification as frozen on 2026-08-23.

| Document | What it holds |
|---|---|
| `design.md` | Objects, states, authority boundaries, Claude Code binding (1,476 lines) |
| `acceptance-and-evaluation.md` | The G0–G7 release gates and expected failure behavior |
| `implementation-plan.md` | The P0–P6 dependency order and cutover |
| `philosophy.md` | Design principles and how trade-offs were made |
| `migration-map.md` | Implementation facts as of 2026-08-22 |
| `source-evaluation.md` | Why each source proposal was inherited, corrected, or dropped |

**Its status changed twice.** It was the sole current v1 specification. It was
then demoted to a **design input and audit record**, and where it and the
consolidated design disagreed, the consolidated design superseded it — the
disagreements are recorded in
[`mechanism-disposition.md`](mechanism-disposition.md). **That consolidated
design is itself history now.** Neither is current; both are records.

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

**[`v1-plus-roadmap.md`](v1-plus-roadmap.md)** — history, and non-normative even
when it was written.

It listed candidate directions past a 1.0 that never shipped in that shape
(portable runtime, native Codex frontend, Loom control plane, GitHub/OpenHands
adapters, multi-writer execution). **It is not a live roadmap and nothing on it
is queued.** The current ordered work is
[`rebuild.md`](../../rebuild.md) §4. What is worth keeping from this file is its
admission model — no ambiguous `planned` state — not its contents.

Its §3.2 — *native teams first; cross-family bridge only for the remaining gap*
— is the reasoning behind [`design.md` §4](design.md#4-the-workflow-harness) and
[§5](design.md#5-agent-proxy).

## 6. The implementation record

**[`../../plugins/ae/docs/references/v1-foundation-freeze.md`](../../../plugins/ae/docs/references/v1-foundation-freeze.md)**
— the WP-P0.1 freeze record.

It is neither history nor a second authority: it documents what the executable
corpus under `plugins/ae/tests/foundation/` actually does, including a section
on what it deliberately does *not* establish. That corpus is kept and still
runs. See [`mechanism-disposition.md` §5](mechanism-disposition.md#5-disposition-of-the-p01-corpus).

## 7. What the consolidation review cost, and found

V0's exit required independent cross-family review to return no findings. That
took **fourteen rounds and 39 findings**, none of them spurious. The record is
kept because it is the clearest evidence available for why the design says what
it says.

**The dominant failure was not wrong reasoning — it was uneven propagation.** A
judgement would be corrected in one document and left standing in another that
was equally current. Each document read as self-consistent alone; only together
did they contradict. Roughly a third of all findings were this, and it recurred
after a full-text scan was added to every fix.

**One decision accounted for the middle of the curve.** Round 5 introduced an
exemption: the successful cross-family path could be declared unreachable and
therefore need not be proven. Six rounds then went into finding an evidence
standard for it. Each formulation named a condition that changes without a
release — provider state, an editable selector, an undefined code boundary, a
manifest that closes file membership rather than reachability. The fix was not a
seventh formulation. It was deleting the exemption, which cost V3 becoming a
release prerequisite. That decision was available in round 5 and was made in
round 9.

**Three findings landed on claims that were false about this repository**, not
merely imprecise: that a bridge could be treated as unpublished when it is
already on the mainline; that a selector is release-bound when it is editable
project configuration; that the release manifest can establish reachability when
it carries only role, ref, digest and length. All three were caught by reading
the code rather than the prose.

What this supports, concretely:

| Design claim | Evidence from this review |
|---|---|
| A material claim must not be passed solely by the context that produced it ([`design.md` §3.3](design.md#33-independence)) | Self-review would have shipped 39 defects. The author's own scans caught some and kept missing the cross-document class. |
| Ceremony that does not pay for itself is a product failure (CF-09) | Six rounds were spent on an exemption that should not have existed. Recognising a wrong structure is cheaper than perfecting it. |
| Knowledge learns which findings recur ([`design.md` §6](design.md#6-knowledge-feedback)) | This is the first real dataset, and it names its own top pattern without anyone guessing. |

## 8. Reading order

Someone who needs the whole story, in order:

1. [`design.md`](design.md) — what AE v1 is now
2. [`implementation-plan.md`](implementation-plan.md) — how it gets built
3. [`mechanism-disposition.md`](mechanism-disposition.md) — what was dropped and why
4. [`branch-disposition.md`](branch-disposition.md) — where each branch went
5. [`superseded/design-and-limitations.md`](superseded/design-and-limitations.md) — the larger v1, for contrast
6. [`../finalized/design.md`](../finalized/design.md) — the full frozen reasoning
7. `docs/ae-v1-implementation-thinking` @ `8d8b1cc` — how the bootstrap phase reasoned

Steps 1–3 are enough to work on AE. Steps 4–7 are for understanding why it looks
like this.
