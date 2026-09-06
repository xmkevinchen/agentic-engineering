---
name: plan
description: "Decide the method: cut the work into dependency-ordered steps against criteria the human has already signed, and name how each step verifies its criteria."
argument-hint: "<feature-dir>"
model: opus
effort: high
user-invocable: true
---

# /ae:plan — decide the method

Decide how the work is cut into steps and how each criterion will be verified.

**The criteria arrive signed.** They are not yours to change, and nothing here restates them.

## Input

`<feature-dir>/acceptance.md`, `<feature-dir>/analysis.md`, and any decision records in that
directory — **and the files the criteria and the steps are about, as they stand.** The split test
below is a claim about trees, and a claim about a tree cannot be made out of the feature directory
alone.

## Deliverable

`<feature-dir>/plan.md`.

**And nothing else.** This stage decides the method and does not carry it out: the work is the next
stage's. Read whatever it takes, and run a check that already exists — the rule below requires it —
but what this stage hands over is the tree it was given, plus `plan.md` and whatever a check wrote
while it ran. A plan whose author already did part of the work is one nobody can read against what
happened.

## Check the input before planning against it

**Read `acceptance.md` first, and refuse it on either of two counts:**

- a criterion has no falsifier and no judgement mark — nobody can be held to it;
- the evidence an answer rests on no longer holds — a criterion resting on a file that has since
  moved or gone was signed against a tree that no longer exists.

Name what failed in `plan.md` under `ended: input-refused`, and send it back to analyze through
the human. It is one paragraph and no steps — but writing it is what tells the next reader this
stage refused its input, rather than leaving a directory shaped exactly like one whose planning
broke off.

Both are the entry's admission checks and the entry applies them, but this stage is reachable
directly: arriving that way, there is nothing between a malformed analysis and a plan built on
it.

## Send it back rather than plan around it

A criterion that cannot be planned against at all goes back to analyze, through the human — it
is signed, so nobody else can move it. Name the id and what could not be planned. Planning
against a standard you had to invent is how the standard drifts toward whatever gets built.

Returning one criterion does not stop the others: plan the ones that can be planned, and say in
the plan which were returned and what would unblock each — under `ended: criterion-unplannable`.

## What must be true of the plan

**Criteria are cited, never restated.** A step names the ids it serves; `acceptance.md` remains
the only place a criterion's property and falsifier are written. A second copy is a second
thing to keep true.

**Each criterion says how it will be verified.** A command anyone can run, or an artifact a
human judges together with the question they answer, or a plain statement that a human confirms
it by hand. Never an automated check invented to avoid saying the last one.

**The steps are a dependency-ordered stack.** Each step is one commit that closes on itself and
depends only on the steps above it — that is what makes a failure attributable: ten
self-closing commits say which one broke, one commit of ten changes says only that something did.
Each step says what it does, which criteria it serves, which files it expects to touch, and how
it verifies those criteria.

**Test a step by trying to split it in two.** It is too coarse when, in dependency order, the
first part can land on the tree before the step and the second can land on the first; each part
serves a criterion the other does not; and each of those criteria can be verified against the tree
where its part lands. Where no such split exists, it is one step. Nothing here is about the
project's suite: whether a commit lands green is `work/SKILL.md`'s, and a second standard named
here is a second answer to the same question.

**Coverage runs both ways.** Every criterion is served by at least one step, and no step builds
something no criterion asks for.

**No criterion rests on a check nobody has seen fail.** Where the check already exists, run it
now — a first observed result of green stops the plan, because either the property already
holds or the check is aimed at something other than the criterion. Say which check and which
criterion, under `ended: check-green-first`. Where it does not exist yet,
name the observation precisely enough that whoever writes it can watch it fail first.

## Before work starts

Have one reader who did not write the plan read it against `acceptance.md` and answer two
questions: does any step build something no criterion asks for, and would any criterion still
be unmet if every step passed? Fix what comes back. Where no such reader is available, say so
in the plan rather than skipping the round silently.

## What the next stage may refuse it for

A step that names no verification for a criterion it serves. A step that serves no criterion.
