---
name: review
description: >-
  Judge the delivered work against the criteria the human signed, through a reader
  who did not write it. The signature that completes a feature is the human's, not this verdict.
argument-hint: "<plan file path>"
user-invocable: true
---

# /ae:review — judge the work against the signed criteria

Judge the delivered work against the acceptance criteria the human confirmed. Nothing else.

## Input

`$ARGUMENTS` is the plan path; `<feature-dir>` is its parent directory. If empty, ask which
feature to review.

Judge the feature's whole change: everything committed since the feature started, not just the
last commit. **Where the range starts is the commit `log.md` records, not a guess** — never the
commit author field, and never an inference from a session identifier: an author field is
uninformative the moment two commits share one, and a session identifier names a session, not a
feature, so it can agree with the true range by coincidence and still be the wrong thing to have
read. Read it against the plan, the working log, and the criteria. The criteria are the
ones the human signed, and `acceptance.md` is where you read them from — not the plan's
restatement of them and not the log's.

## Check the log before judging it

This is the first action of whichever session actually runs this stage — inline, or the
`independent-top-level-session` the next section describes. It reads only files on disk, so it
runs correctly wherever the stage itself ends up running, and it runs before any verdict is
reached.

`log.md` is WORK's deliverable, so a defect in it is WORK's to answer for, not something to read
around and judge past. **Fold it into an ordinary `fail` verdict — with the gap itself as the
next numbered item on `review/returns/` — rather than reaching a verdict from evidence that is
not there to read, on any of:**

- `log.md` is absent, empty, or its frontmatter cannot be read (not parseable, or not starting at
  byte 0);
- it carries an `ended:` value that is not one WORK has (`blocked` | `criterion-defective`);
- a criterion signed in `acceptance.md` is never mentioned anywhere in it;
- an item raised on any file under `review/returns/` is never mentioned anywhere in it — the
  items are a declared input of WORK, and a log silent about one of its own inputs has not
  accounted for it.

This is the ordinary `fail` route, not a new one: the item it opens is counted exactly like any
other open item by whatever counts them, and needs no human step.

## Running this stage

This stage benefits from `independent-top-level-session` — see
`docs/references/capability-contract.md` for what that means and how it is declared. If your
context documents a binding for it, run this stage there, handing off the plan path explicitly.
If no binding is documented anywhere in context, run this stage inline exactly as the rest of
this file describes — nothing here is a precondition, and finding no binding is not a reason to
pause or ask.

**When this stage does run as `independent-top-level-session`, its own investigation starts from
the feature's signed `acceptance.md` and the tree's current state — never from a resumed or
forked continuation of WORK's own session or context.** This is additive to *Fresh eyes* below,
not a replacement for it: that section's requirement — that the verdict itself comes from a
reader who did not write the work — holds regardless of whether this stage runs inline or
isolated. What this adds is narrower and comes first: even reaching the point of judging
anything, this stage's own reading of the diff and the log must not begin from WORK's own
accumulated reasoning about what it tried and why.

**The same session-spanning rule `work/SKILL.md` states holds here too:** do not start this
stage's own turn until you hold a confirmed signal — never an elapsed-time guess — that WORK's
own turn has fully finished. `go/SKILL.md`'s existing version of this rule does not reach a
separately-spawned session, for the same reason stated in `work/SKILL.md`.

## Deliverable

`<feature-dir>/review.md`, containing:

- the verdict — `pass`, `fail` or `criterion-unsettled` — readable without reading the body
- what the feature changed
- each criterion's verdict, and what established it
- every finding with its disposition
- what was not checked

The human must be able to sign from this file alone. A file that gives the verdict without saying
what it is a verdict on does not.

**The verdict is where the entry's next step comes from, so there are three and no others.**
`pass` — nothing outstanding, and the human signs. `fail` — the open items go back to WORK.
`criterion-unsettled` — a signed criterion has two readings and the verdict differs between them:
name both, say which one the body judged against and what the verdict is under the other, and it
goes to ANALYZE through the human. Anything else is a description, and the entry has no edge for
it. A verdict qualified in prose — passing "subject to", "conditional on", "pending" — is
`criterion-unsettled` written in a way the next stage cannot route on.

**`criterion-unsettled` is a finding against a stage before this one, and names which.** A
criterion reached the signature carrying two readings: ANALYZE writes the criteria and DISCUSS
settles what is contested, so say which of them let it through and what there would have caught
it. Reaching this verdict often is not care — it is a report that the stages upstream are handing
over criteria nobody can judge, and the record is where that becomes visible.

**A verdict reached by reading is a verification nobody ran, not a kind of verdict.** For each
criterion say what established it: a command and what it printed, or a reading. Where it was a
reading and something could have been run, name what would run it and why it was not — that is an
obligation the next stage can pick up. "Read, not run" on its own is a party excusing itself.

