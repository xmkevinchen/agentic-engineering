---
name: review
description: "Judge the delivered work against the criteria the human signed, through a reader who did not write it. The signature that completes a feature is the human's, not this verdict."
argument-hint: "<plan file path>"
model: opus
effort: xhigh
user-invocable: true
---

# /ae:review — judge the work against the signed criteria

Judge the delivered work against the acceptance criteria the human confirmed. Nothing else.

## Input

`$ARGUMENTS` is the plan path; `<feature-dir>` is its parent directory. If empty, ask which feature to review.

Judge the feature's whole change: everything committed since the feature started, not just the last commit. Read it against the plan, the working log, and the criteria. The criteria are the ones the human signed, and `acceptance.md` is where you read them from — not the plan's restatement of them and not the log's.

## Deliverable

`<feature-dir>/review.md`, containing:

- pass or fail, readable without reading the body
- what the feature changed
- each criterion's verdict
- every finding with its disposition
- what was not checked

The human must be able to sign from this file alone. A file that gives the verdict without saying
what it is a verdict on does not.

Name in the file which pass this verdict judges. Rewrite the file each pass; do not append to it. Two verdicts standing in one file with nothing saying which is live is the thing this forbids. The history of passes goes in `log.md`, not here.

**A return leaves a file.** When you send findings back to WORK, write
the next numbered file in `<feature-dir>/returns/` — `1.md` if the directory is empty, otherwise
one past the highest — holding the findings that go back and the disposition of every finding this
pass raised, including the ones you rejected or deferred. The directory is the namespace, so
nothing here can collide with the `returned-<id>.md` a discussion leaves beside it. These files are
what the entry's bound counts, and they are the only place a rejected or deferred finding
survives: this file is rewritten each pass, and a rewrite
would otherwise take the finding with it. They are never edited afterwards.

Send implementation defects back to WORK yourself. Do not route one through the human, and do not make reopening that loop anyone's call. Send a finding that would change what a criterion *means* back to ANALYZE, through the human — those are the criteria that were confirmed, and only that route reaches them.

## Fresh eyes

A reader who did not write the work establishes the verdict: a fresh-context agent, a different model family, or the human. How many, and which, is your call, matched to the work. That they did not write the work is not.

Treat the author's account of the work as input to that reader, never as evidence for it.

Nobody signs off their own work. The party that wrote it does not supply the verdict, and does not author the severities, the dispositions, or the list of what was not checked either.

## What must be true of the review

- **Every criterion gets a verdict, and every verdict rests on evidence this review produced.** Re-run what can be run. Judge the rest against the criterion's own terms and the artifact itself, not against the author's report of it. What only a human can settle, leave to the human and say so.
- **No criterion is satisfied by a check nobody has seen fail.** If nothing on disk records that check failing before the work that made it pass, see it fail yourself or send the criterion back to WORK.
- **The checks bite.** Take the most load-bearing criterion, break what it protects, and confirm its check catches it.
- **Scope is answered both ways.** Name every changed file no step accounts for, and everything the criteria demand that is still missing. Do not skip this.
- **An artifact asserting facts about the repository is checked claim by claim.** Read the sources it cites and form your own answer before reading the artifact. Then give each material claim its own verdict against the line it rests on. "It reads correctly" is not an answer.
- **Every verification the plan names is accounted for.** List them all. Give each one of three: performed in the log, performed here, or owed by a named party. Where that party is you, perform it here. One that appears in neither the log nor this review is a finding — it was named by one stage and skipped by the next.
- **A correction the log records is a correction the plan carries.** Where the log says a claim in the plan was found wrong and `plan.md` still makes it, that is a finding.
- **What was not checked is listed plainly.**
- **Every finding carries a severity and an explicit disposition:** fixed, rejected with a reason, or deferred with a named condition. No finding disappears. A severity class collapsed into one summary sentence is not a disposition.
- **Findings that keep arriving without the set shrinking mean the partition is wrong.** Report what is generating them as one finding, not the instances as many.
- **Report nothing that traces to neither a criterion nor a check that could turn red:** not a preferred alternative, not a restatement of what the code does, not a pre-existing defect this change did not touch.

## The human signs

Show what changed, what was verified and how, every finding's disposition, and what was not checked.

Done means the human signed. Not tests green, not your own pass verdict. A criterion left for the human to settle stays open until they settle it.

**The human may refuse to sign when** a verdict rests on the author's report instead of evidence this review produced, a criterion is called satisfied by a check never seen red, any finding has no disposition, or nothing says what was not checked.
