---
name: plan
description: "Decide the method: copy the criteria from the analysis, cut the work into dependency-ordered steps, the human confirms, then freeze the goal."
argument-hint: "<feature-dir>"
model: opus
effort: high
user-invocable: true
---

# /ae:plan — decide the method

Decide how the work is cut into steps and how each criterion will be verified. The criteria themselves are not yours to change.

Input: `<feature-dir>/analysis.md`, plus any decision records in that directory.
Deliverable: `<feature-dir>/plan.md`.

## Send it back rather than plan around it

Go back to analyze, naming the row, when a criterion arrives with no falsifier and nothing marking it a judgement call, when a premise answer rests on no evidence, or when a criterion cannot be planned against at all. Planning against a standard you had to invent is how the standard drifts toward whatever gets built.

## What must be true of the plan

**The criteria are the analysis's criteria.** Each one carries the id, the property and the falsifier the analysis gave it, word for word — a diff of the two texts shows nothing. How the text gets there is yours; retyping is what drifts. A criterion that cannot be planned against goes back to analyze rather than being rewritten here.

**Each criterion says how it will be verified.** A command anyone can run, or an artifact a human judges together with the question they answer, or a plain statement that a human confirms it by hand. Never an automated check invented to avoid saying the last one.

**The steps are a dependency-ordered stack.** Each step is one commit that closes on itself and depends only on the steps above it — that is what makes a failure attributable: ten self-closing commits say which one broke, one commit of ten changes says only that something did. Each step says what it does, which criteria it serves, which files it expects to touch, and which check it turns from red to green.

**Coverage runs both ways.** Every criterion is served by at least one step, and no step builds something no criterion asks for.

**No criterion rests on a check nobody has seen fail.** Where the check already exists, run it now — a first observed result of green stops the plan, because either the property already holds or the check is aimed at something other than the criterion. Where it does not exist yet, name the observation precisely enough that whoever writes it can watch it fail first.

## Before the human sees it

Have one reader who did not write the plan read it against the criteria and answer two questions: does any step build something no criterion asks for, and would any criterion still be unmet if every step passed? Fix what comes back. Where no such reader is available, say so in the plan rather than skipping the round silently.

## → HUMAN CONFIRMS

Present the criteria first — each with its property, its falsifier, and how it will be verified. That is the thing being confirmed. Then the step cut, as advisory context. Then where the plan was written.

Wait for the confirmation. Work does not start without it, and afterwards a criterion changes only by going back to analyze with the human's signature; work already done was done against the criteria as confirmed.

## What the next stage may refuse it for

A step that names no check to turn red. A criterion whose text differs from the analysis.
