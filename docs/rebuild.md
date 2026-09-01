# Rebuilding AE — why, what the minimum is, and what comes next

> **Status: current.** This is the top-level account of the rebuild: the evidence
> that started it, the state of the tree today, and the ordered work still to do.
> Where a document under [`history/`](history/README.md) contradicts this one,
> that document is the history and this one is current.

## The one-sentence version

AE had grown to 24 skills and 8,457 lines of process prose; a controlled
experiment showed that a **182-line** workflow reproduced the same results on the
same work, so the prose was deleted down to **779 lines**, and everything that
wants back in has to earn its place against measurement rather than against the
memory of why it was once added.

The everyday analogy: the plugin had turned into a body of **case law** — one
rule per past incident, 98% of it never repeated — rather than a **program**. Case
law is only load-bearing if someone reads it at the moment of decision. The
experiment tested whether anyone did.

---

## 1 · Why the rebuild happened

Four measurements, in the order they landed. Each is an observed fact with its
method stated; the conclusions drawn from them are marked as such.

### 1.1 The prose grew faster than the control it bought

**Plain-language version.** Every incident produced a written rule, and rules
were never retired, so the instruction layer grew monotonically.

**Observed.** 24 skills, 8,457 lines — the peak reachable in git history, and the
figure every counter in §4 is measured against — against 141 structural controls (69 typed
refusal codes in the deterministic Kernel plus 72 executable check scripts).
A text analysis put the prose at 98% non-repeating and only ~11% conditional
logic. The single densest line in the review skill was 2,329 characters.

**The open question it raised.** Is that mass load-bearing, or scaffolding?

### 1.2 The process cost more than the work it governed

**Observed.** On one real slice, forming the paperwork took **209.7 minutes**
against **3.7 minutes** of work, and the slice consumed **36 review rounds**. The
pipeline was reshaped from a chain into loops afterwards, and five rules from the
first real runs landed — but the prose surface did not shrink.

**Why it matters.** Cost is not incidental here. It is the thing most likely to
make the product unusable, and it is the counter-argument to every proposal that
answers a problem by adding a stage or a rule.

### 1.3 The controlled experiment: 182 lines reproduced the results

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
   maintenance. Those are gone; see §4, Phase A, for what replaced them.

**Honest limits (unknowns, not conclusions).** n = 3, all with known answers.
Genuinely exploratory work — the shape AE ultimately serves — was **not** tested.
The experiment consumed this repository's existing check infrastructure; in a
repository without such checks the same 182 lines would have less to bite with.
The baseline is historical run data, not a same-item head-to-head. And the runs
were observed, not unobserved.

### 1.4 A programmed rule nothing calls is not a rule

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

### 1.5 The host enforces less than a workflow needs

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

## 2 · What the minimum is

The delete was executed as a **factoring**, not a purge: the core contracted, the
satellites left, and the prose that described coordination went with the
coordination.

### 2.1 What is in the tree today

| | Before | Now |
|---|---|---|
| Skills | 24 | **6** |
| Lines of skill prose | 8,457 | **779** |
| Longest single line in a skill | 2,329 chars | **411 chars** |

The six:

| Skill | Lines | What it is |
|---|---|---|
| [`go`](../plugins/ae/skills/go/SKILL.md) | 137 | The entry. The stage order, the rules every stage obeys, and the two human stops. It invokes the stage skills rather than restating them. |
| [`analyze`](../plugins/ae/skills/analyze/SKILL.md) | 146 | Is the problem real, and what does *done* mean? Creates the feature directory, the analysis and the acceptance criteria. |
| [`discuss`](../plugins/ae/skills/discuss/SKILL.md) | 351 | Settles one contested decision into a record the plan can consume, using seats from more than one model family. |
| [`plan`](../plugins/ae/skills/plan/SKILL.md) | 39 | Cuts dependency-ordered steps against criteria already signed, and names the check each step turns red. |
| [`work`](../plugins/ae/skills/work/SKILL.md) | 58 | One step, one commit, every check seen failing first. |
| [`review`](../plugins/ae/skills/review/SKILL.md) | 48 | Judges the delivered work against the frozen criteria. The completion gate. |

Alongside them: 18 agent definitions, two bundled MCP servers, and five scripts
under `plugins/ae/scripts/` — every one of which now has a live caller: the
session-start probe and its family-table reader, the Codex seat runner, the
composite check the discuss stage runs, and the skill-frontmatter check.

### 2.2 What was kept, and on what grounds

- **The two human gates and the deliverable-on-disk rule** — the experiment's
  finding was that these, not the prose, were carrying the control.
