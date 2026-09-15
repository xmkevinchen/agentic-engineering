---
name: discuss
description: "Settle one contested design decision into a record /ae:plan can consume — the options, the choice, the reason, and what would reopen it."
argument-hint: "<feature-dir> and one id from its discuss: list, or a discuss-<id>/ directory to resume>"
model: opus
effort: high
user-invocable: true
---

# /ae:discuss — settle one contested decision

Settle one decision where two defensible options lead to materially different work, so the plan
does not have to guess which one was meant.

**Nothing contested → skip the stage.** A discussion held as ceremony costs a cycle and decides
nothing.

## Input

The analysis, and one id from its `discuss:` list. Settle the question under that heading, not a
neighbouring one you find more interesting.

## Check the analysis before discussing it

Before spawning anything, read `analysis.md`. Refuse it — write `<feature-dir>/returned-<id>.md`
and stop, without running round one — on either of two counts:

- it is absent, or its frontmatter cannot be read (not parseable, or not starting at byte 0);
- the id this run was given is not a key in its `discuss:` mapping.

Both are the same reason "What goes out" below already names — `material the analysis needed to
cite and did not` — not a premise that failed once argued. A question this stage cannot even read
off the analysis has nothing to argue yet.

## Deliverable

One decision record at `<feature-dir>/decision-<id>.md`, named for the `discuss:` id this run
settles.

The name carries control flow, which is why it is fixed: it is how a later stage tells which
question a record answers, and the ids in the analysis minus the files on disk are the questions
still outstanding. If this conversation were lost, the next stage must be able to proceed from that
file alone.

## What must be true of the record

- It states the question that was contested, in the terms it was actually posed. Not a tidier
  restatement written once the answer was known.
- It states every option that was live and the work each one implies, so a reader can see why the
  question was contested at all.
- It states which option was chosen.
- Its reason is evidence a reader can open: a file and line, a command's output, a quoted opinion.
  "It seems better" is not a reason.
- It shows the losing option argued, not merely listed: what was said against the choice, and why
  that did not win. An objection that vanishes between the argument and the record is a process
  failure.
- It names what would reopen the decision — an observation someone could make, at the far end
  where a wrong choice would actually show. Two documents agreeing with each other establish
  nothing, anywhere in this record. Restating the decision in the negative names no observation
  either. Where no such observation exists, say so plainly: it is a settled preference, and no
  acceptance criterion follows from it.
- It leaves nothing open. Every question the discussion raised is decided here, or stated as an
  assumption together with what would retract it.
- It names who produced what — one clause per option, per correction, per close-out finding.
  Argue what came back like anything else, and invent nothing to fill a slot nobody answered.

## The shape of a pass

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

**Three exchanges, and each asks for something the one before it cannot give.** All three run.
What is open at the end of a round is which move comes next — carry on, or take the exit back to
ANALYZE — never whether a round happens at all.

## Seats — who argues

Both options are argued by parties that do not share a prior. One model asked to argue both sides
writes both from the same preference, and the one it already favoured wins on prose rather than on
evidence. That is the failure this stage exists to prevent.

**A seat must clear two thresholds, and neither substitutes for the other:**

1. **A different prior** — what the stage is buying.
2. **Enough capability to produce an objection you can check** — the floor beneath it. A backend
   that answers with the generic benefits of whatever it was asked about has cost you the reading
   and left nothing to argue with. Being unlike you does not redeem it.

`ae:workflow:codex-proxy`, `ae:workflow:gemini-proxy` and `ae:workflow:openai-compat-proxy` each
hold a seat on another family, and each reports plainly when its backend is not there.

**Before dispatching any of them, check whether the project actually wants that family.** Run
`python3 <plugin-root>/scripts/read-family-table.py --enabled-only` (`.claude/pipeline.yml`'s
default path, same plugin-root resolution `check-composite.py` already uses below) and dispatch
only a family whose entry appears in that output — an absent table means every family is enabled
by default, but a family explicitly marked `enabled: false` is skipped, not merely logged.
`check-cross-family.sh`'s own `SessionStart` diagnostic is unaffected; this is a second, separate
consumer of the same table.

