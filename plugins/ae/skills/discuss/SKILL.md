---
name: discuss
description: "Settle one contested design decision into a record /ae:plan can consume — the options, the choice, the reason, and what would reopen it. Recommended: Sonnet or above"
argument-hint: "<feature-dir> and one id from its discuss: list, or a discuss-<id>/ directory to resume>"
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

The same-family seat is `ae:workflow:discuss-seat`, and it is a definition rather than
whichever agent was nearest to hand — what it can do is settled before the round instead of
when the round is spawned. A fresh-context agent of your own family clears the floor and fails
the prior, which makes it a real participant carrying a named weakness rather than a last
resort. **Seat it alongside the others, not behind them.** Its capability is the one you can
count on; the closing round asks only that a reader argued none of the composite, which it
satisfies as well as anyone; and on the evidence so far the sharpest objection any exchange has
produced came from a same-family seat. What the record owes is the weakness itself — say that
it shared the prior. Where there was no outside party at all, say that instead: a decision made
by one party is still a decision, it is one whose blind spot is unrecorded.

**What goes out is the analysis's own words**: the section under the `discuss:` id as it
stands, and as material what the analysis cites. This is the rule already governing the record,
pointed outward — a question restated by someone who knows the answer carries the answer.
Needing to send material the analysis does not cite is not a packaging problem; the analysis
is incomplete, and that goes back to ANALYZE — **writing `<feature-dir>/returned-<id>.md` on the
way out, as the close-out's own return does.** This is the other route back, and a return that
leaves no tag is invisible to whatever reads the directory next. The tag says which of the two
happened: a premise that does not hold, or material the analysis needed to cite and did not. They
are different events and ANALYZE does different things about them, so the file names which one
rather than leaving it to be inferred from a filename that covers both.

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
       3 CLOSE OUT ──────────────┘  four angles kept apart; anything
             │                      that is not the question's own
             │                      premise re-enters at round one
             │
             │ ╌╌╌► the question's own premise is wrong, or the analysis
             │      cited too little — returned-<id>.md, back to ANALYZE
             ▼
      decision-<id>.md — a pass changes nothing, or two passes are done
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
name and cannot address one that has none, so spawn every seat **unnamed**. Independence in
exchange one then holds because of how the agents are wired, not because a prompt asked for it.
Carrying it yourself also costs less than an open channel between them: two seats each waiting
on the other is a coordination stall, and any live edge between seats is only as long-lived as
the shortest backend session behind it — which can be dead before it is used, and silently.

**Every seat writes its own file, and you never write it for them.**

```
<feature-dir>/discuss-<id>/
  pass-1/
    question.md            what this pass was asked
    round-1/<seat>.md
    round-2/<seat>.md      + round-2/composite.md
    round-3/<angle>.md
  pass-2/
    ...
```

`<seat>` is the family the seat answers for — `openai.md`, `google.md`, `anthropic.md`, and a
seat fronting some other backend named for its family the same way — and `<angle>` is the angle
it took: `adversarial.md`, `regret.md`, `strategic.md`, `scope-reducer.md`, held by
`ae:workflow:doodlestein-adversarial`, `-regret`, `-strategic` and `-scope-reducer`. Fixed
names, because a resuming run has to tell a seat that did not answer from a seat whose file it
cannot find, and neither can be read off a directory whose naming was invented per run.

**The family, never the product** — and this is a correctness rule, not a taste one. A seat file
named `claude.md` **is** `CLAUDE.md` on a case-insensitive filesystem, which is what the host
reads as instructions for every agent whose work reaches that directory. Measured: both spellings
returned one inode. The effect is that a seat's answer arrives in the next agent's context as a
directive it cannot decline — so round one stops being blind, silently, and the stage goes on
reporting several parties while counting one twice. Nothing in the artifacts shows it; the file is
a well-formed seat answer under the name the layout asked for. Avoid any name a host loads on
sight, `AGENTS.md` included.

**Every pass, including the first, writes under `pass-N/`.** There is never a bare `round-N/`
directly under `discuss-<id>/`: a round that does not say which pass it belonged to leaves a
directory that cannot be counted, and the loop's bound is counted from exactly here.

**Handed a bare `round-N/`, move it under `pass-1/` before you add to it, and say in the record
that you did.** Four fresh sessions were given one; two restructured and two left it, each with a
defensible reason, which is how you can tell the rule had not been written down. Leaving it is the
worse half: the run then produces a pass nothing can count, and it is the count that ends a loop
no human is watching. The files move; their contents do not, and a digest already taken still
matches because it is taken over the file, not its path.

You give a seat two things: **the path it writes**, and **the paths it reads**. It writes its own
file. You do not author it and you do not paraphrase it into a summary that then travels in its
place — a summary standing in for the thing summarised is how a round's evidence quietly becomes
your account of that evidence, and every later round then argues with your account.

**So relaying is a matter of paths, not of content.** Round two hands each seat the paths of the
others' round-one files, unattributed; a seat with local file access reads them itself, and a
seat fronting a backend without local access reads them and inlines them in the call it makes.
This is what keeps a prompt short enough to stay on the question: a round that has to carry three
full answers inside its own text invites answers sized to match.

