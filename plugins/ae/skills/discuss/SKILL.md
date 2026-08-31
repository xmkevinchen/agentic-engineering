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

**Deliverable:** one decision record at `<feature-dir>/decision-<id>.md`, named for the
`discuss:` id this run settles. The name is the only fixed thing about the file, and it is
fixed because it carries control flow: it is how a later stage tells which question a record
answers, and how a record that was never written becomes visible, since the ids in the analysis
minus the files on disk is the work still outstanding. If this conversation were lost, the next
stage must be able to proceed from that file alone.

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
rather than on evidence — the failure this stage exists to prevent.

Two things make a seat worth having, and neither substitutes for the other: **a different
prior**, which is what the stage is buying, and **enough capability to produce an objection you
can check**, which is the floor beneath it. `ae:workflow:codex-proxy`,
`ae:workflow:gemini-proxy` and `ae:workflow:openai-compat-proxy` each hold a seat on another
family, and each reports plainly when its backend is not there. A backend that answers with the
generic benefits of whatever it was asked about has cost you the reading and left nothing to
argue with; being unlike you does not redeem it. So there is no ranking among seats — take
whoever clears both counts, and more than one where you can, since seats answer blind and two
blind answers tend to bring different things rather than the same thing twice.

A fresh-context agent of your own family clears the floor and fails the prior, which makes it a
real participant carrying a named weakness rather than a last resort. **Seat it alongside the
others, not behind them.** Its capability is the one you can count on; the closing round asks
only that a reader argued none of the composite, which it satisfies as well as anyone; and on
the evidence so far the sharpest objection any exchange has produced came from a same-family
seat. What the record owes is the weakness itself — say that it shared the prior. Where there
was no outside party at all, say that instead: a decision made by one party is still a
decision, it is one whose blind spot is unrecorded.

**What goes out is the analysis's own words**: the section under the `discuss:` id as it
stands, and as material what the analysis cites. This is the rule already governing the record,
pointed outward — a question restated by someone who knows the answer carries the answer.
Needing to send material the analysis does not cite is not a packaging problem; the analysis
is incomplete, and that goes back to ANALYZE.

**Three exchanges, and each asks for something the one before it cannot give.**

```
      analysis.md § <id>
             │
             ▼
       1 INDEPENDENT ◄───────────┐  every seat unnamed; none
             │                   │  can address another
             ▼                   │
       2 CORRECT EACH OTHER      │  you relay each answer to the
             │                   │  others → one composite, and
             ▼                   │  what could not be settled
       3 CLOSE OUT ──────────────┘  four angles kept apart; "the
             │                      answer can be better" means
             │                      the question has changed
             │
             │ ╌╌╌► the premise is wrong — back to ANALYZE
             ▼
      decision-<id>.md — written when a pass changes nothing
```

**One — independent.** Each seat gets the question and the material the analysis cites, and
nothing else: not another seat's answer, and not yours. What comes back is options and leads
that are uncorrelated, which is the only form of "several parties" that is not one party
counted twice.

**Two — correct each other.** Each seat now sees what the others wrote. What you ask for is
neither agreement nor a preference; it is **which of these claims is not true, and which of
them does not answer what was actually asked**. A seat that has committed to its own answer
reads another's better than you do. Two things come back, and both are the deliverable of the
round: **one composite answer**, the most correct thing that survives it, and **what could not
be settled**, kept separate. The second is not a shortfall — it is what enters the record as an
assumption carrying the condition that would retract it.

**You carry the round; the seats never address each other.** A peer can address an agent by
name and cannot address one that has none, so spawn every seat **unnamed** and relay their
answers yourself, unattributed. Independence in exchange one then holds because of how the
agents are wired, not because a prompt asked for it. Relaying also costs less than an open
channel between them: two seats each waiting on the other is a coordination stall, and any live
edge between seats is only as long-lived as the shortest backend session behind it — which can
be dead before it is used, and silently.

**Nothing is resumed across rounds either.** Each round spawns its seats fresh, and what carries
forward is the previous round's written output, injected by you — not a seat's own history. This
is the disk hand-off rule the workflow already runs on, applied one level down, and it retires
the same lifetime problem a second time: no backend session has to survive the gap between
rounds, and a round that fails is simply re-run rather than recovered.

**Three — close it out.** The composite is attacked, and from several angles at once rather
than by one reader working down a list: where it is wrong, which of its decisions is most
likely to be reversed, what single change would improve it most, and which of its mechanisms is
surplus and should be argued out of it. Together those are its gains and its costs, which is
what has to be weighed before it is written down. **The angles stay separate**, because a
reader who has answered the first question is anchored for the rest — the same reason exchange
one runs blind. Whoever does this argued none of it, and that is the whole qualification: by
now the composite is what you are about to write down, so this is the last round in which your
own premises can still be attacked.

**The three are a default path, not a pipeline.** Each round ends by reading what came back and
choosing the next move, rather than advancing on schedule: a correction round that shows the
question was posed wrong sends you back to it, not forward.

**A close-out finding is not a verdict either.** Sort what it returns by one question — **does
it say the premise is wrong, or does it say the answer can be better?** A premise that does not
hold ends the loop here and goes back to ANALYZE; no amount of further polish repairs a question
that was malformed or already settled. **Write `<feature-dir>/returned-<id>.md` before you
leave** — which premise failed, where the findings that found it are, and what ANALYZE must
re-decide. Without it the id is byte-identical to one that never ran, and whoever resumes cannot
tell a question that was argued and sent back from one nobody has started.
**Everything else re-enters at round one.** A finding
that survives has changed what is being asked, and the changed question earns the same
independent answering the first one got; closing out again over a composite no seat has seen
uncorrelated tests the new version more weakly than the old one was tested. Stop when a pass
produces nothing the composite does not already hold, and record what the close-out still
objected to — an objection you overrode belongs in the record, not in the bin.

**Nothing here is settled by counting.** No round converges by majority and agreement raises
nothing — two families share blind spots, and how many said a thing is not a reason. A round is
settled by what is true and by what actually answers the question. The decision stays yours.

**Each exchange records which backend and which model answered it.** A seat can degrade
silently — falling back a model tier on a quota or retirement error — and an answer's weight
depends on what produced it. Where two exchanges ran on different models, say so rather than
reading the difference between them as the questions having improved.

**What comes back is argued in the record like anything else**, and what nobody produced is not
invented to fill the slot. **The record names who produced what**, one clause per option, per
correction, and per close-out finding. That attribution is what makes this stage falsifiable:
across enough features it can be read off whether an outside party ever changed a decision, and
if the answer is never, this section should go.

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
