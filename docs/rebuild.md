# Rebuilding AE — why, and what it does not claim

> **Status: current.** This is the top-level account of why the rebuild
> happened: the evidence that started it, and the limits of what it
> established. What is missing and what is planned next live in this
> project's own Forgejo issues and board, not here — see §2. Where a
> document under [`history/`](history/README.md) contradicts this one,
> that document is the history and this one is current.

## The one-sentence version

AE had become bloated, ceremonial, and in places self-contradictory: what the
process cost had passed what it caught, so the core workflow was kept and
everything around it was rebuilt from the floor rather than patched.

The everyday analogy: the plugin had turned into a body of **case law** — one
rule per past incident, 98% of it never repeated — rather than a **program**. Case
law is only load-bearing if someone reads it at the moment of decision. A
controlled experiment tested whether anyone did, and a **182-line** workflow
reproduced the same results on the same work. The prose went from 8,457 lines to
**779** at the delete, measured once, dated to the delete itself — the tree's
current line count is the tree's own business, not a number this document
carries and re-measures.

**Two things this document is not.** It is not a report on finished work — the
project's own issues track what is known to be missing, and this document does
not. And it is not a claim that the minimum has been found — what shipped at
the delete was a first cut, still being tested by the work that has happened
since.

---

## 1 · Why the rebuild happened

Five findings, in the order they landed. Each is an observed fact with its
method stated; the conclusions drawn from them are marked as such.

### 1.1 The prose grew faster than the control it bought

**Plain-language version.** Every incident produced a written rule, and rules
were never retired, so the instruction layer grew monotonically.

**What produced it, which matters more than the number.** AE was developed with
AE, by agents. That loop has one direction: a review round returns findings, and
the cheapest disposition for a finding about behaviour is to *write a rule about
it*. Nothing in the loop ever proposed deleting one. So each pass added prose,
each addition made the next pass more expensive to run, and the whole thing was
experienced as diligence. **This is why patching could not fix it, and why
patching with AE least of all** — applied to itself, the process's own output is
more process. Note what this does *not* say: developing AE with AE is still the
working mode. What had to change is where the evidence comes from — a stage run
closed-book by a session that did not write it, watched, rather than a pipeline
pass returning findings that become rules. The same effect is reproducible on demand: a multi-agent review of
this repository run on 2026-09-01 returned roughly forty findings, and the first
disposition reached for on nearly every one of them was to add or amend a
document. Most of them should have been deletions, and became deletions only when
a person said so.

**Observed.** 24 skills, 8,457 lines — the peak reachable in git history — against
141 structural controls (69 typed refusal codes in the deterministic Kernel plus
72 executable check scripts).
A text analysis put the prose at 98% non-repeating and only ~11% conditional
logic. The single densest line in the review skill was 2,329 characters.

**The open question it raised.** Is that mass load-bearing, or scaffolding?

### 1.2 The instructions had begun to contradict each other

**Plain-language version.** With enough rules written at enough different times,
some of them disagree — and nothing notices, because prose does not fail to
compile.

**Observed**, all of it found in a single pass over the tree on 2026-09-01:

- The workflow's **one hard human gate was drawn in two different places**. The
  entry skill puts it before PLAN and says "planning does not start without it";
  the README, the quickstart and the published stage graph all put it after PLAN.
  Following the diagrams meant planning against unsigned criteria — the exact
  thing the gate exists to prevent.
- **Three design documents carried two status banners each**, stacked: one saying
  "historical, archived", the next saying "current design source" or "current
  implementation plan".
- A frontmatter key was classified **"AE reads and ignores, never stripped on
  import"** by the agent contract, and two days later prescribed as a pattern and
  copied onto thirteen definitions. Neither statement revoked the other; the
  second simply never consulted the first.
- The session-start hook told **every user, every session** that a coordination
  layer was required, months after the last skill that used it was deleted.
- A checker implementing the stage's own falsifiers was **named in the stage's
  prose but never invoked by it** — its only executor was its own test.