**There is no ranking among seats.** Take whoever clears both counts, and more than one where you
can: seats answer blind, and two blind answers tend to bring different things rather than the same
thing twice.

**The same-family seat is `ae:workflow:discuss-seat`** — a definition, not whichever agent was
nearest to hand, so what it can do is settled before the round rather than when the round is
spawned. It clears the floor and fails the prior, which makes it a real participant carrying a
named weakness rather than a last resort. **Seat it alongside the others, not behind them.**

What the record owes is that weakness: **say that the seat shared the prior.** Where there was no
outside party at all, say that instead. A decision made by one party is still a decision; it is one
whose blind spot is unrecorded.

## What goes out

**The analysis's own words** — the section under the `discuss:` id as it stands, and as material
what the analysis cites. A question restated by someone who knows the answer carries the answer.

Needing to send material the analysis does not cite is not a packaging problem. The analysis is
incomplete, and that goes back to ANALYZE: **write `<feature-dir>/returned-<id>.md` on the way
out.** Say which of the two happened — a premise that does not hold, or material the analysis
needed to cite and did not. ANALYZE does different things about them, so the file names which
rather than leaving it to be inferred.

**`pass-N/question.md` holds what the pass was asked, written by you.** For the first pass, the
analysis's section as it stands. For every pass after it, that same section **plus the surviving
findings, verbatim and attributed to nobody** — so a changed question still goes out in the
analysis's own words, carrying the finding that changed it rather than your paraphrase of what it
has become. Without this file, the reasoning that opened a pass lives only in your conversation,
which is the one place the next pass cannot read.

## Round one — independent

Each seat gets the question and the material the analysis cites, and nothing else: not another
seat's answer, and not yours. What comes back is options and leads that are uncorrelated, which is
the only form of "several parties" that is not one party counted twice.

**You carry the round; the seats never address each other. Spawn every seat unnamed.** A peer can
address an agent by name and cannot address one that has none, so independence holds because of
how the agents are wired rather than because a prompt asked for it. It also costs less than an open
channel: two seats each waiting on the other is a coordination stall, and any live edge between
seats is only as long-lived as the shortest backend session behind it — which can be dead before it
is used, and silently.

**Nothing is resumed across rounds.** Each round spawns fresh and the files carry forward, not a
seat's own history. No backend session has to survive the gap between rounds, a round that fails is
re-run rather than recovered, and an interrupted run resumes from the directory rather than from
this conversation.

## Round two — correct each other

Each seat now sees what the others wrote. What you ask for is neither agreement nor a preference.
It is **which of these claims is not true, and which of them does not answer what was actually
asked.** A seat that has committed to its own answer reads another's better than you do.

**Give a seat two things: the path it writes, and the paths it reads.** Relaying is a matter of
paths, not of content. Round two hands each seat the paths of the others' round-one files,
unattributed; a seat with local file access reads them itself, and a seat fronting a backend
without local access reads them and inlines them in the call it makes. This is what keeps a prompt
short enough to stay on the question — a round that has to carry three full answers inside its own
text invites answers sized to match.

**Do not paraphrase a seat's answer into a summary that then travels in its place.** A summary
standing in for the thing summarised is how a round's evidence quietly becomes your account of that
evidence, and every later round then argues with your account.

### The composite

Round two has two deliverables and **both go in `round-2/composite.md`**, under separate headings:
**the surviving answer** — the most correct thing the round leaves standing — and **what could not
be settled.** The second is not a shortfall. It is what enters the record as an assumption carrying
the condition that would retract it.

**You write the composite, not a seat.** Every other file in the directory is written by the party
that produced it; this one is the exception, which is why it is named here.

**Read both rounds' seat files, not the corrections alone.** A point raised in round one that no
round-two seat attacked appears nowhere in the round-two files, so a composite assembled from the
corrections cannot even see it. A rebuttal that simply stops appearing is not a judgement the
reader can weigh — it is one they cannot know was made.

