---
title: "PRD: AE v1"
status: draft
created: 2026-08-28
target: ae@1.0.0
---

# AE v1 — product requirements

> **Status amendment (2026-08-28).** Two parts of this document are overtaken
> by recorded decisions. **G-02** (the Kernel is reachable — "the highest-value
> work in v1") is superseded: BL-224's signed decision archived the Kernel as
> proven-but-unconsumed, and F-088 is abandoned at 2 of 5 steps. **§6's fence**
> is being executed as a factoring — core kept, satellites extracted, prose
> deleted — per [`../v1/x-experiment.md`](../v1/x-experiment.md). The users,
> jobs, and remaining goals stand.


> **AE v1 is not released.** This document states what v1 is *for*, who it
> serves, and which shipped capabilities are deliberately outside it. It holds
> no design or implementation authority: where it appears to contradict
> [`design.md`](../v1/design.md) or
> [`implementation-plan.md`](../v1/implementation-plan.md) about what v1 *is* or
> how it is *built*, those are current and this document is wrong.

## What this document is

The `docs/v1/` set answers four questions and left a fifth without a home:

| Document | Question it answers |
|---|---|
| [`design.md`](../v1/design.md) | What is AE v1, and what does the Kernel guarantee? |
| [`implementation-plan.md`](../v1/implementation-plan.md) | How does it get built, in what order? |
| [`acceptance.md`](../v1/acceptance.md) | What would have to be true to call v1 released? |
| [`mechanism-disposition.md`](../v1/mechanism-disposition.md) | Which older *mechanisms* are kept, simplified, deferred, or removed? |
| **this document** | **Who is v1 for, what job does it do for them, and which shipped capabilities are deliberately outside it?** |

Three things had no home before this file, and each is a product decision rather
than a design one:

1. **Users and their jobs.** `design.md` §1 defines v1 as "a workflow product for
   running non-trivial engineering work through Claude Code" without naming who
   runs it or what they are hiring it to do.
2. **A capability fence.** `design.md` §11 rules out *architecture* — Loom, a
   host-neutral runtime, an agent-graph DSL — and then lists limits a user should
   expect. Neither half says which of the 24 skills the plugin already ships,
   8,457 lines of prose, v1 is answerable for.
3. **Quality goals with counters.** `acceptance.md` §2 states "a small task stays
   small" as a property of a flow. Nothing measures it.

## 1. Product summary

AE v1 is a workflow product for running non-trivial engineering work through
Claude Code, built so that **"done" means something a human actually agreed to**.

Its distinguishing claim is narrow and negative:

> **AE v1 does not report work as accepted unless a deterministic Kernel
> recomputed that it was** — not because an agent said so, not because a task
> panel reads `completed`, and not because a command exited 0.

Every other part of the product exists to make that claim affordable to a person
doing ordinary work.

## 2. The problem, stated from evidence

### 2.1 The completion rules are already programmed. Nothing reaches them.

The natural diagnosis of the AE plugin is that its process rules are Markdown
instructions and prompts — natural-language suggestions rather than observable
program behavior. **That diagnosis is now out of date, and acting on it would be
expensive.**

`plugins/ae/v1/` contains a deterministic Kernel: 25 frozen record kinds, four
persisted objects, an append-only ledger, a Gate whose vocabulary separates
`passed` from `pending` from `unavailable`, and a completion path that refuses
with a distinct named code for each way an acceptance can be unearned. Its suite
is 507 assertions, and its mutation script fails when a planted defect survives.

The defect is not that the rules are prose. It is that **nothing calls the code**:

| Observation | State |
|---|---|
| `plugins/ae/v1/bin/` | empty — no entry point exists |
| `new Kernel` / `v1/lib/kernel` / `obtainReview` across `skills/`, `scripts/`, `agents/`, `templates/`, `plugin.json` | no call sites |
| `plugin.json` hook registrations | `SessionStart` (cross-family check), `SessionEnd` (trace rotation) — neither reaches the Kernel |

A programmed rule with no entry point and no rule at all are the same thing to a
user. **G-02 exists to close exactly this gap, and it is the highest-value work
in v1** — every other Kernel capability compounds behind it.

### 2.2 The host enforces less than a workflow needs

Measured against Claude Code **2.1.247** with plugin-level command hooks, in
non-interactive mode with foreground subagents:

| Mechanism | Enforcement |
|---|---|
| `PreToolUse` exit 2 | **Hard refusal** — the side effect does not happen |
| `PreToolUse` exit 1 | **Fail-open** — a validator that errors permits the call |
| `PreToolUse` timeout | **Fail-open** — the call proceeds after the configured timeout |
| `PostToolUse` `decision: block` | Feedback only — the side effect has happened, and the next turn may ignore it |
| `TaskCompleted` exit 2 | **Blocks host task state** — the task reads back `pending` |
| `SubagentStop` exit 2 | The **same** worker retries; the rework decision does not return to the caller |

Two consequences bind the product:

- **A hook cannot be the acceptance boundary.** Three of the six paths above are
  advisory or fail-open. Acceptance has to be recomputed by the Kernel from
  durable records, which is what `design.md` §3 already specifies.
- **The CLI exiting 0 says nothing.** Every scenario above ended with the process
  reporting success, including the two that refused a tool call. So: *process
  success ≠ tool success ≠ deliverable accepted ≠ feature complete.* A hook
  firing is likewise not evidence of a state transition — a host task update that
  returned a business failure still fired its `PostToolUse`.

This bounds every goal in §4. It is host semantics, not an AE defect, and it is
version-specific: re-measure before relying on it. The durable form of this table
is [`cc-plugin-contract.md`](../references/cc-plugin-contract.md).

### 2.3 The process costs more than the work it governs

BL-217 records the measurement: on the F-086 slice, forming the paperwork took
209.7 minutes against 3.7 minutes of work, and the slice consumed 36 review
rounds. The pipeline has since been reshaped from a chain into loops, and five
rules from the first real runs landed (BL-220) — but the prose surface has not
shrunk. It is 24 skills and 8,457 lines, and the single densest line in the
review skill is 2,329 characters (BL-221).

**The cost is not incidental to the product; it is the thing most likely to make
v1 unusable.** G-04 is therefore a goal with counters, not a sentiment.

## 3. Users and jobs

### 3.1 The engineer running work through AE — primary

Hiring AE to take a non-trivial change from intent to a completion they can
trust, without reading every intermediate artifact. Their jobs:

- state an intent and receive an exact Contract to accept, edit, or reject;
- watch the work happen and intervene when it goes wrong;
- read findings and see what was done about each;
- see a status that was **computed**, not asserted;
- give or withhold the final sign-off.

This is `acceptance.md` §2's user-observable flow. **Not one step of it is
reachable today** — there is no entry point (§2.1).

### 3.2 The contributor developing AE with AE — primary

AE develops AE; this is the default working mode. This user hits every rough
edge first, and their evidence is what the whole design rests on. Their job is to
run real work through the pipeline and have what it costs and catches be
recorded rather than remembered.

**This user's evidence bounds v1's claims.** Of seventeen backlog items examined
during F-086's dogfood, **two could be gated by a command at all**; the rest
change prose rules meant for a model to follow, or are design judgements, and no
command establishes that a model followed a rule. v1 does not claim otherwise.

### 3.3 A coding agent calling AE — **not a v1 user**

An agent wanting deterministic machine access to AE state has no path in v1: there
is no machine interface, and building one is not v1 scope. Named here so its
absence is a decision rather than an omission. See §9.

### 3.4 The maintainer

Wants to change node semantics, agent definitions, or cross-family wiring without
every component coupling to one another. Served by `design.md`'s boundaries; this
document adds no requirement for them.

## 4. Goals

### G-01 — Completion means a human agreed

A run reaches accepted only when the Kernel recomputes, from durable records,
that every obligation was met and a human signed. **Evidence:** `acceptance.md`
§3's eight false-pass cases (K1–K8) each fail closed with a typed reason.

### G-02 — The Kernel is reachable

At least one entry point exists through which a real change can be walked from
Contract to Acceptance, and AE's own status surfaces read that result rather than
asserting their own.

**Evidence:** with a review missing, bound to a superseded deliverable, or with
the checking process failing, no valid Acceptance is produced and no surface
displays the work as accepted — *even when the process exits 0 and the agent
reports done*. The successful path writes and displays normally.

**This is the gap in §2.1 and the highest-priority goal in v1.**

### G-03 — Harden what can be programmed; shrink what cannot

Two halves of one cut, because §2.2 says the host will not enforce prose:

- **Harden:** the acceptance boundary (Kernel) and the deliverable-interception
  point (`SubagentStop` can capture a subagent's raw output and apply a
  deterministic structural check before the caller paraphrases it).
- **Shrink:** everything reachable only by asking a model to follow prose. A rule
  that cannot be checked earns its place by being short, or it does not earn it.

**Non-obvious consequence:** "strengthen the Harness" cannot mean adding stages
or rules. Under §2.2 that buys cost without control.

### G-04 — A small task stays small

`acceptance.md` §2 already states this. G-04 gives it counters (§8) and makes a
regression visible.

### G-05 — One authority for "done"

Exactly one thing decides completion, and every surface reads it. A markdown
`status: done`, a host task panel, and an agent's closing sentence are not
independent completion evidence and must not be displayed as such.

## 5. Scope of the v1 release

Release criteria are [`acceptance.md` §1](../v1/acceptance.md#1-release-criteria)
and are not restated here. This document adds no release criterion; it constrains
what may be *worked on* before them.

## 6. The capability fence

The plugin ships 24 skills. v1 is answerable for some and not others. Dispositions
use `mechanism-disposition.md`'s vocabulary, and follow its rule: **nothing carries
forward by default, a `defer` names its unfreeze condition, and a `remove` states
its reason.**

| Group | Skills | Lines | Disposition |
|---|---|---|---|
| **Harness core** | `analyze` `plan` `plan-review` `work` `review` `discuss` `next` `status` | 3,794 | **keep + simplify** — on the completion path; the surface shrinks under G-03/G-04 |
| **Agent Teams reference** | `agent-teams` `agent-selection` | 1,159 | **simplify** — consumed by the core, and the largest single block of unchecked prose |
| **Project management** | `backlog` `roadmap` `dashboard` `retrospect` `plugin-stats` | 1,086 | **defer** |
| **Knowledge** | `knowledge-refresh` (with `.ae/graph`) | 301 | **defer** |
| **Ad-hoc tools** | `setup` `test-plugin` `consensus` `code-review` `think` `trace` `team` `testgen` | 2,117 | **defer** |

Unfreeze conditions for each `defer`:

| Group | Unfreezes when |
|---|---|
| Project management | **G-02 lands.** `dashboard` and `next` display completion and must then read the Acceptance rather than asserting from markdown state. That migration is in scope; nothing else in the group is. |
| Knowledge | Never within v1. `acceptance.md` §6's six non-authority properties must hold at release against whatever knowledge surface exists; that is a constraint on the group, not an invitation to extend it. |
| Ad-hoc tools | No condition. Held as-is: not extended, not deleted, fixed only when one blocks a Harness-core path. |

`defer` here means **not extended and not invested in**. It does not mean removed,
and nothing in this table authorizes deleting a shipped skill.

## 7. Non-goals

Architecture non-goals and the product limits a user should expect are
[`design.md` §11](../v1/design.md#11-non-goals-and-deferred-work) and are not
restated. What follows is the capability level, which §11 does not reach. v1 will
not:

- **NG-01 — Build a project-management product.** Sizing, roadmaps, portfolio
  views, and cross-feature planning are outside v1 regardless of what `roadmap`
  and `dashboard` already do.
- **NG-02 — Require a knowledge graph.** Knowledge holds no authority
  (`acceptance.md` §6) and no path to acceptance may depend on it.
- **NG-03 — Ship a machine interface for external agents.** See §3.3.
- **NG-04 — Make the host enforce the workflow.** §2.2 measured what it will do.
  v1 designs for a host that reports, not one that obeys.
- **NG-05 — Claim that a rule was followed.** v1 can establish that a rule cannot
  be silently dropped (a presence test) and that a command ran and what it
  returned. It cannot establish that a model followed prose, and no surface may
  imply it did.

## 8. Quality goals and their counters

Each counter is measured before and after a change to the Harness surface. All
three exist today and need no new mechanism.

| Goal | Counter | Target |
|---|---|---|
| A person waits for a signature, never a repair | Repair-interruptions: times the process pulled a person in to complete work it did not finish (BL-220 rule 3) | **zero** |
| The prose surface shrinks | Total lines across `plugins/ae/skills/*/SKILL.md` | below 8,457 and falling |
| No rule is unreadable | Longest single line in any SKILL.md | below 2,329 and falling |

**What these do not measure.** None is a proxy for whether the process caught
anything. AC-9's cost arithmetic compares one run's formation against one run's
work and never looks at review, so it can report "the process paid for itself"
about a slice that took 36 rounds (BL-218 #2). Counting review by rounds is the
recorded recommendation and remains undecided.

## 9. Relationship to AE Next

AE Next is a separate seed specification for a standalone workflow runtime with
its own control plane, artifact store, agent gateway, TUI, and machine interface.
It is not this product and does not supersede it.

Two boundaries matter while both exist:

- **v1 already holds the acceptance semantics.** The record kinds, the Gate
  vocabulary, authority attenuation, and the freeze are built and frozen here.
  A second implementation re-derives them, and re-derivation is how the five
  structural defect families F-086 named come back — relations reconstructed by
  searching, cost measured with the wrong meter, coverage aliasing, premature
  stabilization, and lost grant attenuation.
- **What v1 does not hold is run lifecycle and recovery.** Interruption,
  restart, and resume across sessions are unmeasured here and unbuilt. This is
  where a separate runtime earns its place, and `acceptance.md` H2 — state
  reconstructing after coordination state is lost — has no evidence of any kind
  today.

**v1 does not wait on AE Next, and AE Next does not wait on v1's release.**

## 10. Open decisions reserved for the Human Owner

Reserved because a model must not settle them, stated in the words that reserve
them where those words exist.

| # | Decision | Where it is reserved |
|---|---|---|
| ~~1~~ | ~~The §6 fence: are these five groups' dispositions and unfreeze conditions accepted?~~ **Accepted 2026-08-28 by the Human Owner.** §6 is in force: the five dispositions and their unfreeze conditions govern what may be worked on. | Recorded here; no prior record existed |
| 2 | AC-2's shortfall — nothing establishes that a command *read* the files a Contract names. Waived for v1; the criterion is to be rewritten against experience | `F-086` shortfalls decision |
| 3 | AC-5's shortfall — identity at the root is a string, not a principal. Accepted as stated while the Kernel runs in the Owner's own session | `F-086` shortfalls decision |
| 4 | Whether review cost is counted by rounds or by wall-clock per round | BL-218 #2 — recommendation recorded, not decided |
| 5 | Remaining items | [`acceptance.md` §7](../v1/acceptance.md#7-open-items-for-the-human) |

Decisions 2 and 3 are recorded here because they bound what v1 may claim, not
because this document reopens them.
