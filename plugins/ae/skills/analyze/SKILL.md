---
name: analyze
description: "Stage 1 — end with the problem named, done defined, and evidence behind both. Writes the feature directory, its analysis.md, and the acceptance criteria the human signs."
argument-hint: "<BL-NNN> | <F-NNN-slug, to resume a blocked one> | <feature description>"
user-invocable: true
effort: high
---

# /ae:analyze — what is the problem, and what would count as done?

Input: the work item — **$ARGUMENTS**, free text, a `BL-NNN`, or a path to a file describing
it — and the repository. Read the repository yourself before writing anything.

## When this stage is over

Three things hold:

1. **You can say what the problem is.**
2. **You can say what would count as done.**
3. **Something is behind both** — a path, a line, or a command someone else can run. "I
   checked" is not evidence.

Nothing else ends it, and nothing else is needed to end it. A problem you already understand
ends here in three lines, and that is a finished analysis, not a thin one. A problem you do
not understand ends here only once you have gone and got what was missing.

## When one of the three does not hold yet

Ask who can close the gap. There are three answers and no fourth.

- **You can, by going and looking** — go get it. Run the thing and see whether it reproduces.
  Find out whether this is already solved, nearly solved, or solved next door: an existing
  tool, a similar approach, someone else's answer to a neighbouring problem. Designing your
  own is the last option, not the first. Read the code. What it takes is yours to choose, and
  none of it is a deliverable.
- **Nobody can, because two answers both stand up** — that is one question for `/ae:discuss`,
  and the only kind there is. Name it, and go on to the next gap.
- **Only the human can, because the material is nowhere you can reach** — it was never written
  down, or it lives somewhere you have no access to. Ask, naming what is missing and what
  having it would let you settle; "more context" is not a request anyone can fill. Then put
  the three questions again. Ask, get, re-ask — loop here until they hold, or until one of the
  endings below turns out to apply instead.

Write the directory and `analysis.md` on the first pass through that loop, holding what you
have and, for each thing you are waiting on, three things: **what is missing, why it is
nowhere you can reach, and what having it would let you settle.** That is the load-bearing
part. `blocked_by:` only marks that the analysis is mid-loop, and a marker nobody can act on
is not a request. The middle clause is also where this route polices itself: a blocker whose
"why" thins out once written down was something to go and look at.

None of that is a provisional answer, it is the true state — and it buys the human an `F-NNN`
to come back to, so the next round is `/ae:go F-NNN-<slug>` rather than the original request
pasted again. `acceptance.md` waits: there is no point stating what done means for a problem
you cannot yet state.

That third route is the one that gets abused, because asking is cheaper than looking: it is
yours only once looking has established the material is not there. But between asking and
inventing a premise, ask. An analysis standing on an invented premise costs four stages to
find out about; another question costs a message.

## What it delivers

A feature directory `.ae/features/active/F-NNN-<slug>/` — `F-NNN` an id no feature has ever
held, retired ids never reused — holding two files.

**`analysis.md`** — what the problem is, what that rests on, each question left for
discussion and what makes it unsettleable by evidence, and, while it is blocked, what it is
waiting on. Its frontmatter carries ids, not text:

```yaml
---
discuss:
  Q1: the question in one line, as it would be posed
  Q2: a second, when the analysis left two of them standing
blocked_by:
  B1: what is missing, in one line
---
```

Every id has a section in the body, headed by that line and as long as it needs to be. The
line is how the list reads at a glance — at the gate where the human decides whether to argue
with it — and the section is where the thing is actually said. Nothing here is one line
because a field made it one line.

An empty `discuss:` means no discussion, and that is a judgement with a reason behind it, not
a silence. Each entry is a question whose two answers lead to materially different work, and
they reach the list two ways. One you could not settle: what done means is itself contested.
One you settled and then saw past: done is clear, and two routes to it both stand up. The
second is not a gap — it is what a finished analysis can see, and what a plan written alone
would decide silently and leave no record of.

The ids are what the runner acts on without reading prose: `discuss:` says how many times
`/ae:discuss` runs and which section each run opens, and a `blocked_by:` still holding ids
says this analysis is mid-loop rather than finished. Control flow is what earns a field.
Nothing else here earns one — a criterion's property and falsifier are read by people, and
people read prose.

**`acceptance.md`** — what done means, and nothing else. It is a separate file because it is
the thing the human signs, and because it is the entire input to the fresh eyes that later
judge whether the work met it: anything about how the conclusion was reached would stop them
being fresh.

Each criterion carries an id later stages cite, the property that must hold, and the falsifier
— what you would observe if the property did NOT hold. A criterion with no falsifier is a
wish: find one, or mark it judgement and leave it to a human.

**Both are written in the vocabulary of the thing being built, never the toolchain.** "Every
test passes — unit, integration, end-to-end" is a criterion; "`pytest -q` and `jest --ci` exit
zero" is a method, and methods belong to the plan. The test is whether the criterion survives
replacing the tools: one that names pytest dies with pytest, and whatever it was really
asserting was never written down. This is the ordinary discipline of acceptance criteria —
observable behaviour in the domain's own words, whatever notation you reach for — and what
makes it load-bearing here is who reads this file. The human signs it, and fresh eyes later
judge the work against it. Neither should have to know the toolchain to do their job.

The falsifier is the load-bearing part and it is not always a test. A document is read against
the thing it describes, never against another document. A data invariant is a stated mismatch
— an order whose total disagrees with its line items — and finding one is the plan's business,
not this file's.

Later stages cite criteria by id. Nobody copies them.

## Where the item does not go on as one

**There is nothing to do** — no problem, or it was already decided the other way somewhere.
Record what was found, close or re-aim the item, and stop. That is a result, and the cheapest
one available.

**It is not one item** — you can say what the problem is, and the answer is that it is
several. The test is the second file: if two sets of criteria could each be signed and
delivered without the other, this is two items. Name the cut, and what each piece would be
done by, and stop. Which of them get worked, and whether that is even the right cut, is the
human's: quietly narrowing or widening what was asked for is not yours.
