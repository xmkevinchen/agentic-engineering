# AE in agent-framework vocabulary

> **Why this exists.** Most of what AE does has a name in the general agent-framework
> vocabulary, and the name usually comes with a solved problem attached. Translating in
> that direction saves re-deriving an answer someone already has. Translating back is
> what this document is really for: **three of AE's properties have no equivalent, and
> the places the analogy breaks are where AE's actual difficulty lives.**
>
> Framework concepts here are the stable, widely-shared ones — graph state, reducers,
> checkpointers, conditional edges, human-in-the-loop interrupts. No API surface is
> quoted, because API surfaces move and this document should not have to follow them.

## The mapping

| AE | Framework concept | Note |
|---|---|---|
| The five stage skills | **Nodes** | Each consumes the previous deliverable and produces one of its own |
| `analysis.md`, `acceptance.md`, `plan.md`, `review.md` | **Graph state** | Current values only, edited in place. A deliverable holds what is true now, never how it got there |
| `log.md` | **Trace / checkpoint history** | Append-only. Its subject *is* how it got there, which is why the current-truth rule does not apply to it |
| The feature directory | **The thread** | One run's whole state, addressable by id, resumable in principle |
| review → work, criterion → analyze | **Conditional edges** | Written as prose in the entry skill rather than declared |
| The two human stops | **Interrupt / human-in-the-loop** | See break #3 — AE's are not the same thing |
| A stage's admission checks | **State schema validation** | See break #2 — bought with prose, not typing |
| The cross-family seats | **Ensemble / independent judge** | The independence is the point, not the count ([why](cross-family-rationale.md)) |
| The adversarial close-out readers | **Ensemble with assigned roles** | Four angles kept deliberately apart so none anchors the others |
| `/reload-plugins` | **Deployment boundary** | Node implementations are read at session start; changing a skill mid-session changes nothing until reloaded |

**The translation that has already paid for itself.** Two criteria in an open feature
were hard to state until they were named this way. *"A feature that went round twice
says so on disk"* is asking for a **checkpointer**. *"Work that finds the plan wrong
about the repository leaves the plan no longer saying it"* is asking for a **reducer** —
a declared rule for how a later node's write merges into a value an earlier node owns.
AE has neither, and had no word for the fact that it has neither.

Worth noting that frameworks answer the current-truth question the same way AE does,
independently: state stays clean and holds only current values, and history lives in the
checkpointer beside it — not as versions accumulating inside the state.

## Where the analogy breaks

These three are not gaps in the mapping. They are what AE is.

**1 · There is no runtime, so every mechanism is prose a model must choose to follow.**
A framework *executes* its reducers and checkpointers; correctness is the framework's
problem. In AE the same mechanisms are sentences in a skill file, and whether they run
depends on something a framework never has to think about — **where the sentence sits**.
Measured here: a requirement written 199 lines from the paragraph where the executor
acts was followed **zero** times across two features and twelve produced files; four
rules written *into* the acting paragraph were followed **six of six** across six
independent executions. Same model, same file, different placement. Any framework
concept imported into AE has to survive that, and most of the design work is making it
survive.

**2 · State is prose, and prose has no schema.** A typed graph rejects a malformed state
update before any node sees it. AE has to buy the same property one check at a time, in
the stage that receives the value — and only where someone noticed it was missing. The
failure mode is specific: a stage reached through the entry gets the entry's admission
checks, and the same stage invoked directly gets none, so whether a malformed input is
caught depends on the path it arrived by.

**3 · The human signs the content, and is answerable for it.** An interrupt pauses a
graph and waits for approval to continue. AE's gates are not that. What the person
confirms is the *acceptance criteria* — the standard everything downstream is judged
against — and what they sign at the end is that the work met it. Nothing in the
framework vocabulary carries "somebody is now answerable for this being right", because
frameworks pause execution, not judgement.

A fourth difference is smaller but keeps mattering: **nodes are sessions reading
instructions, not functions.** Two runs of the same node on the same input do not
produce the same output, so AE's equivalent of a test is to run a stage in a fresh
session that did not write it and watch what it does — not to assert the node's text
contains the right sentences.

## What not to do with this document

**Do not import a mechanism because the mapping made it look adjacent.** Every framework
answer listed here assumes a runtime enforces it. The value of the vocabulary is that it
names the problem precisely and tells you what a solved version looks like; the cost of
the analogy is that it makes the solution look closer than it is.