**Nothing is resumed across rounds.** Each round spawns fresh and the files are what carry
forward — not a seat's own history. This is the disk hand-off rule the workflow already runs on,
applied one level down, and it retires the same lifetime problem a second time: no backend
session has to survive the gap between rounds, a round that fails is re-run rather than
recovered, and an interrupted run resumes from the directory rather than from this conversation.

**Both of round two's deliverables go in `round-2/composite.md`** — the surviving answer, and
what could not be settled under its own heading, kept separate there rather than merged into it.

**The composite is a file too, at `round-2/composite.md`.** It is the round's deliverable and the
thing round three attacks, so it is the one artifact a later round is guaranteed to need — and it
is the one most easily left in the conversation, because you wrote it and you can still see it.
Written by you rather than by a seat, which is why it is named here rather than left to the rule
above.

**Each material point is marked `survived`, `dropped`, `unresolved` or `chosen`.** `survived` and
`dropped` characterise what a seat said, so each names the file that said it, and a `dropped` point
states why. `chosen` names a reason someone other than you could check — it is where two answers
both survived and you picked, and nothing in the seat files can settle it. `unresolved` owes
neither: a question nobody raised has no seat file to point at. Unmarked, all four read alike in
your voice, and the one a reader most needs to challenge is the one that looks most like a finding.

**A point is a top-level item; a nested item belongs to the point above it and takes its mark.**
Written out because the wording does not settle it on its own, and a rule that reads two ways is
one two careful readers will split on. Marking each sub-bullet separately buys the reader no
distinction it did not already have and costs it the one it needs — if a sub-point really carries
a different disposition from its parent, it is not a sub-point.

**You read both rounds' seat files, not the corrections alone.** A point raised in round one that no
round-two seat attacked appears nowhere in the round-two files, so a composite assembled from the
corrections cannot even see it. A rebuttal that simply stops appearing is not a judgement the reader
can weigh, it is one they cannot know was made — and the composite is where that goes wrong, because
you wrote it and every point you dropped still feels answered.

**The composite is frozen when round three is spawned, and you write `round-3/FROZEN` holding its
sha256 at that moment.** Round three attacks what it was given; without the digest, a composite
edited afterwards leaves every finding citing a version that no longer exists, and nothing can tell.
That has happened: four close-out files were written against a composite that was edited seventeen
seconds after the last of them landed, and not one of them records which version it read — which is
why the digest is the rule and the citation is not. A correction you owe after the spawn is an **erratum in the record**,
not an edit to the artifact under attack — re-signing is cheap and a silently moved target is not.
`check-composite.py` reports the mismatch.

**A seat that could not answer still leaves a file at its own path**, written by you and saying so
— which backend, which model, what failed. That file is not a seat's answer and says it is not:
what it prevents is a silent gap, where a seat that failed and a seat nobody asked look identical,
and the record then reports a challenge that never happened.

**The same holds for an angle that was never asked.** A completed pass is four angle files, and the
pass count is what ends a loop nobody is watching — so three absences that look like three losses
corrupt the one number the bound reads. Write the file, say the angle was not run and what it
leaves unexamined. Two fresh sessions carrying this stage derived that rule from the seat one and
wrote the files unprompted, which is a good sign about the reasoning and no substitute for saying
it: the next session may derive something else.

**The record stays at `<feature-dir>/decision-<id>.md`, outside that directory.** What sits under
`discuss-<id>/` is how the answer was reached; the record is the answer.

**Three — close it out.** The composite is attacked, and from several angles at once rather
than by one reader working down a list: where it is wrong, which of its decisions is most
likely to be reversed, what single change would improve it most, and which of its mechanisms is
surplus and should be argued out of it. Together those are its gains and its costs, which is
what has to be weighed before it is written down. **The angles stay separate**, because a
reader who has answered the first question is anchored for the rest — the same reason exchange
one runs blind. **At least one angle is also given the seat files, `pass-N/question.md` and the
material the analysis cited, and records `given_seat_file_paths: true` in its own file.** A
close-out reads only what you point it at, so an angle holding the composite alone can weigh what
the composite says and never what it left out — and what it left out is the one failure a reader is
better placed to catch than its author. This is not an extra: where the party that composes also
writes the record, it is the only check on the composite from outside, and an angle that was never
equipped leaves the criterion unexamined rather than met. Both framing errors in this stage's own
history were in the question and the bundle, not the composite, which is why those go too. Whoever does this argued none of it, and that is the whole qualification: by
now the composite is what you are about to write down, so this is the last round in which your
own premises can still be attacked.

**The three are a default path, not a pipeline.** Each round ends by reading what came back and
choosing the next move, rather than advancing on schedule: a correction round that shows the
question was posed wrong sends you back to ANALYZE — the same exit the close-out takes, tag and
all — rather than forward into a close-out over a question that should not have been asked. It
does **not** restart the pass. A pass that never reaches round three never completes, and an
incomplete pass is not counted, so a loop that turned back on itself here would be one the bound
cannot see.