**Why this is a category of its own.** Each of these reads as correct in
isolation. Contradiction is only visible to someone holding two places at once,
which is precisely what nobody does at 8,457 lines — and what no reviewer,
human or agent, was asked to do.

### 1.3 The process cost more than the work it governed

**Observed.** On one real slice, forming the paperwork took **209.7 minutes**
against **3.7 minutes** of work, and the slice consumed **36 review rounds**. The
pipeline was reshaped from a chain into loops afterwards, and five rules from the
first real runs landed — but the prose surface did not shrink.

**Why it matters.** Cost is not incidental here. It is the thing most likely to
make the product unusable, and it is the counter-argument to every proposal that
answers a problem by adding a stage or a rule.

### 1.4 The controlled experiment: 182 lines reproduced the results

**Method.** A separate plugin with **one** entry command and a **182-line**
workflow — five stages (analyze → optional discuss → plan → work → review), six
ground rules, exactly two human gates, and a pointer to where roles live instead
of a roster. No coordination protocol, no selection tables, no per-stage skill
documents. The instrument is reproduced verbatim in
[`history/x-workflow.md`](history/x-workflow.md).

Three benchmark items from this repository's own backlog, each with a
**known-in-advance correct outcome**, were run in fresh sessions, with an
independent session verifying every claim against the tree.

| Run | Item shape | Outcome |
|---|---|---|
| 1 | A stale work item that should die at its premise | Died at premise. Found the fix had shipped the day before and the item's own citations were stale. Zero human stops, zero agent spawns, minutes. |
| 2 | Mechanical fix with a deterministic pass signal | Suite red→green in 22m35s, 3 path-scoped commits. Its pre-check caught a genuine contradiction between two criteria *before* the human gate; its review re-ran every falsifier and planted a defect to prove the checks bite. |
| 3 | Prose-rule fix, no unit test possible — run deliberately on a model **two tiers below** runs 1–2 | Same protocol compliance, same judgment quality. Criteria were marked `judgement` where mechanical checks were impossible rather than faked. One visible tier difference: a pre-check round was performed but not self-documented. |

Independent verification found **zero defects** in the output across all three
runs. Four agent spawns total, all generic subagents with role, reading list and
one question supplied in the prompt.

**What this establishes (conclusion, from the above facts):**

1. **The control relocated; it did not disappear.** Two gates, one deliverable
   contract per stage, and the repository's executable checks did what the 8,457
   lines were assumed to be doing.
2. **The model-drift hypothesis failed to appear.** The prose volume implicitly
   assumed a model that drifts without dense instruction. On a model two tiers
   weaker, inside this structure, that model did not show up.
3. **The executable checks are the real capital.** Every red→green and every
   planted defect bit through a script that actually runs. The workflow's job was
   to put the model in front of them.

   **A qualification this repository had to learn about itself.** That finding is
   about checks *in the project being worked on*. AE's own suite was mostly not
   that: of sixteen scripts, most read a `SKILL.md` and asserted a sentence was
   present, and the largest block — 8,000 lines of frozen corpus and 90 fixtures —
   guarded the archived Kernel. A scan proving the words are on disk is not
   evidence that anything obeyed them, and it turns every rewording into
   maintenance. Those are gone; what replaced them is this repository's own
   current tree, not documented here — the tree is its own current state, and
   a second copy of it in this file is the thing that goes stale.

**Honest limits (unknowns, not conclusions).** n = 3, all with known answers.
Genuinely exploratory work — the shape AE ultimately serves — was **not** tested.
The experiment consumed this repository's existing check infrastructure; in a
repository without such checks the same 182 lines would have less to bite with.
The baseline is historical run data, not a same-item head-to-head. And the runs
were observed, not unobserved.

### 1.5 A programmed rule nothing calls is not a rule

**Plain-language version.** The strictest part of AE was built, proven, and then
never wired to anything.

