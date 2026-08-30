---
name: review
description: "Deep multi-agent review — judge the work against the frozen criteria (feature completion gate). Recommended: Sonnet or above"
argument-hint: "<plan file path>"
model: opus
effort: xhigh
user-invocable: true
---

# /ae:review

Judge the delivered work against the acceptance criteria the human confirmed. Nothing else.

## Input

`$ARGUMENTS` is the plan path; `<feature-dir>` is its parent directory. Empty → ask which feature to review.

What you judge is the feature's whole change — everything committed since the feature started, not the last commit — read against the plan, the working log, and the criteria. The criteria are the ones the human signed in `acceptance.md`, and that file is where they are read from.

## Fresh eyes

The verdict is established by a reader who did not write the work: a fresh-context agent, a different model family, or the human. How many and who is your call, matched to the work; that they did not write it is not. The author's account of the work is input to that reader, never evidence for it. Nobody signs off their own work.

## What must be true of the review

- **Every criterion gets a verdict, and every verdict rests on evidence this review produced.** Re-run what can be run — the executor's green run is a claim, not evidence. Judge what must be judged against the criterion's own terms and the artifact itself, never against the author's report of it. What only a human can settle, leave to the human and say so.
- **No criterion is satisfied by a check nobody has seen fail.** If nothing on disk records that check failing before the work that made it pass, see it fail yourself or send the criterion back to WORK.
- **The checks bite.** Take the most load-bearing criterion, break what it protects, and confirm its check catches it.
- **Scope is answered both ways.** Name every changed file no step accounts for, and everything the criteria demand that is still missing. This question finds the worst defects; do not skip it.
- **An artifact asserting facts about the repository is checked claim by claim.** Read the sources it cites first and form your own answer before reading the artifact; then give each material claim its own verdict against the line it rests on. "It reads correctly" is not an answer — that read passed four of four confidently wrong pages.
- **What was not checked is listed plainly.** That list is for the human.
- **Every finding carries a severity and an explicit disposition** — fixed, rejected with a reason, or deferred with a named condition. A finding that disappears is a process failure, and a severity class collapsed into one summary sentence is not a disposition.
- **Findings that keep arriving without the set shrinking mean the partition is wrong.** Report what is generating them as one finding, not the instances as many.
- **Nothing is reported that traces to neither a criterion nor a check that could turn red** — a preferred alternative, a restatement of what the code does, a pre-existing defect this change did not touch.

## Deliverable

`<feature-dir>/review.md`. It says pass or fail where that can be read without reading the body, then gives the evidence: each criterion's verdict, every finding with its disposition, and what was not checked. If the conversation were lost, the human could sign from this file alone.

Implementation defects go back to WORK — the ordinary loop, needing nobody's permission. A finding that would change what a criterion *means* goes back to ANALYZE via the human, because the criteria are what was confirmed.

## The human signs

Show what changed, what was verified and how, every finding's disposition, and what was not checked.

Done means the human signed — not tests green, not your own pass verdict. A criterion left for the human to settle stays open until they settle it: a gate the executed party can open is not a gate.

**The human may refuse to sign when** a verdict rests on the author's report instead of evidence the review produced, a criterion is called satisfied by a check never seen red, any finding has no disposition, or nothing says what was not checked.
