# AE v1 — consolidated design

> **Status:** current design source for AE v1. Not a release announcement, not
> an acceptance record, and not evidence that any part of v1 is implemented.
>
> Supersedes the per-branch design authorities listed in
> [`branch-disposition.md`](branch-disposition.md). The archived specification
> under [`../references/finalized/`](../references/finalized/) is a design input
> and audit record from here on, not the current plan.

## 1. What AE v1 is

AE v1 is a workflow product for people who run non-trivial engineering work
through Claude Code and cannot afford to find out later that "done" was a model
saying so.

It answers one question honestly: **did this work actually satisfy what the
human agreed it had to satisfy?**

Four components on the completion path, and one beside it:

```text
                         Knowledge Feedback
                    learns, proposes, holds no authority
                                  │
                                  ▼
Human Intent → Contract Formation → Workflow Harness
                                      │
                         ┌────────────┴────────────┐
                         ▼                         ▼
              Claude Code Agent Teams          agent-proxy
              lead / work / QA / review    optional cross-family seat
                         └────────────┬────────────┘
                                      ▼
                                    Kernel
                         Contract / Evidence / Gate
                                      │
                                      ▼
                         accepted / rejected / rework
```

- **Contract Formation** turns intent and repository facts into an exact,
  human-confirmed statement of what counts as correct.
- **Workflow Harness** is where the user spends their time: it runs the work
  across Claude Code Agent Teams and carries meaning between the seats.
- **agent-proxy** is an optional transport that puts a different model family in
  one seat when the Contract asks for it.
- **Kernel** is the small, boring, deterministic part that decides whether the
  finished work is admissible.

And off the path:

- **Knowledge Feedback** learns from completed work and proposes. It is a fifth
  component, deliberately drawn above the chain rather than inside it, because
  nothing it produces may reach a Contract or a Gate except through a human
  decision (§6). Counting it among the four would suggest it participates in
  deciding completion. It does not.

The value proposition is the Harness. The credibility of that value is the
Kernel. Everything else in v1 exists to serve one of those two.

### 1.1 What v1 is not

AE v1 is not a fixed `analyze → discuss → plan → work → review` command chain.
Those commands are controllers and views over the loop; they are not the
definition of completion, and none of them is mandatory for a small task.

AE v1 is not a general multi-agent orchestration framework. It does not own
scheduling, placement, or transport. Agent Teams, subagents, fan-out, TDD, and
cross-family seats change *how* work is performed; they cannot change *what
counts as complete*.

## 2. Trust boundary

State the boundary before the mechanisms, so the mechanisms can be judged
against it.

> **The Kernel makes unauthorized change detectable, and stops tampered,
> over-reaching, or under-evidenced work from being accepted.**

It does **not** claim:

- protection against a malicious process running as the same OS user, which can
  edit the repository, AE state, the runtime, and Git history together;
- that a digest proves a business judgment is correct — a digest proves which
  bytes were reviewed, not that the review was right;
- that AE can manufacture host, backend, or model-family proof when no external
  producer supplied one;
- that v1 has qualified every filesystem, mount, power-loss, cache, and session
  condition;
- that AE replaces the human decision about material scope and risk.

Human approval is `workflow_attested`: the digest proves which content was
accepted, not who the actor was. AE claims a verified principal only if a host
arm supplies an independently verifiable credential, and v1 assumes none does.

Two consequences follow, and they are load-bearing throughout this document:

1. **Detection, not prevention.** AE's guarantees are about admissibility of
   evidence, not about isolating processes. Where isolation is genuinely
   required, that is a qualification problem deferred to
   [V5](implementation-plan.md#v5--earned-hardening), not something v1 asserts.
2. **Fail closed on absence.** Missing, contradictory, over-reaching, or stale
   evidence is never read as success. `unavailable` is a visible state a human
   resolves, not a silent downgrade.

## 3. The Kernel

The Kernel is the deterministic part. It holds three things — Contract,
Evidence, Gate — and one writer.

### 3.1 What the Kernel guarantees

| Guarantee | Meaning |
|---|---|
| Contract identity | The exact revision that was approved is the revision that execution is judged against. A running workflow cannot silently change the question. |
| Evidence binding | Every piece of evidence names the Contract, task, attempt, producer, and artifact it belongs to. Unbound evidence is inadmissible. |
| Authority binding | A role cannot acquire authority it was not assigned by passing a message that claims it. Reviewer verdicts come from reviewer seats; completion comes from the completion writer. |
| Closed rework chain | Review → finding → disposition → re-review → approval forms a chain with no unaccounted gaps. An open finding blocks acceptance. |
| Deterministic Gate | Status is computed from accepted facts by a pure reduction. The Gate calls no model, picks no agent, and chooses no retry policy. |
| Fail-closed defaults | Absent, contradictory, over-reaching, or stale input yields a typed non-pass status, never a pass. |
| Single completion writer | Exactly one component writes lifecycle completion. Review, QA, and the Harness cannot. |

### 3.2 Evidence and non-vacuity

An exit code of zero is a process fact, not a proof. It becomes evidence only
when the Contract selected that command, the run is bound to the Contract
revision and the source it observed, and the observation is non-vacuous — the
subject was actually exercised. Zero discovered tests exiting successfully is a
failure to produce evidence, not a pass.

Similarly, schema-valid judge output proves shape, not truth. A judge's claims
must be traceable to observations and references it was actually given.

### 3.3 Independence

AE distinguishes three properties that are routinely conflated:

- **context independence** — the judge did not inherit the implementer's
  narrative;
- **responsibility independence** — the producer of a material claim is not the
  sole authority that passes it;
- **source independence** — a different model family or backend, required only
  when the Contract says so, and proven by correlated invocation evidence.

Opening more agents satisfies none of these by itself. A second instance of the
same lineage is not cross-family evidence, and "I am independent" in model
output is not evidence of independence.

### 3.4 Gate status vocabulary

The Gate reports, at minimum:

| Status | Meaning | Who acts |
|---|---|---|
| `pending` | No admissible evidence yet. | Implementer/QA produce it. Absence is never a pass. |
| `passed` | The selected attempt satisfies the obligation. | Check the remaining obligations. |
| `failed` | An admissible observation falsifies the obligation. | Fixer, then a new attempt. |
| `invalid` | Evidence exists but violates schema, binding, authority, or non-vacuity rules. | Fix the evidence path; amend only if the recipe itself is wrong. |
| `unavailable` | A required capability cannot be used. | Human decides: wait, restore, degrade by amendment, or stop. |
| `stale` | The observation no longer matches the active Contract or source. | Re-run against current bytes; the old event stays in history. |

`retry`, `replan`, and `human_required` are Harness decisions, not Gate
statuses. The Gate says what is true; the Harness decides what to do about it.

### 3.5 What the Kernel deliberately does not hold in v1

The Kernel is small on purpose. These were considered and are **not** v1 Kernel
responsibilities — see [`mechanism-disposition.md`](mechanism-disposition.md)
for each decision and its reason:

- crash-recovery machinery for interrupted finalization beyond ordinary
  no-clobber write safety;
- provider/host qualification catalogs;
- rollout, migration, and legacy-reader machinery;
- a schema set beyond the objects the first vertical slices actually produce and
  consume;
- any mechanism whose purpose is to prove that the proof system itself is
  trustworthy.

## 4. The Workflow Harness

The Harness is the product. It is built **on** Claude Code Agent Teams rather
than beside them: AE does not implement spawning, task lists, mailboxes, or
session lifecycle, because the host already does.

What AE adds is the part the host does not have — **semantic handoff**. Agent
Teams moves messages between sessions; AE decides what each seat is allowed to
see, what it owes back, and what its output means.

### 4.1 Responsibilities

The Harness:

1. forms and presents the Contract from intent;
2. creates the Team, its tasks, and their dependencies;
3. launches Agent Sessions with independent context where independence is
   required;
4. assigns lead, implementer, QA, reviewer, and fixer seats;
5. controls exactly what input each seat receives and what it may change;
6. collects raw output, code, test results, and Evidence Packages;
7. routes each review finding back to the seat that must act on it;
8. manages rework and re-review until findings are dispositioned;
9. requests the human's final sign-off once mechanical checks pass.

**These are not all the same kind of obligation, and the host does not supply
them at one level.** Measured against Claude Code 2.1.247 with plugin-level
command hooks, the nine divide into three:

| Responsibility | Where it can hold |
|---|---|
| 6 — collect raw output before it is paraphrased | **A host hook.** `SubagentStop` receives a subagent's raw output before the calling session sees it, and a deterministic structural check there can refuse a malformed deliverable. |
| 1, 2, 3, 4, 5, 9 | **The calling session.** Nothing in the host performs them; they hold only while a session follows them. |
| **7, 8 — finding routing and rework** | **Neither, today.** Refusing a deliverable in `SubagentStop` makes the *same* worker retry; the choice between rework, a different reviewer, and a changed approach never returns to whoever should make it. Routing is a control loop AE must own, not a hook it can register. |

Two rules follow, and both are about not confusing the levels:

- **A hook does only short, deterministic, local checks.** Format repair may
  retry within the same worker under a bounded limit. Anything reaching a
  reviewer, another approach, or an earlier stage returns to the caller — and a
  worker must never be held at its exit waiting for a review the caller has not
  yet had the chance to arrange.
- **A hook is not a gate.** Of the host's refusal paths, only `PreToolUse`
  exit 2 and `TaskCompleted` exit 2 refuse anything; a hook that errors or times
  out permits the call, and a `PostToolUse` refusal arrives after the side effect
  and may be ignored. The enforcement table is in
  [`cc-plugin-contract.md`](../references/cc-plugin-contract.md); it is
  version-specific and re-measured, not assumed.

This is why §3 puts acceptance in the Kernel rather than in the Harness: the
Harness can be wrong or skipped, and a completion decision must survive that.

### 4.2 Coordination state is not truth

This is the single most important rule in the Harness:

> Claude Code task status, mailboxes, and teammate messages are **coordination
> state**. They may be retried, lost, reordered, or reconstructed. A durable
> semantic handoff must land in a project artifact or an explicit canonical
> record.

A task marked completed, a mailbox message saying "done", a `/goal` report, or
a teammate's summary is never completion truth. If losing the Team's message
history would lose the meaning of the work, the handoff was not durable and the
Harness is wrong.

**Nor is the fact that a call happened.** A host task update that returned a
business failure still fired its `PostToolUse` hook, and the process still exited
0. So an observer must parse what the call returned and read the state back;
that a hook ran, or that the process succeeded, establishes neither. Stated as
the chain it breaks: *process success ≠ tool success ≠ deliverable accepted ≠
feature complete.*

### 4.3 Topology is chosen, not defaulted

Complexity must be earned. The Harness picks the smallest topology that the task
geometry and the Contract's independence requirement allow:

| Situation | Topology |
|---|---|
| One context can do the work; no independent proof required | Solo |
| One independent, return-only question | Anonymous read-only subagent |
| Several independent read or validation questions | Read-only fan-out |
| Participants must exchange evidence or test competing hypotheses | Agent Team |
| Required capability or decision authority is absent | Human boundary |

A review panel is not a default. Parallelize research and evidence; serialize
product decision ownership.

### 4.4 One mutation owner

Exactly one seat owns product mutation for a feature at a time. QA and judge
seats hold no mutation rights; their raw results are captured by the Harness
rather than written by the seat. A researcher writes only to its own isolated
area, or nothing.

## 5. agent-proxy

`agent-proxy` is the existing cross-family bridge (Codex, Gemini, and the
generic OpenAI-compatible seat). It is already in the mainline; v1 does not
rebuild it.

**It is transport.** It owns:

- session invocation against another family's backend;
- exact input handoff and raw output capture;
- whatever provider/backend correlation the bridge can actually observe;
- honest reporting of failure and unavailability.

**It is not authority.** It does not:

- form or amend a Contract;
- decide whether Evidence is sufficient;
- present a *requested* field as an *effective* family proof;
- turn another model's reply into an accepted review by itself;
- write lifecycle completion.

The distinction between `requested`, `observed`, and `effective` identity is
preserved wherever each is available. A provider label is a request. What the
archive says the backend actually did is an observation. Only a correlated
observation supports an effective-family claim.

Which half is *exercisable* depends on whether a backend answers in that
particular run. When none does, only the `requested` half is observable: AE must
retain what the Contract asked for and claim nothing about an observation it
never made. The correlation from a populated `observed` to `effective` is
exercised only in a run where a provider answers — see
[`acceptance.md` X2a/X2b](acceptance.md#5-cross-family-criteria) for the
split and its owners.

### 5.1 Cross-family is risk-driven, not ceremonial

Cross-family review is a cost. The Contract selects it by risk:

| Contract risk | Review seat |
|---|---|
| simple | Same session, or one implementer plus deterministic checks |
| normal | Fresh Claude reviewer |
| high-risk | Independent Claude context |
| critical / explicitly declared | agent-proxy cross-family reviewer |
| capability unavailable | Report `unavailable`; the human waits, degrades by amendment, or stops |

A cross-family seat and a same-family seat return the **same** Review shape. AE
does not maintain a second workflow or a second Gate for cross-family work.

The table above is about *a user choosing* a seat, and that choice stays optional
and risk-driven. It is not about whether AE must **prove** the seat behaves. AE
ships a live cross-family capability, so proving it never passes off a request as
an observation is mandatory regardless of whether any **user's** Contract ever
selects it. The proof comes from a Contract the **Human Owner** commissions and
signs for that purpose — AE neither declares it nor approves it, for the reasons
in §7.2 — see [`acceptance.md` §5](acceptance.md#5-cross-family-criteria).

## 6. Knowledge Feedback

Knowledge is how AE gets better with use. It learns from completed work:

- which Contract obligations are routinely forgotten;
- which findings recur;
- which tests actually discover defects;
- which task decompositions and reviewer combinations work;
- which policies are worth proposing to tighten;
- what the work really cost in tokens, time, and rework.

**Knowledge holds proposal power only:**

```text
history → suggestion → review / human decision → future Contract or policy
```

It must never:

- modify an active Contract;
- satisfy an Evidence obligation;
- relax a Gate because "this usually passes";
- treat an agent's own summary as a learned fact;
- build an elaborate graph or automatic policy promotion before v1 has real
  usage data to learn from.

The existing `.ae/graph` corpus stays. It is outside the completion path.

## 7. Contract Formation

Formation is the upstream half that the earlier design left underspecified. The
Kernel is very precise about *which revision is authoritative*, and was silent
about *how that revision came to say what it says*. A Contract can be perfectly
proven and still be the wrong Contract, because a user constraint was dropped
during planning.

### 7.1 The failures formation exists to prevent

| ID | Failure |
|---|---|
| CF-01 | A user-stated material constraint disappears from the Contract. |
| CF-02 | A repository fact is inverted, over-generalized, or attributed to the wrong source. |
| CF-03 | A decision or trade-off from discussion is replaced by the planner's preference. |
| CF-04 | A rejected alternative silently returns as the implementation strategy. |
| CF-05 | A material unknown is hidden or relabeled immaterial so approval can proceed. |
| CF-06 | The planner invents a material criterion or scope expansion without presenting it as a proposal. |
| CF-07 | An intent item has no criterion, or a criterion has no falsifier, and coverage still passes. |
| CF-08 | Formation inputs change after review or approval, and the old result is reused. |
| CF-09 | A simple task is forced through unnecessary analyze/discuss/Team ceremony. |

CF-09 is on this list deliberately. Ceremony that does not pay for itself is a
product failure of the same kind as a lost constraint.

### 7.2 The rules

1. **One shared formation basis, carried by the Contract.** A single structure
   and a single human-readable view, reused by every skill that contributes to
   it — not one artifact family per skill, and not a sixth durable object. It is
   a section of the Contract, canonicalized and digested with it, so the trace
   survives context loss and approving the Contract approves the trace. CF-01…
   CF-08 are checkable only because of this; a formation record that lived
   beside the Contract could drift from it.
2. **Bidirectional trace.** Every material input is either carried into the
   Contract or given a visible, typed disposition; every material Contract
   statement derives from an input or from a visible agent proposal.
3. **The planner is a compiler, not the author.** It assembles, presents deltas,
   and asks. It does not decide what is material.
4. **The human owns the material boundary.** A planner may propose scope; it may
   never approve its own expansion or its own omission.
5. **Formation material is not Evidence.** A pre-Contract observation explains
   why the Contract says what it says. To close a proof, an observation must be
   captured after activation, bound to the active revision, by a producer with
   the authority to do so.
6. **Formation scales with the task.** A small, clear change forms its Contract
   inline in one session. Ambiguity, competing architectures, cross-cutting
   scope, material unknowns, or irreversible choices are what earn an explicit
   analyze/discuss/Team step. A command name is not proof that formation
   happened, and "this one is simple" is not a self-issued waiver of the trace
   properties.

### 7.3 Formation and proof are different phases

```text
Contract Formation:  observe → frame → deliberate → synthesize → challenge → approve
Proof Execution:     execute → observe → adjudicate → reduce → sign off
```

The phase name grants no authority. Before approval, everything analysis,
discussion, and planning produce is coordination material. Approval is the only
transition, and only a human performs it.

Silence, cancellation, an empty response, a note reading "approved", or a
hand-edited status field is not approval.

## 8. Roles and semantic handoffs

### 8.1 Roles

| Role | Owns | May not substitute for |
|---|---|---|
| Human Owner | Goal, Contract confirmation, material risk acceptance, final sign-off | Implementer, Reviewer, mechanical Gate |
| Team Lead | Contract drafting, task decomposition, role assignment, dependencies, status aggregation | The human's material decision; an independent Reviewer |
| Contract Author / Formation seat | Intent, facts, unknowns, alternatives, and the Contract trace | Human approval |
| Implementer | Changes within the assignment boundary; delivering an Evidence Package | The Reviewer; Contract amendment authority |
| QA | Running deterministic tests, reproducing failures, reporting raw facts | Semantic review; human sign-off |
| Reviewer | Independently checking artifact and Evidence against the Contract | An implementer passing their own work; silent Contract change |
| Fixer | Per-finding repair and recorded disposition | Deleting a finding; widening scope without an amendment |
| Kernel / Gate | Mechanical verification of binding and status | Business judgment; agent scheduling; the human's decision |

One Claude instance may hold several non-conflicting roles on a simple task.
When the Contract requires independence, a fresh session is mandatory, and an
implementer is never the sole reviewer of its own material claim.

### 8.2 The handoffs that must close

```text
Human Intent
   └─▶ Contract (approved revision, exact bytes)
          └─▶ Assignment (task, owner, boundary, Contract identity)
                 └─▶ Evidence Package (artifact + commands + raw results + deviations)
                        └─▶ Review (accepted | changes_required + typed findings)
                               ├─▶ Finding Disposition (per finding)
                               │      └─▶ new Assignment → re-review
                               └─▶ Gate (mechanical status)
                                      └─▶ Acceptance (human sign-off)
```

Each arrow is a durable artifact, not a message. If the Team's mailbox
disappeared, every arrow above must still be reconstructible.

**This is the forward spine, not the whole graph.** The return edges — what is
taken when, and what each one invalidates — plus a delivery contract per node,
stated as what the next node refuses it for, are in
[`node-contracts.md`](node-contracts.md). §10 below gives the rework conditions
in prose; that document gives them as edges.

## 9. Minimal durable objects

v1 defines only the objects the first vertical slices actually produce and
consume. Each must be justified by a real producer and a real consumer in the
slice that introduces it. Nothing here is frozen for the sake of future-proofing.

**`Contract`** — intent; scope and non-goals; acceptance criteria; required
Evidence; independence requirement — including, when it requires source
independence, the **`requested` family or provider identity**, which is the sole
authoritative source of that identity; final signer; **formation provenance**
(§7.2). The provenance travels inside the Contract rather than beside it: it is
the one shared formation basis, canonicalized with the Contract and covered by
the same digest, so approving a Contract approves the trace that produced it.

The `Assignment` carries the Contract's identity and **has no family field at
all**. Under the closed-schema rule, an Assignment carrying one is `invalid`
whether it agrees with its Contract or not — agreement today is a second source
tomorrow, and two sources for one fact is how the fact gets quietly changed.

Formation provenance is a **trace, not an authority**. It records what was asked
for and why; it does not supply the requested identity to dispatch or
adjudication. A provenance entry contradicting the Contract's own field is a
formation defect (CF-02) and makes the Contract `invalid` — it never becomes a
competing source.

**`Assignment`** — task ID; owner role/session; dependencies; allowed change
boundary; the exact Contract identity it serves.

**`Evidence Package`** — artifact/commit/diff identity; commands run and their
raw results; deviations; known risks; the identity of material inputs.

**`Review`** — `accepted` or `changes_required`; typed findings; the exact
Contract and artifact reviewed.

**`Finding Disposition`** — one of `fixed`, `rejected-with-reason`,
`human-accepted-risk`, `superseded-by-amendment`.

**`Acceptance`** — the exact Contract; the exact deliverable; the human's final
decision; and the accepted `Review` **where the Contract's independence
requirement called for one**.

A Contract that requires no independent review — the solo case — produces an
Acceptance that records *"no independent review required by this Contract"*, and
that statement is checked against the Contract's independence requirement. It is
a stated absence, never an unfilled slot: an Acceptance missing a review that the
Contract *did* require is `invalid`.

The same Review shape is used whether the reviewer is a same-family Claude seat
or a cross-family seat reached through agent-proxy.

## 10. Failure and rework semantics

| Situation | Resolution |
|---|---|
| Implementation does not satisfy the Contract | Back to Implementer/Fixer. The Contract does not move. |
| The Contract itself is wrong or missing a material requirement | Stop. Human amendment. A new revision is re-proven; an old pass is not carried forward. |
| Evidence is missing | The Assignment stays incomplete. Absence is not a pass. |
| A review finding has no disposition | Not acceptable. The chain is open. |
| Reviewer and Implementer disagree | The Lead states the disagreement; the human decides whether to amend or accept the risk. |
| Review passed but mechanical checks fail | No sign-off. |
| Everything passes | Still no completion until the human signs. |

Retrying the same locked recipe, changing implementation order, or adding a
temporary stricter check is not an amendment. Changing a criterion, a falsifier,
the observed source, the proof mode, or a required independence property is.

## 11. Non-goals and deferred work

**Not in v1, by decision:**

- Loom, or any external distributed execution and control plane;
- a portable, host-neutral AE runtime, or a native Codex frontend;
- a hosted or AE-owned durable state provider;
- a general agent-graph, Pattern DSL, or new reactive lifecycle commands;
- multi-writer scheduling, auto-merge, or a supported worktree merge protocol;
- Claude Code Dynamic Workflows as a required path;
- automatic promotion of knowledge into policy;
- a complete provider/host qualification matrix.

The v1+ hypotheses and their admission model live in
[`v1-plus-roadmap.md`](v1-plus-roadmap.md). Nothing there is a v1 requirement,
gate, or waiver, and nothing there may become a v1 blocker. Full item-by-item
reasoning for retained, simplified, deferred, and removed mechanisms is in
[`mechanism-disposition.md`](mechanism-disposition.md).

**Product limits a user should expect in v1:**

- one AE product-writing session per repository;
- support scoped to qualified Claude Code versions and invocation modes; unknown
  combinations report `unavailable` rather than degrading;
- cross-family proof improves one source-independence property; it does not
  prove the absence of correlated bias;
- an accepted feature is a statement that its Contract was satisfied at
  acceptance time, not a perpetual health claim about the repository today.

## 12. The seven questions this design must answer

Restated as a self-check, with the section that answers each:

1. **What does AE v1 solve for the user?** §1 — it makes "done" mean something
   the human agreed to, without turning every task into ceremony.
2. **What does the Kernel guarantee, and what does it explicitly not?** §2, §3.1,
   §3.5.
3. **How do Agent Teams carry a Contract through work, QA, review, rework, and
   sign-off?** §4, §8.2.
4. **When does agent-proxy add value, and why is it not authority?** §5.
5. **How does Knowledge make AE smarter without changing current truth?** §6.
6. **What is the first flow that can really run?** [V1 in the implementation
   plan](implementation-plan.md#v1--minimal-kernel--solo-workflow).
7. **What old complexity is gone?** [`mechanism-disposition.md`](mechanism-disposition.md).