**Mark each material point `survived`, `dropped`, `unresolved` or `chosen`.**

- `survived` and `dropped` characterise what a seat said, so each names the file that said it, and
  a `dropped` point states why.
- `chosen` is where two answers both survived and you picked. It names a reason someone other than
  you could check; nothing in the seat files can settle it.
- `unresolved` owes neither — a question nobody raised has no seat file to point at.

Unmarked, all four read alike in your voice, and the one a reader most needs to challenge is the
one that looks most like a finding.

**A point is a top-level item; a nested item belongs to the point above it and takes its mark.** If
a sub-point really carries a different disposition from its parent, it is not a sub-point.

### Freeze it, then check it

**The composite is frozen when round three is spawned. Write `round-3/FROZEN` holding its sha256 at
that moment.** Round three attacks what it was given; without the digest, a composite edited
afterwards leaves every finding citing a version that no longer exists, and nothing can tell. That
has happened — four close-out files written against a composite edited seventeen seconds after the
last of them landed, none recording which version it read. **A correction you owe after the spawn
is an erratum in the record, not an edit to the artifact under attack.**

**Run the check before you spawn round three.** `check-composite.py` ships beside this skill at
`scripts/check-composite.py` under the plugin root — in a checkout of AE itself that is
`plugins/ae/scripts/`, and in an installed copy it is under the installed plugin. Locate it once
and reuse the path:

```sh
python3 <plugin-root>/scripts/check-composite.py <feature-dir>/discuss-<id>/pass-N/round-2/composite.md
```

Exit 0 and spawn. Non-zero and it prints, line by line, what to fix first: a point with no
disposition, a `chosen` or `survived` point citing a file that does not exist, a `FROZEN` digest
that no longer matches what it names, a seat file that never says which agent held it, a bare
`round-N/` with no `pass-N/` wrapper. Fix and re-run — none of that needs asking anyone. **Run it
again after the record is written**, because the composite is what the record rests on and the two
must still agree.

**If you cannot find the script, say so in the record and mark those criteria unchecked.** Do not
substitute your own reading of the composite and call it passed: an author re-reading their own
composite is the one reader who cannot see what it left out.

The check reads four criteria mechanically and says so where it cannot. Whether a seat's claim
reached the composite *with a stated reason* is not something it decides, and a word-presence check
there would report green on a composite that dropped a rebuttal — the one failure that question
exists to catch. **That one stays yours.**

## Round three — close it out

Spawn all four angles below, unnamed, each holding the composite. They attack it at once, rather
than one reader working down a list:

- `adversarial` — where it is wrong.
- `regret` — which of its decisions is most likely to be reversed.
- `strategic` — what single change would improve it most.
- `scope-reducer` — which of its mechanisms is surplus and should be argued out of it.

Together those are its gains and its costs, which is what has to be weighed before it is written
down. They are held by `ae:workflow:doodlestein-adversarial`, `-regret`, `-strategic` and
`-scope-reducer`.

**The angles stay separate.** A reader who has answered the first question is anchored for the
rest — the same reason round one runs blind.

**At least one angle is also given the seat files, `pass-N/question.md` and the material the
analysis cited, and records `given_seat_file_paths: true` in its own file.** A close-out reads only
what you point it at, so an angle holding the composite alone can weigh what the composite says and
never what it left out — and what it left out is the one failure a reader is better placed to catch
than its author. Where the party that composes also writes the record, this is the only check on
the composite from outside; an angle that was never equipped leaves the criterion unexamined rather
than met. Both framing errors in this stage's own history were in the question and the bundle, not
the composite, which is why those go too.

**Whoever does this argued none of it.** That is the whole qualification, and this is the last
round in which your own premises can still be attacked.

## Where a pass ends

**The three rounds are a default path, not a pipeline.** End each round by reading what came back
and choosing the next move, rather than advancing on schedule.

