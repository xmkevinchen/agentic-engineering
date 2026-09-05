---
name: review
description: "Judge the delivered work against the criteria the human signed, through a reader
who did not write it. The signature that completes a feature is the human's, not this verdict."
argument-hint: "<plan file path>"
model: opus
effort: xhigh
user-invocable: true
---

# /ae:review — judge the work against the signed criteria

Judge the delivered work against the acceptance criteria the human confirmed. Nothing else.

## Input

`$ARGUMENTS` is the plan path; `<feature-dir>` is its parent directory. If empty, ask which
feature to review.

Judge the feature's whole change: everything committed since the feature started, not just the
last commit. Read it against the plan, the working log, and the criteria. The criteria are the
ones the human signed, and `acceptance.md` is where you read them from — not the plan's
restatement of them and not the log's.

## Deliverable

`<feature-dir>/review.md`, containing:

- pass or fail, readable without reading the body
- what the feature changed
- each criterion's verdict
- every finding with its disposition
- what was not checked

The human must be able to sign from this file alone. A file that gives the verdict without saying
what it is a verdict on does not.

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

Nobody signs off their own work. The party that wrote it does not supply the verdict, and does
not author the severities, the dispositions, or the list of what was not checked either.

## What must be true of the review

- **Every criterion gets a verdict, and every verdict rests on evidence this review produced.**
Re-run what can be run. Judge the rest against the criterion's own terms and the artifact
itself, not against the author's report of it. What only a human can settle, leave to the human
and say so.
- **No criterion is satisfied by a check nobody has seen fail.** If nothing on disk records that
check failing before the work that made it pass, see it fail yourself or send the criterion back
to WORK.
- **The checks bite.** Take the most load-bearing criterion, break what it protects, and confirm
its check catches it.
- **Scope is answered both ways.** Name every changed file no step accounts for, and everything
the criteria demand that is still missing. Do not skip this.
- **An artifact asserting facts about the repository is checked claim by claim.** Read the
sources it cites and form your own answer before reading the artifact. Then give each material
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

## The human signs

Show what changed, what was verified and how, every finding's disposition, and what was not checked.

Done means the human signed. Not tests green, not your own pass verdict. A criterion left for
the human to settle stays open until they settle it.

**The human may refuse to sign when** a verdict rests on the author's report instead of evidence
this review produced, a criterion is called satisfied by a check never seen red, any finding has
no disposition, or nothing says what was not checked.
