---
name: discuss
description: "Settle one contested design decision into a record /ae:plan can consume — the options, the choice, the reason, and what would reopen it. Recommended: Sonnet or above"
argument-hint: "<the contested question, or a discussion directory path>"
model: opus
effort: high
user-invocable: true
---

# /ae:discuss — settle one contested decision

Settle one decision where two defensible options lead to materially different work, so the
plan does not have to guess which one was meant. Nothing contested → skip the stage; a
discussion held as ceremony costs a cycle and decides nothing.

**Input:** the analysis, and one id from its `discuss:` list. You settle the question under that heading, not a neighbouring one you find more interesting.

**Deliverable:** one decision record, a file in `<feature-dir>/`. If this conversation were
lost, the next stage must be able to proceed from that file alone.

## What must be true of the record

- It states the question that was contested, in the terms it was actually posed — not a
  tidier restatement written once the answer was known.
- It states every option that was live and the work each one implies, so a reader can see
  why the question was contested at all.
- It states which option was chosen.
- Its reason is evidence a reader can open: a file and line, a command's output, a quoted
  opinion. "It seems better" is not a reason.
- It shows the losing option argued, not merely listed — what was said against the choice,
  and why that did not win. An objection that vanishes between the argument and the record
  is a process failure.
- It names what would reopen the decision: an observation someone could make, at the far end
  where a wrong choice would actually show. Two documents agreeing with each other establish
  nothing, and restating the decision in the negative names no observation. Where no such
  observation exists, say so plainly — it is a settled preference, and no acceptance
  criterion follows from it.
- It leaves nothing open. Every question the discussion raised is decided here, or stated as
  an assumption together with what would retract it.

## Who argues, and what they are sent

Both options are argued by parties that do not share a prior. One model asked to argue both
sides writes both from the same preference, and the one it already favoured wins on prose
rather than on evidence — the failure this stage exists to prevent. Where another model family
is reachable it is that party: `ae:workflow:codex-proxy`, `ae:workflow:gemini-proxy` and
`ae:workflow:openai-compat-proxy` each hold a seat, and each reports plainly when its backend
is not there. Where none is, a fresh-context agent stands in. Where it was neither, the record
says so — a decision made by one party is still a decision, it is one whose blind spot is
unrecorded.

**What goes out is the analysis's own words**: the section under the `discuss:` id as it
stands, and as material what the analysis cites. This is the rule already governing the record,
pointed outward — a question restated by someone who knows the answer carries the answer.
Needing to send material the analysis does not cite is not a packaging problem; the analysis
is incomplete, and that goes back to ANALYZE.

**They answer before they see your answer, and the second exchange is the one that pays.** The
first carries the question and nothing else, and returns options and leads. The second shows
the option you chose and the reason you chose it and asks what is wrong with it — that is where
a premise you never thought to check gets refuted, and it is not optional. Reversed, you get a
reflection of your own draft back. Seats never see each other: parties answering the same
question blind are not a debate, and a debate is what is being avoided, because it needs
something to converge on and a record written by one decider has nothing.

**Each exchange records which backend and which model answered it.** A seat can degrade
silently — falling back a model tier on a quota or retirement error — and an answer's weight
depends on what produced it. Where two exchanges ran on different models, say so rather than
reading the difference between them as the questions having improved.

**What you ask for is an option or an objection nobody here has named**, never a vote:
agreement from another family raises nothing, two families share blind spots, and a majority
is not a reason. What comes back is argued in the record like anything else, and what nobody
produced is not invented to fill the slot. **The record names who produced what**, one clause
per option and per objection. That attribution is what makes this stage falsifiable: across
enough features it can be read off whether an outside party ever changed a decision, and if
the answer is never, this section should go.

The decision itself is yours, including one that changes what a criterion means: the criteria
are not signed yet, and settling this question is why they were not. Edit `acceptance.md` in
place and name the id you moved. Do not carry its old wording into the record — the reason
belongs there, the superseded text belongs nowhere.

If the question can be decided from evidence after all, it was never contested and should not
have been on the list. Settle it and say so, so the misrouting is visible later.

## What the next stage may refuse it for

- A question the discussion opened is still open — there is nothing to plan against.
- The reason cites nothing a reader can open.
- The record exists only in the conversation.
- It changed what a criterion means without changing `acceptance.md` to match.
- One party argued both sides, and the record does not say why no other was reachable.