**Observed.** The tree held a deterministic Kernel under `plugins/ae/v1/`: 25 frozen record
kinds, four persisted objects, an append-only ledger, a Gate whose vocabulary
separates `passed` from `pending` from `unavailable`, and a completion path that
refuses with a distinct named code for each way an acceptance can be unearned.
Its suite runs into the hundreds of assertions; a mutation script fails when a
planted defect survives, and a deletion sweep removes every refusal in turn and
reports the ones the suite does not notice. It reached a real acceptance twice.

And **nothing ever called it** — no skill, agent, template, hook or script, except
its own test suite. Its entry-point work was abandoned partway.

**Decision taken.** Archived — proven, unconsumed, reopened only on named observed
events. It stayed in the tree for a while after that, with its own suite still
running on every test pass. That was the archive misunderstood: a tag is already a
frozen, known-good point, so re-proving 10,838 unreachable lines on every unrelated
commit established nothing — while the standing green tick made a subsystem nobody
could reach read as a live part of the project, which is how it survived the delete
in the first place. **The working tree no longer carries it. Tag
`v1-kernel-archive` does**, complete, and that tag is the resurrection point.

**The lesson that generalizes.** A programmed rule with no entry point and no
rule at all are the same thing to a user. This is now the first question asked of
any proposed mechanism: *what loads it?*

### 1.6 The host enforces less than a workflow needs

Measured against Claude Code 2.1.247, non-interactive, foreground subagents,
plugin-level command hooks. The full table and its method live in
[`references/hooks.md`](references/hooks.md); the two lines that bound the design:

- **Only `PreToolUse` exit 2 and `TaskCompleted` exit 2 refuse anything.** A
  validator that errors, or exceeds its timeout, *permits* the call. A hook is a
  detector, not a gate.
- **Process exit status carries no business meaning.** Every measured scenario
  ended with the process reporting success, including the two that refused a
  tool call.

**Non-obvious consequence.** "Strengthen the workflow" cannot mean adding stages
or rules. Under these semantics that buys cost without control.

---

## 2 · Current state and what's next

Not here. The tree is its own current state, and the open gaps and the roadmap
are exactly the two things that go stale fastest in a document like this one —
this section used to carry both, and rewriting it on almost every working day
was itself evidence the rebuild it describes was diagnosing. What is missing
and what is planned next are tracked as this project's own Forgejo issues and
project board (see `project-management.md`), which carry status natively
instead of a paragraph nobody updates.

---

## 3 · What this rebuild does not claim

- **It cannot establish that a model followed prose.** It can establish that a
  rule cannot be silently dropped, and that a command ran and what it returned.
  No surface may imply more.
- **The experiment behind it is n = 3, all with known answers.** Exploratory work
  remains the untested case and the next benchmark.
- **The measured host semantics are version-specific.** Re-measure before making
  any of them load-bearing.
- **This is not a 1.0.** The version gate is evidence that the loop holds on work
  nobody knew the answer to in advance — not a branch name and not a line count.
- **The rebuild is not finished, and the shrinking is not the finish.** Deleting
  what nothing reached was the cheap half. The half that decides whether any of
  this was worth doing is running the stages that have never been run —
  tracked, like everything else still open, in the project's own issues now.
- **Nothing here should be patched into shape.** Where this document or the
  workflow is wrong, the repair is to cut and re-derive, not to add a rule
  covering the case — and least of all by running AE over AE to produce that rule.
  §1.1 is the record of where that ends.

---

## Reading order

| If you want | Read |
|---|---|
| To use the thing | [`quickstart.md`](quickstart.md) |
| The stage graph, drawn | [`workflow-graph.html`](workflow-graph.html) |
| The experiment's instrument, verbatim | [`history/x-workflow.md`](history/x-workflow.md) |
| What the host will and will not enforce | [`references/hooks.md`](references/hooks.md) |
| Why cross-family exists | [`references/cross-family-rationale.md`](references/cross-family-rationale.md) |
| What was designed before the delete | [`history/README.md`](history/README.md) |