**A close-out finding is not a verdict either.** Sort what it returns by one question — **does it
say the question's own premise is wrong, asserted false rather than merely unconfirmed or at risk
of failing?** Both of those words are load-bearing. A finding against the *answer's* premise is an
attack on what you built, which is what round three is for; only a finding against the *question's*
premise says the thing being asked was not worth asking. And "this may not hold" is not "this does
not hold": a finding that names an unconfirmed precondition and proposes a hedge is improving the
answer, not returning the question.

A premise that does not hold ends the loop here and goes back to ANALYZE; no amount of further
polish repairs a question that was malformed or already settled. **Write
`<feature-dir>/returned-<id>.md` before you leave** — which premise failed, where the findings that
found it are, and what ANALYZE must re-decide. Without it the id is byte-identical to one that
never ran, and whoever resumes cannot tell a question that was argued and sent back from one nobody
has started.

**A pass says in writing what it was asked.** `pass-N/question.md` holds it, written by you: for the first pass
the analysis's section as it stands, and for every pass after it that same section **plus the
surviving findings, verbatim and attributed to nobody**. That is how a changed question still goes
out in the analysis's own words — the change is carried as the finding that made it, not as your
paraphrase of what the question has become. Without this the reasoning that opened a pass lives
only in your conversation, which is the one place the next pass cannot read.

**A round is sorted finding by finding, and a return outranks the rest.** When one close-out
produces both — one angle says the question's own premise is wrong, another has an improvement that
would survive — the return wins and the pass ends there. Carry the surviving findings into
`returned-<id>.md` alongside it: they were not answered, and ANALYZE re-posing the question is what
decides whether they still apply. Polishing an answer to a question that is going back is work
thrown away.

**Everything that does not say so re-enters at round one. There is no third class** — a finding
that the remaining disagreement is a preference rather than a fact is not an exit, and neither is
one you cannot place; both re-enter, and the record is where a preference lands, under the rule
that already governs it. A finding
that survives has changed what is being asked, and the changed question earns the same
independent answering the first one got; closing out again over a composite no seat has seen
uncorrelated tests the new version more weakly than the old one was tested.

**Stop when a pass produces nothing the composite does not already hold — and stop at two passes
regardless.** The close-out runs at most twice on one posing of a question. The first stop is a
judgement about what came back and may never fire: nothing makes a pass run out of things to say,
because each rewrite of the composite is fresh surface for the next pass to object to. The second
fires on a count and cannot be argued with, which is the point — this loop re-enters itself with no
human in the path, so the thing that ends it has to be something that does not depend on the loop
agreeing to end.

**Count the completed `pass-N/` directories on disk, not passes you are holding in mind.** A run
that resumes after an interruption has to arrive at the same number, and a pass whose close-out
never finished is not one of them — completed means all four angle files are there. Two is the floor rather than a preference: a finding that
survives earns one newly independent pass, so a bound of one would quietly delete that. Nothing
observed has asked for a third.

**Both ways out owe the same thing — record what the close-out still objected to.** An objection
you overrode belongs in the record, not in the bin, and the bound is what makes that load-bearing
rather than incidental: a record written because the count ran out is precisely the one that leaves
an objection standing.

**Nothing here is settled by counting.** No round converges by majority and agreement raises
nothing — two families share blind spots, and how many said a thing is not a reason. A round is
settled by what is true and by what actually answers the question. The decision stays yours.

**Each exchange records which backend and which model answered it.** A seat can degrade
silently — falling back a model tier on a quota or retirement error — and an answer's weight
depends on what produced it. Where two exchanges ran on different models, say so rather than
reading the difference between them as the questions having improved.

**And which agent held the seat, with the settings its own definition declares** — the agent id,
its model and its grant. This is yours to write because the seat cannot: a spawn on a definition
declaring `model: sonnet` reported no sentence naming a model anywhere in its context, and no
seat can see its own agent type. Where a backend does not expose what answered, the file says
that rather than leaving the slot empty: `model: not exposed` has said what the round ran as, and
a blank has not.

**What comes back is argued in the record like anything else**, and what nobody produced is not
invented to fill the slot. **The record names who produced what**, one clause per option, per
correction, and per close-out finding. That attribution is what makes this stage falsifiable:
across enough features it can be read off whether an outside party ever changed a decision, and
if the answer is never, this section should go.

The decision itself is yours, including one that changes what a criterion means: the criteria
are not signed yet, and settling this question is why they were not. Edit `acceptance.md` in
place and name the criterion id you moved. Do not carry its old wording into the record — the reason
belongs there, the superseded text belongs nowhere.

If the question can be decided from evidence after all, it was never contested and should not
have been on the list. Settle it and say so, so the misrouting is visible later.

## What the next stage may refuse it for

- A question the discussion opened is still open — there is nothing to plan against.
- The reason cites nothing a reader can open.
- The record exists only in the conversation.
- It changed what a criterion means without changing `acceptance.md` to match.
- One party argued both sides, and the record does not say why no other was reachable.