- **The executable checks** — the measured capital. They now get an execution
  path in review rather than a prose instruction to run them.
- **Cross-family seats** — kept for a documented reason, not as polish:
  self-preference and same-family bias in model-as-judge are established in the
  literature ([`references/cross-family-rationale.md`](references/cross-family-rationale.md)).
  What went is the coordination protocol that had grown around them.
- **The close-out readers** — four deliberately-designed adversarial prompts.
  Their value was in the prompts; see §3.6 for the gap they currently sit in.

### 2.3 What left, and where it went

The coordination protocol, the telemetry layer, the knowledge graph, the
project-management surfaces and the ad-hoc tools were removed from the plugin
along with the documents that described them. The prose case law is not
destroyed: it is in git history, and a rule returns **only as structure or spec
when something real hits it again**.

### 2.4 The asymmetry worth noticing

`discuss` is 351 of the 779 lines — **45% of all remaining prose in one stage**.
That is not an oversight, and it is not a virtue either. It is the only stage
that has been run repeatedly by sessions that did not write it, and every one of
those runs added something. The other three working stages total 145 lines and
have had no such treatment. §3.1 is the direct consequence.

---

## 3 · What is known to be missing

Each item below was **observed**, not predicted. They are the input to the
roadmap in §4.

### 3.1 Three of the five stages have never been run closed-book

**Plain-language version.** A skill is evaluated by having a session that did not
write it execute it from the file alone. Only one stage has had that.

**Observed.** `discuss` was run six times by fresh sessions given nothing but the
skill. Those runs produced five genuine defects and two rule ambiguities.
`plan` (39), `work` (58) and `review` (48) — 145 lines together — have no
contract test and have never been run this way.

**Next step.** Take feature directories that already hold an analysis and signed
criteria, open fresh sessions, and run `plan` and `review` twice each with no
hints beyond the skill file. Cost is far below a discuss run: no seat rounds.

**Purpose.** There is no reason to believe the untested three are cleaner than
the tested one. Hardening the loop before running them is hardening an untested
foundation.

### 3.2 A rule off the execution path is not followed

**Plain-language version.** Where a rule sits in the file decides whether it is
obeyed — more than how clearly it is written.

**Observed.** One requirement sat 199 lines away from the paragraph where the
executor acts. Across two features and twelve produced files it was followed
**zero times**. Four rules written *inside* the acting paragraph were followed
**6 of 6** across six independent executions — same model, same file.

**The rule this yields.** Default to **prevention over checking**: if a rule can
only be caught after the fact, it is probably in the wrong place. Ask first
whether the executor can see it at the moment it acts; add a check second.

### 3.3 Nothing on disk says how far a run got

**Plain-language version.** The workflow's resume story exists only in the
conversation.

**Observed.** An analysis naming three questions should produce three discussion
runs; the only thing driving that loop is the running agent remembering how many
are left. Nothing on disk says "three named, one settled, two outstanding". A
compaction or a restart loses the count with no signal. Partial states — a stage
stopped midway, a seat that never returned, a synthesis written but not frozen —
have no defined appearance on disk either.

**Next step.** Define the re-entry contract: a session that has never
participated, given only the feature directory, must be able to say **where the
run got to, what happens next, and which artifacts are not trustworthy.**

**Purpose.** This is a hard prerequisite for running stages in separate sessions —
once a stage runs elsewhere, disk is the *only* channel left.

### 3.4 The entry can be re-derived instead of invoked

**Observed.** The entry's own opening rule is that a stage's behavior lives in
that stage's skill and must be invoked, not re-derived. In an observed run, the
entry loaded and the analyze stage was then executed from what the session
remembered — the stage skill was never read. **The output was correct, which is
the problem:** nothing distinguishes an invoked stage from a reconstructed one.

### 3.5 The acceptance criteria have no non-author reader

**Observed.** The ground rule "the author of a thing never reviews it alone" is
honored for the plan (a reader who did not write it) and for the delivered work
(review is fresh eyes). It is skipped for `acceptance.md` — written by the
analysis, then signed. That file is the standard everything downstream is judged
against, and the signature freezes it. It is the highest-leverage artifact in the
workflow and the only one that reaches a human unargued-with.

### 3.6 The agent definitions describe a world that moved

**Observed.**

- The four adversarial close-out readers are reached from exactly one place: the
  third round of the discuss stage. No other stage has a close-out at all, and
  whether that is right has never been decided — it is where they happened to
  land.