**A close-out finding is not a verdict.** Sort what comes back by one question: **does it say the
question's own premise is wrong, asserted false rather than merely unconfirmed or at risk of
failing?** Both halves are load-bearing.

- A finding against the **answer's** premise is an attack on what you built. That is what round
  three is for, and it re-enters at round one.
- A finding against the **question's** premise says the thing being asked was not worth asking.
  That ends the loop.
- A finding that is real but changes neither the decision recorded nor what PLAN can do with it
  is **non-blocking**: write it into the record as a deferred finding with the condition that
  would reopen it, and do not spawn another round over it. The bar is that exact test — does it
  change the decision, or change what PLAN can do with it — not a fresh judgment call each time;
  a finding that fails either half of the test stays in the two branches above.
- "This may not hold" is not "this does not hold". A finding that names an unconfirmed
  precondition and proposes a hedge is improving the answer, not returning the question.

**A premise that does not hold goes back to ANALYZE.** No amount of further polish repairs a
question that was malformed or already settled. **Write `<feature-dir>/returned-<id>.md` before you
leave** — which premise failed, where the findings that found it are, and what ANALYZE must
re-decide. Without it the id is byte-identical to one that never ran, and whoever resumes cannot
tell a question that was argued and sent back from one nobody has started.

**A return outranks the rest.** When one close-out produces both — one angle says the premise is
wrong, another has an improvement that would survive — the return wins and the pass ends there.
Carry the surviving findings into `returned-<id>.md` alongside it: they were not answered, and
ANALYZE re-posing the question is what decides whether they still apply.

**Everything that is not a return, and not non-blocking by the test above, re-enters at round
one.** A finding that the remaining disagreement is a preference rather than a fact is not an
exit on its own — it re-enters unless it also passes the non-blocking test, and the record is
where a preference lands either way. A finding that survives and is not deferred as non-blocking
has changed what is being asked, and the changed question earns the same independent answering
the first one got. Closing out again over a composite no seat has seen uncorrelated tests the new
version more weakly than the old one was tested.

**A correction round that shows the question was posed wrong takes the same exit, tag and all,
rather than advancing into a close-out over a question that should not have been asked. It does not
restart the pass.** A pass that never reaches round three never completes, and an incomplete pass is
not counted — so a loop that turned back on itself here would be one the bound cannot see.

**Stop when a pass produces nothing the composite does not already hold — and stop at two passes
regardless.** The close-out runs at most twice on one posing of a question. The first stop is a
judgement about what came back and may never fire: nothing makes a pass run out of things to say,
because each rewrite of the composite is fresh surface for the next pass to object to. The second
fires on a count and cannot be argued with, which is the point — this loop re-enters itself with no
human in the path, so what ends it cannot depend on the loop agreeing to end. Two is a floor rather
than a preference: a finding that survives earns one newly independent pass, so a bound of one would
quietly delete that. Nothing observed has asked for a third.

**Count the completed `pass-N/` directories on disk, not passes you are holding in mind.** A run
that resumes after an interruption has to arrive at the same number. Completed means all four angle
files are there; a pass whose close-out never finished is not one of them.

**Both ways out owe the same thing: record what the close-out still objected to.** An objection you
overrode belongs in the record, not in the bin. The bound is what makes this load-bearing rather
than incidental — a record written because the count ran out is precisely the one that leaves an
objection standing.

**Nothing here is settled by counting.** No round converges by majority and agreement raises
nothing: two families share blind spots, and how many said a thing is not a reason. A round is
settled by what is true and by what actually answers the question.

## The files on disk

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

**The record stays at `<feature-dir>/decision-<id>.md`, outside that directory.** What sits under
`discuss-<id>/` is how the answer was reached; the record is the answer.

**Every seat writes its own file, and you never write it for them.** The composite is the one
exception.