A review that cannot reach some of what it must judge — the artifact lives somewhere this stage
is not — is **blocked, not passed**: write `ended: blocked` in the frontmatter with a
`blocked_by:` carrying an id and one line for each thing waited on, say in the body what exactly
would unblock each, and judge everything else. Without the marker, a review that stopped for a
reason and one whose run broke off leave the same file; without the field, "blocked" is a word
with nothing behind it.

Name in the file which pass this verdict judges. Rewrite the file each pass; do not append to
it. Two verdicts standing in one file with nothing saying which is live is the thing this
forbids. The history of *passes* — which pass said what, and why a later one superseded it —
goes in `log.md`, not here. A rejected or deferred finding's own record does not: it lives in
`review/returns/`, below, whether or not this pass also sends anything back to WORK.

**A return leaves a file, and the file is a list.** Write one whenever you finish with items
still open, or with a finding you are rejecting or deferring rather than fixing — sending
something back to WORK, re-cutting at the bound, taking a criterion to the human as unmeetable,
and rejecting or deferring a finding are the four things that write one. The route changes what
happens next and not what is on the list, and a pass that ends the loop is the one whose items
most need to survive it. Write the
next numbered file in `<feature-dir>/review/returns/` — `1.md` if the directory is empty,
otherwise one
past the highest. The stage is the namespace: these sit under `review/`, so
nothing here can collide with what another stage leaves in the same feature directory, and no name
has to be got right to keep them apart. These files are never edited afterwards, and they
are the only place a rejected or deferred finding survives a rewrite of this one.

**A rejected or deferred item is closed on the return that raises it.** It carries the same
identity as any other item, and it is closed the moment it is written — a rejection closes with
its reason, a deferral closes with the named condition that would reopen it. It is not handed to
WORK and it does not wait for a later return to close it: "an item stays open until a return
says it is closed," below, and this is that return saying so on arrival. A deferral reopens only
when a later pass observes its named condition and says so — at which point it is a new finding,
not this one revived.

**Every item on that list carries three things: an identity, what was found, and the
disposition** — still open, naming what failed and why it does not meet the criterion, or
closed, naming the rejection's reason or the deferral's reopening condition. The identity is
`N.k` — the return's number and the item's place on it, so
`3.2` is the second item raised on the third return: a token a later file repeats exactly, not a
phrase someone has to recognise. The reason is what the next round is judged against, so it is
written for a reader who was not here — not "the check is too narrow" but what it missed and how
you know. **Every item says what would close it** — what someone would have to see to call it
done. For an item naming something missing rather than something wrong this is the whole of it,
because the absence of a thing is not an observation anyone can make: "no rule covers
a second reset" closes on a stated rule, and until you say which, nobody can tell whether it was
answered.

**Before you write your own findings, walk the open items.** Every item still open on an earlier
return gets a line in yours: closed, or still open and why. Name it by its identity, not by
describing it again — a reader who has to decide whether your paragraph and an earlier paragraph
are about the same thing is doing the judgement this list exists to remove.

**Walk every return that still has an open item, not only the last one.** **An item stays open
until a return says it is closed** — a return that does not mention it has not closed it and does
not break its run, and the count is how many returns have carried it — counting the one that
raised it, so an item raised on return 1 and still open on return 3 stands at three. Omission
would otherwise be the one way an item outlives the bound meant to catch
it. The natural failure is not malice: a review
organises around what it found, and an earlier item survives only where it happens to fit that
shape. Three items were sent back on one real return and none of their identities appears in the
next; two of the three could only be traced by comparing descriptions, and one could not be traced
at all.

**An item's identity never changes once raised.** If a later round decides two items are really
one, it says so and both keep their own identities and their own counts; if one is really two, it
raises new items beside it and the original stays open until the work that closes it is done.
Restating an item under a new identity resets what the entry's bound counts, and nothing on disk
would tell that from a refinement.

Send implementation defects back to WORK yourself. Do not route one through the human, and do
not make reopening that loop anyone's call. Send a finding that would change what a criterion
*means* back to ANALYZE, through the human — those are the criteria that were confirmed, and
only that route reaches them.

## Fresh eyes

A reader who did not write the work establishes the verdict: a fresh-context agent, a different
model family, or the human. How many, and which, is your call, matched to the work. That they
did not write the work is not.

Treat the author's account of the work as input to that reader, never as evidence for it.

**The same boundary covers every document a prior stage produced, not only the work's own
account.** `plan.md`'s restatement of the criteria is already inadmissible (`review:24-26`
above); `log.md` is the author's account named in the line above. `analysis.md` is neither — it
predates the work and is written by the party that wrote the criteria, not the party that wrote
the work — and the same rule applies to it by the same reasoning: read it if it helps, never let
it settle what the work must do. The signed criteria come from `acceptance.md` alone.

Nobody signs off their own work. The party that wrote it does not supply the verdict, and does
not author the severities, the dispositions, or the list of what was not checked either.

