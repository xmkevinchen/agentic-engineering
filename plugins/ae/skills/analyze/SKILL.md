---
name: analyze
description: "Stage 1 — establish that the problem is real and settle what done means, before any solution exists. Writes the feature directory and its analysis.md."
argument-hint: "<BL-NNN> | <feature description>"
user-invocable: true
effort: medium
---

# /ae:analyze — is the problem real, and what would prove it done?

Establish that the problem is real and settle what "done" means, before any solution exists.

Input: the work item — **$ARGUMENTS**, free text, a `BL-NNN`, or a path to a file describing it — and the repository. Read the repository yourself before writing anything.

## What it delivers

A feature directory `.ae/features/active/F-NNN-<slug>/` holding `analysis.md`. `F-NNN` is an id no feature has ever held; a retired id is never reused. That directory is this work item's `<feature-dir>` — every artifact the item ever produces lands there.

## What must be true of `analysis.md`

**The premise is answered, and every answer carries evidence.** Does this problem exist today? Has it already been decided the other way somewhere? Can success be checked by a command — and if not, what would checking look like? Evidence is a path, a line, or a command someone else can run; "I checked" is not evidence. A verdict is provisionally true, never settled: a later stage re-runs the citation, and one that no longer holds sends the item back here.

**The acceptance criteria are settled here** — one per acceptance dimension, before any solution exists, because criteria written after a design drift toward whatever the design produced. Each carries an id later stages cite, the property that must hold, and the falsifier: the concrete search, test or question that would expose the property NOT holding. A criterion with no falsifier is a wish — find one, or mark it judgement and leave it to human review.

**The falsifier is the load-bearing part, and it is not always a test.** A document is read against the thing it describes, never against another document. A data invariant is the query that returns the violating rows, where an empty result is the evidence. A wired path is checked by asking the far end what it received.

The next stage copies each criterion's id, property and falsifier verbatim and owns only the method; it must be able to find all three in the file without asking you.

## What the next stage may refuse it for

- A criterion has no falsifier and no judgement mark.
- A premise answer has no evidence behind it.

Either refusal comes back here.

## A `no` ends the item

A `no` to the first premise question, or a `yes` to the second, ends the work item here. Record what was found, close or re-aim the item, and stop. That is a result, not a failure — it is the cheapest one available.