**`<seat>` is the family the seat answers for** — `openai.md`, `google.md`, `anthropic.md`, and a
seat fronting some other backend named for its family the same way. **The family, never the
product**, and this is a correctness rule rather than a taste one: a seat file named `claude.md`
**is** `CLAUDE.md` on a case-insensitive filesystem, which is what the host reads as instructions
for every agent whose work reaches that directory. Measured — both spellings returned one inode.
The seat's answer then arrives in the next agent's context as a directive it cannot decline, round
one stops being blind silently, and the stage goes on reporting several parties while counting one
twice. Nothing in the artifacts shows it. **Avoid any name a host loads on sight, `AGENTS.md`
included.**

**`<angle>` is the angle it took**, from the four named under round three. Both name sets are
fixed, because a resuming run has to tell a seat that did not answer from a seat whose file it
cannot find, and neither can be read off a directory whose naming was invented per run.

**Every pass, including the first, writes under `pass-N/`.** There is never a bare `round-N/`
directly under `discuss-<id>/`: a round that does not say which pass it belonged to leaves a
directory that cannot be counted, and the loop's bound is counted from exactly here.

**Handed a bare `round-N/`, move it under `pass-1/` before you add to it, and say in the record
that you did.** Four fresh sessions were given one; two restructured and two left it, each with a
defensible reason, which is how you can tell the rule had not been written down. Leaving it is the
worse half — the run then produces a pass nothing can count, and it is the count that ends a loop
no human is watching. The files move; their contents do not, and a digest already taken still
matches, because it is taken over the file rather than its path.

**A seat that could not answer still leaves a file at its own path, written by you and saying so** —
which backend, which model, what failed, and that the file is not a seat's answer. What this
prevents is a silent gap, where a seat that failed and a seat nobody asked look identical, and the
record then reports a challenge that never happened.

**That rule can itself fail to run — the process holding the round can die before it writes even
that placeholder — and a session resuming the pass then finds the same absence the rule exists to
prevent.** Nothing on disk can tell that session whether the seat was never dispatched this round
or was dispatched and produced nothing before whatever ran it stopped; a fresh, careful session
given only the directory cannot make that call, and should not try. **It does not need to.** An
absent seat file with no note at that path is read the same way regardless of which happened:
the seat has not answered this round, and the resuming session dispatches it (or re-dispatches
it) before treating the round as complete. Re-dispatching a seat that was, in fact, never
reached costs nothing beyond the call; reading its absence as "nothing to add" or "this round is
done" is the failure this exists to prevent. **Never infer completion from an absence.**

**The same holds for an angle that was never asked.** A completed pass is four angle files, and the
pass count is what ends a loop nobody is watching, so three absences that look like three losses
corrupt the one number the bound reads. Write the file, say the angle was not run and what it
leaves unexamined.

## What every exchange records

**Which backend and which model answered it.** A seat can degrade silently, falling back a model
tier on a quota or retirement error, and an answer's weight depends on what produced it. Where two
exchanges ran on different models, say so rather than reading the difference between them as the
questions having improved.

**And which agent held the seat, with the settings its own definition declares** — the agent id,
its model and its grant. This is yours to write because the seat cannot: a spawn on a definition
declaring `model: sonnet` reported no sentence naming a model anywhere in its context, and no seat
can see its own agent type. Where a backend does not expose what answered, the file says
`model: not exposed` rather than leaving the slot empty. A blank has not said what the round ran as.

## The decision is yours

Including one that changes what a criterion means. The criteria are not signed yet, and settling
this question is why they were not. **Edit `acceptance.md` in place and name the criterion id you
moved.** Do not carry its old wording into the record — the reason belongs there, the superseded
text belongs nowhere.

If the question can be decided from evidence after all, it was never contested and should not have
been on the list. Settle it and say so, so the misrouting is visible later.

## What the next stage may refuse it for

- A question the discussion opened is still open — there is nothing to plan against.
- The reason cites nothing a reader can open.
- The record exists only in the conversation.
- It changed what a criterion means without changing `acceptance.md` to match.
- One party argued both sides, and the record does not say why no other was reachable.