**The reader's own judgment lands on disk as its own file, and `review.md` carries its verdict
rather than merely citing it.** Write the reader's returned judgment — verdict, severities,
dispositions, unchecked-items list — to `<feature-dir>/review/readers/<name>.md`, with `verdict:`
and a `reader_kind:` of `claude-subagent`, `cross-family`, or `human` in its own frontmatter. You
write those two fields onto the file as you transcribe the reader's answer — the reader cannot
see its own kind, the same reason `discuss/SKILL.md` has the coordinating party write a seat's
`agent:`/`grant:` rather than the seat itself — and you write them from what the reader actually
returned, never inventing or adjusting the verdict itself. `review.md`'s own frontmatter then
carries `verdict_from: review/readers/<name>.md`, and its `verdict:` **is** that file's `verdict:`
— carried, not restated. This is what a review naming a reader and a review whose verdict a
reader actually produced stop looking alike on disk.

**No carve-out for a human reader.** A human supplies the same `review/readers/<name>.md` file as
any other reader; naming a human in `review.md` without one is not evidence they reviewed
anything — it is the naming party's own unverified word, the same defect a self-written
independence field would be.

**Where a reader kind already has a receipt this repository can check, cite it — it costs
nothing new.** A Claude subagent reader carries the `agent_id:` and `agent_transcript_path:` the
host already writes without a hook (measured via `SubagentStop`). A cross-family reader run
through `codex-seat.sh` carries the `[RECEIPT] ... call ok` line that script already verifies
before printing an answer. Neither is required for a human reader, for whom no such mechanism
exists.

## What must be true of the review

- **Every criterion gets a verdict, and every verdict rests on evidence this review produced.**
Re-run what can be run. Judge the rest against the criterion's own terms and the artifact
itself, not against the author's report of it. What only a human can settle, leave to the human
and say so.
- **No criterion is satisfied by a check nobody has seen fail.** If nothing on disk records that
check failing before the work that made it pass, see it fail yourself or send the criterion back
to WORK.
- **Each criterion's verdict names its basis.** `basis: acceptance.md` when the criterion's own
text settled it; `basis: acceptance.md, context: <file>` when an upstream document — `plan.md`,
`log.md`, `analysis.md` — additionally informed the reading, naming which. A verdict giving
neither is not checkable against what it actually rested on.
- **The checks bite.** Take the most load-bearing criterion, break what it protects, and confirm
its check catches it.
- **The judged half of code quality is this stage's, not WORK's.** Testability, extensibility,
and whether the change was cut at a reasonable size are not commands anyone can run — WORK runs
the project's mechanical checks (`.claude/pipeline.yml`'s `test:`/`lint:`/`typecheck:`) per
commit; judging the rest, once, over the feature's whole change, is here. Report each as an
ordinary finding with a severity and disposition, same as any other — not a new category.
- **Scope is answered both ways.** Name every changed file no step accounts for, and everything
the criteria demand that is still missing. Do not skip this.
- **An artifact asserting facts is checked claim by claim, whatever those facts are about.**
Not only facts about the repository — a date, a figure, a quote, anything the deliverable claims
is true of something outside itself. Read the sources it cites (a primary source outside the
repository counts) and form your own answer before reading the artifact. Then give each material
claim its own verdict against the line it rests on. "It reads correctly" is not an answer.
- **Every verification the plan names is accounted for.** List them all. Give each one of three:
performed in the log, performed here, or owed by a named party. Where that party is you, perform
it here. One that appears in neither the log nor this review is a finding — it was named by one
stage and skipped by the next.
- **A correction the log records is a correction the plan carries.** Where the log says a claim
in the plan was found wrong and `plan.md` still makes it, that is a finding.
- **What was not checked is listed plainly.**
- **Every finding carries a severity and an explicit disposition:** fixed, rejected with a
reason, or deferred with a named condition. No finding disappears. A severity class collapsed
into one summary sentence is not a disposition.
- **Findings that keep arriving without the set shrinking mean the partition is wrong.** Report
what is generating them as one finding, not the instances as many.
- **Report nothing that traces to neither a criterion nor a check that could turn red:** not a
preferred alternative, not a restatement of what the code does, not a pre-existing defect this
change did not touch.

## Carry two things past this feature

**Append, never overwrite, to `<root>/standing-notes.md`** — the one deliverable in this workflow
that accumulates across features rather than holding only current truth, so the next feature does
not start from zero on what an earlier one left open. Two additions, each a dated one-liner naming
this feature's id: this pass's "what was not checked" list, under `## Unchecked`; and any finding
disposed as deferred, with its reopening condition, under `## Deferred`. Where the file does not
exist yet, create it with those two headings.

## The human signs

Show what changed, what was verified and how, every finding's disposition, and what was not checked.

Done means the human signed. Not tests green, not your own pass verdict. A criterion left for
the human to settle stays open until they settle it.

**The human may refuse to sign when** a verdict rests on the author's report instead of evidence
this review produced, a criterion is called satisfied by a check never seen red, any finding has
no disposition, or nothing says what was not checked.