- Three frontmatter fields were set across the definitions that appear in no
  published list of supported fields and are read by nothing — one of them
  measured absent from a spawned agent's context entirely. All three are gone
  now, and a suite check fails if any returns. They came in together from an
  external agent collection, were classified as *tolerated* on import, and were
  then promoted to a prescribed pattern and copied across thirteen files.
- Parts of the definitions still describe a coordination layer whose behavior has
  changed underneath them.

### 3.7 The relay contract is verified for one family only

**Observed.** The OpenAI seat now runs its backend as a subprocess it owns and
refuses to certify a turn it cannot back with a file. The other two seats carry
the same relay contract with **no artifact independent of the relaying agent** —
undocumented and untested, rather than measured to be sound. Separately, nothing
in the workflow currently notices a seat citing `file:line` for text that is not
there.

### 3.8 The process artifacts have no remote

**Observed.** Feature directories, backlog and discussion records are gitignored
local state. This has already cost a full loss once, when a machine went. The
requirement was never "do not version-control it" — it was "not on the public
remote", which is a statement about *which* remote.

---

## 4 · The roadmap

Ordered by dependency, not by appeal. Each phase names what unblocks the next.

### Phase A — run what was never run *(prerequisite for everything after it)*

Run `plan`, `work` and `review` closed-book, at least twice each, and fix what
falls out.

**Closed-book means: a fresh session, given only the skill file and the work
item, with no hint about the rules it is supposed to follow — driven by a second
session that watches what it does and writes down where it went wrong.** That
pairing is the evaluation method, and it is the one that has actually produced
findings: six such runs of the discuss stage yielded five genuine defects and two
rule ambiguities, against zero from any scan over the same files. It also costs
far less than it sounds for these three stages — no seat rounds.

**Unblocks:** any change to the working loop. **Why first:** §3.1 and §3.2 — the
one stage that got this treatment was changed substantially by it, and the
placement rule from §3.2 can only be applied to stages whose real failures are
known.

### Phase B — the re-entry contract on disk

Give the feature directory enough structure that a fresh session can state
position, next step and trustworthiness (§3.3). Includes the loop counter that
currently lives only in conversation. **Unblocks:** running any stage in its own
session or in the background; also makes §3.4 detectable, because an invoked
stage and a reconstructed one would leave different traces.

### Phase C — the agent definitions

The dead frontmatter fields are gone; what remains is to decide whether the four
close-out readers belong anywhere besides the discuss stage, and to bring the
definitions back in line with the host behavior they assume (§3.6).
**Depends on:** nothing;
**scheduled after B** only because B changes what a stage hands its agents.

### Phase D — extend the relay guarantee

Give the remaining seats an artifact independent of the relaying agent, or state
plainly in the record that they have none (§3.7). Compare against the vendor's
own runtime for the same CLI before writing more of our own.

### Phase E — the criteria get a reader

Put a non-author reader in front of `acceptance.md` before the signature (§3.5).
Held behind A because the human gate's real failure modes should be observed in
the closed-book runs first.

### Standing, not phased

- **Back up the process artifacts** to a private remote (§3.8). Independent of
  everything above; the only reason it is not Phase A is that it changes no
  shipped behavior.
- **The counters**, re-measured on any change to the prose surface:

| Goal | Counter | At the delete | Target |
|---|---|---|---|
| The prose surface shrinks | Total lines across `plugins/ae/skills/*/SKILL.md` | 779 (from 8,457) | falling, or a stated reason |
| No rule is unreadable | Longest single line in any `SKILL.md` | 411 (from 2,329) | falling |
| A person waits for a signature, never a repair | Times the process pulled a person in to finish work it did not finish | — | zero |

### Deferred, with the condition that would unfreeze each

| Deferred | Unfreezes when |
|---|---|
| The Kernel — `git checkout v1-kernel-archive`, which holds it whole | A named observed event requires it — an acceptance that was wrongly granted, or a second party that can call AE's completion path. Not before. |
| Project-management surfaces | Never inside this scope; they belong to a separate plugin if wanted at all. |
| A knowledge graph | Never within this scope. No path to acceptance may depend on it. |
| A machine interface for external agents | Out of scope. Named so its absence is a decision rather than an omission. |

---

## 5 · What this rebuild does not claim

- **It cannot establish that a model followed prose.** It can establish that a
  rule cannot be silently dropped, and that a command ran and what it returned.
  No surface may imply more.
- **The experiment behind it is n = 3, all with known answers.** Exploratory work
  remains the untested case and the next benchmark.
- **The measured host semantics are version-specific.** Re-measure before making
  any of them load-bearing.
- **This is not a 1.0.** The version gate is evidence that the loop holds on work
  nobody knew the answer to in advance — not a branch name and not a line count.

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
