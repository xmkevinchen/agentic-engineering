---
name: plan
description: "Decide the method: cut the work into dependency-ordered steps against criteria the human has already signed, and name the check each step turns red."
argument-hint: "<feature-dir>"
model: opus
effort: high
user-invocable: true
---

# /ae:plan — decide the method

Decide how the work is cut into steps and how each criterion will be verified. The criteria arrive signed. They are not yours to change, and nothing here restates them.

Input: `<feature-dir>/acceptance.md`, `<feature-dir>/analysis.md`, and any decision records in that directory.
Deliverable: `<feature-dir>/plan.md`.

## Send it back rather than plan around it

A criterion that cannot be planned against at all goes back to analyze, through the human — it is signed, so nobody else can move it. Name the id and what could not be planned. Planning against a standard you had to invent is how the standard drifts toward whatever gets built.

## What must be true of the plan

**Criteria are cited, never restated.** A step names the ids it serves; `acceptance.md` remains the only place a criterion's property and falsifier are written. A second copy is a second thing to keep true.

**Each criterion says how it will be verified.** A command anyone can run, or an artifact a human judges together with the question they answer, or a plain statement that a human confirms it by hand. Never an automated check invented to avoid saying the last one.

**The steps are a dependency-ordered stack.** Each step is one commit that closes on itself and depends only on the steps above it — that is what makes a failure attributable: ten self-closing commits say which one broke, one commit of ten changes says only that something did. Each step says what it does, which criteria it serves, which files it expects to touch, and which check it turns from red to green.

**Coverage runs both ways.** Every criterion is served by at least one step, and no step builds something no criterion asks for.

**No criterion rests on a check nobody has seen fail.** Where the check already exists, run it now — a first observed result of green stops the plan, because either the property already holds or the check is aimed at something other than the criterion. Where it does not exist yet, name the observation precisely enough that whoever writes it can watch it fail first.

## Before work starts

Have one reader who did not write the plan read it against `acceptance.md` and answer two questions: does any step build something no criterion asks for, and would any criterion still be unmet if every step passed? Fix what comes back. Where no such reader is available, say so in the plan rather than skipping the round silently.

## What the next stage may refuse it for

A step that names no check to turn red. A step that serves no criterion.
