# AE v1 design and limitations

> **Pre-acceptance as-built draft.** Normative statements in this document
> describe the frozen AE 1.0 target. Claims about the released implementation
> remain provisional until their `RELEASE-BLOCKER` records are filled from
> acceptance evidence. This document does not announce a release.

## Draft interpretation rule

The document has two structurally different parts during implementation:

| Sections | Current classification | Publication requirement |
|---|---|---|
| 1–12 | Frozen target summary, not observed implementation fact | Rewrite each material statement as observed as-built behavior, an accepted limitation, or a recorded deviation with evidence. Merely removing placeholders is insufficient. |
| 13–15 | As-built qualification, conformance, and identity record | Replace every `RELEASE-BLOCKER` with an exact retained result or accepted limitation. |

**RELEASE-BLOCKER:** complete and independently review the target-to-as-built
conversion for every section before publication. No sentence containing
"required," "intended," or equivalent target language becomes an implementation
claim merely because the tables are filled.

## 1. Product definition

AE v1 is designed as a Claude Code-first, local, fail-closed executable proof
loop:

> A human-confirmed Acceptance Contract defines completion. Admissible evidence
> bound to that Contract and its source set is reduced by a deterministic Gate.
> Only the sole Finalizer can commit lifecycle completion.

AE v1 is not a fixed `analyze → discuss → plan → work → review` pipeline. Those
commands are user-facing controllers and execution strategies around the proof
loop. It is also not a general multi-agent orchestration framework. Agent Teams,
subagents, cross-family backends, TDD, fan-out, and evaluator loops may change
how work is performed; they cannot change what counts as complete.

The central change from earlier AE versions is:

```text
Earlier: model declaration + prose/file conventions + several inferred states
                                      ↓
                                     done

AE v1:   human-confirmed Contract + canonical observed facts
                                      ↓
                            deterministic Gate
                                      ↓
                              sole Finalizer
```

## 2. Invariants

The implementation is required to preserve five invariants.

1. **Contract and Strategy are separate.** Within an activated Contract
   revision, no plan, selector, worker, or reviewer may weaken a proof
   obligation.
2. **No admissible evidence means no completion.** Prose, a Task state, a Team
   message, `/goal`, or an agent's assertion is not completion truth.
3. **A material claim cannot be generated and solely passed by the same
   context.** Independence is a proof obligation, not a reviewer-count metric.
4. **There is one mutation owner per feature and one supported AE product writer
   per repository in v1.** Research and evidence may be parallel; product
   mutation is serialized.
5. **Only the Finalizer writes lifecycle completion.** Review may produce
   evidence, but it cannot write `done` or move a feature into a completed state.

These invariants are the compatibility boundary for future host ports. Command
names, prompt layouts, model choices, and orchestration primitives may change
without changing the proof model.

## 3. Two planes

AE separates truth from coordination.

```text
┌──────────────────────── Truth Plane ────────────────────────┐
│ Acceptance Contract → Evidence Ledger → Gate → Finalizer   │
│ immutable revision    append-only       pure    sole writer │
└─────────────────────────────────────────────────────────────┘
                              ▲
                    canonical event boundary
                              │
┌──────────────────── Coordination Plane ─────────────────────┐
│ Plan · Worker · Reviewer · Seat · Task · Team · mailbox     │
│ diagnosis · hook telemetry · /goal · Pattern Policy         │
└─────────────────────────────────────────────────────────────┘
```

Coordination artifacts may be retried, replaced, lost, or reconstructed. They
cannot close proofs or write lifecycle completion. A coordination observation
can affect the Gate only after a dedicated producer converts it into a
schema-valid, provenance-bound canonical event.

### 3.1 Core objects

| Object | Question | Authority rule |
|---|---|---|
| Acceptance Contract | What counts as correct? | An agent drafts it; a human confirms an exact immutable revision. |
| Execution Strategy | How should the work be done? | Mutable and replaceable; it references Contract proof IDs rather than copying authority. |
| Evidence Ledger | What was observed? | Append-only canonical events whose closed kind determines the required origin, candidate, base/current activation, source, run, producer, and predicate bindings. |
| Gate | Is the feature eligible to finalize now? | Pure deterministic reduction; it neither calls a model nor chooses retry policy. |
| Finalizer | May lifecycle completion be committed? | The only supported writer of `done`, using a recoverable transaction. |

### 3.2 Implementation map

This table must describe released code, not planned file names.

| Responsibility | Released implementation | Build or schema identity | Acceptance evidence |
|---|---|---|---|
| Contract validation and activation | **RELEASE-BLOCKER:** record module and entry point | **RELEASE-BLOCKER** | **RELEASE-BLOCKER** |
| Canonical recorder and Ledger | **RELEASE-BLOCKER** | **RELEASE-BLOCKER** | **RELEASE-BLOCKER** |
| Command runner and adapters | **RELEASE-BLOCKER** | **RELEASE-BLOCKER** | **RELEASE-BLOCKER** |
| Gate reducer and status projection | **RELEASE-BLOCKER** | **RELEASE-BLOCKER** | **RELEASE-BLOCKER** |
| Repository lease and write guards | **RELEASE-BLOCKER** | **RELEASE-BLOCKER** | **RELEASE-BLOCKER** |
| Finalizer and recovery journal | **RELEASE-BLOCKER** | **RELEASE-BLOCKER** | **RELEASE-BLOCKER** |
| Rollout and legacy readers | **RELEASE-BLOCKER** | **RELEASE-BLOCKER** | **RELEASE-BLOCKER** |
| Claude Code host bridge | **RELEASE-BLOCKER** | **RELEASE-BLOCKER** | **RELEASE-BLOCKER** |

## 4. Contract and human authority

### 4.1 Lifecycle

The intended Contract lifecycle is:

```text
candidate + deterministic human view
  → fresh coverage dispatch
  → canonical coverage result
  → human accept / edit / reject
  → immutable revision lock
  → contract_activated
  → current pointer projection
```

File presence alone does not activate a Contract. The latest admissible
`contract_activated` event is the authority; `current.json` mirrors it and is
repairable only in the forward direction.

Within one activated revision, non-human execution may obey or temporarily add
stricter checks, but it may not remove, weaken, or reinterpret a locked
obligation. A person may change a material boundary through a new confirmed
revision. Earlier revisions and their evidence remain immutable history, and v1
re-proves the new revision rather than carrying a pass forward.

### 4.2 Human interruption points

AE should involve a person at authority boundaries, not at every routine stage
transition:

- initial Contract confirmation or a material amendment;
- a Contract-declared human proof;
- a new permission, irreversible external action, or security/compliance
  decision;
- a material coverage gap; or
- a point where continuing requires changing scope, intent, or a product
  trade-off.

Cancellation, silence, or an empty response is not approval. Unless the host
provides an independently verifiable user-principal credential, approval is
described as `workflow_attested`, not `host_verified`: the digest proves which
content was accepted, not who the actor was.

## 5. Proof and independence model

AE v1 has three proof modes.

| Mode | Raw observation | Adjudication | Typical use |
|---|---|---|---|
| `command` | Isolated process facts and declared artifacts | Direct predicates or a fresh judge, as locked by the Contract | Tests, linters, deterministic checks |
| `artifact` | An exact artifact and its source manifest | Deterministic completeness checks, then a fresh rubric-bound judge | Documents, designs, fact claims |
| `human` | A correlated answer to an exact rendered question | A locked acceptance rule; never inferred from silence | UX, policy, physical-world, or authority decisions |

An exit code of zero is only a process fact. It becomes proof only if the
Contract selected the corresponding adapter, assertions, source set, security
policy, and accepted attempt. Similarly, schema-valid judge output proves shape,
not truth; its claims must be traceable to allowed observations and references.

AE distinguishes three kinds of independence:

- **context independence:** the judge does not inherit the implementation
  narrative;
- **responsibility independence:** the producer of a material claim is not its
  sole passing authority; and
- **source independence:** a different model family or backend is required only
  when the Contract explicitly requires it, and must be proven by correlated
  external invocation evidence.

Opening more agents does not itself satisfy any of these properties. A provider
label, agent self-report, or a second instance of the same lineage is not
cross-family evidence.

## 6. Evidence and deterministic reduction

The Ledger is an append-only, hash-chained canonical history. Binding is
event-kind-specific: genesis and candidate events do not pretend to have an
active Contract, while operational proof events bind the exact current
activation, proof and attempt, producer authority, source and input manifests,
and interpretation semantics required by their schema. Raw artifacts are
addressed by digest. Invalid, failed, unavailable, stale, and superseded
observations remain history rather than being overwritten.

The Gate reduces canonical facts into proof and lifecycle status. At minimum,
proof status distinguishes:

- `pending`: admissible evidence is still absent;
- `passed`: the selected attempt satisfies the locked obligation;
- `failed`: an admissible observation falsifies or fails the obligation;
- `invalid`: evidence exists but violates schema, provenance, cardinality, or
  authority rules;
- `unavailable`: a required capability or qualified provider cannot be used;
  and
- `stale`: the observation no longer matches the active Contract or source set.

The Gate does not call a model, infer a result from prose, choose an agent,
decide whether to retry, or turn absence into success. Its status projection is
rebuildable; deleting a cache must not delete truth.

## 7. Feature-wide change accounting

The Contract locks both proof source sets and a product change boundary. AE does
not limit drift detection to files mentioned in the worker's plan:

- activation records an immutable pre-activation seed for affected dirty,
  untracked, absent, or otherwise pre-existing paths, with origin provenance;
- source manifests preserve dirty, untracked, ignored, absent, selector,
  matcher, root, symlink, and existence facts required by the locked recipe;
- after activation, AE enumerates the closed repository product universe and
  computes product deltas project-wide, including ignored entries;
- changing ignore rules cannot hide a product mutation;
- every non-generated product delta must remain inside the locked product roots
  and be covered by the selected source/proof rules; and
- an out-of-bound, uncovered, or unattributed product change makes the relevant
  operation or proof invalid rather than silently extending scope.

This accounting distinguishes a user's pre-existing work from the feature and
prevents a narrow source manifest from concealing changes elsewhere in the
repository. A material boundary change requires an amendment; the worker cannot
solve it by editing the plan.

## 8. Execution topology and mutation ownership

Pattern selection is a small policy decision based on locked proof constraints,
task geometry, and live host capability. It is not a lifecycle state or a new
workflow language.

| Condition | Default topology |
|---|---|
| One context can perform the task and no independent proof is required | Solo |
| One independent return-only question | Anonymous subagent |
| Several independent read or validation questions | Read-only fan-out |
| Participants must exchange evidence or test competing hypotheses | Agent Team |
| Capability or authority is missing | Human boundary |

Complexity must be earned. Agent Team is for genuine peer exchange, not an
automatic review panel. Cross-family is a property of a proof seat, not a
parallel pipeline.

Only one context may own product mutation for a feature. Coverage and judge seats
have `mutation_rights=none`; their raw results are captured by the host/collector
rather than written by the seat. A researcher may have no mutation right or may
write only an explicitly isolated own-artifact area. A worker receives product
mutation rights only with the current repository lease. A durable logical lease
serializes supported AE product writes across the repository. The write guard
narrows supported tool operations, while before/after manifests provide a
backstop for drift.

## 9. Claude Code host binding

Skills are thin controllers: they read Gate facts, render exact human questions,
request host operations, dispatch seats, invoke the runner/recorder, and display
results. They do not contain a second completion algorithm.

Claude Code features are treated as replaceable host bindings:

- subagent and Team availability is live-probed before a material dispatch;
- actual result channels, tool mappings, model/family attestations, and host
  invocation mode are recorded rather than inferred from prompts;
- read-only proof seats receive no mutation lease;
- raw hook payloads are telemetry until a canonical producer validates and
  records them; and
- unknown or mismatched capability yields a typed `unavailable` result rather
  than silent downgrade.

The released support matrix must be recorded here.

| Host arm | Active-release attestation | Human delivery | Subagent result | Team result | Mutation guard | Release status |
|---|---|---|---|---|---|---|
| Interactive | **RELEASE-BLOCKER** | **RELEASE-BLOCKER** | **RELEASE-BLOCKER** | **RELEASE-BLOCKER** | **RELEASE-BLOCKER** | **RELEASE-BLOCKER** |
| Print (`-p`) | **RELEASE-BLOCKER** | **RELEASE-BLOCKER** | **RELEASE-BLOCKER** | **RELEASE-BLOCKER** | **RELEASE-BLOCKER** | **RELEASE-BLOCKER** |
| SDK | **RELEASE-BLOCKER** | **RELEASE-BLOCKER** | **RELEASE-BLOCKER** | **RELEASE-BLOCKER** | **RELEASE-BLOCKER** | **RELEASE-BLOCKER** |

Dynamic Workflows are intentionally unreachable in the v1 selector. They need a
separate workflow-to-Ledger bridge, replay and idempotency semantics, independent
Gate execution, and an answer for mid-run authority boundaries before they can
be a supported path.

## 10. Finalization and historical meaning

Review produces a proof manifest, canonical observations, fresh judge results,
and a human-readable view. It does not compute global completion and cannot
archive a feature.

The sole Finalizer replays eligibility while holding the repository and feature
locks, then follows a recoverable transaction:

```text
re-evaluate exact Contract, Ledger, source, and runtime identity
  → PREPARED journal with fixed event bytes and snapshots
  → append prepared event
  → atomic no-clobber move to the final target
  → append finalized event
  → verify committed snapshot
  → COMMITTED seal
```

The no-clobber move is the irreversible lifecycle commit point. Crash recovery
is forward-only after that point. A `review.md` verdict, Task completion, manual
directory move, or target path alone is not a valid lifecycle commit.

A committed feature is a historical, digest-bound statement that its Contract
was proven at commit time. Later legitimate changes do not reopen it. Conversely,
the historical commit does not claim that the current workspace still satisfies
the old Contract.

## 11. Rollout, migration, and knowledge

The intended rollout is fail-closed:

1. deploy guards and drain old writers;
2. compare legacy and v1 truth in shadow;
3. obtain human approval over an exact inventory;
4. publish a no-clobber rollout lock and matching durable witness; and
5. route new and migrated features through the single v1 truth path.

Legacy active or paused features migrate on touch. Historical legacy `done`
features are not bulk-rewritten; they remain available through a read-only
adapter bound to the rollout inventory. Finishing migration in one project does
not authorize deletion of compatibility code from a shared plugin release.

Knowledge is deliberately outside current completion. v1 retains `.ae/graph`
compatibility and may record non-blocking knowledge telemetry. A post-commit
retrospective may propose a future floor, but the proposal is not policy. A
project floor becomes available only through a separate human-confirmed policy
extension release, and future Contracts opt in explicitly. v1 does not provide
automatic project-wide floor promotion.

## 12. Limitations and trust boundary

### 12.1 Security and identity

- AE v1 is a fail-closed, tamper-evident supported workflow, not an OS security
  sandbox. A malicious process with the same OS-user privileges can alter the
  repository, AE state, runtime, and Git history together.
- Write capabilities constrain supported AE operations. Editors, detached
  processes, and same-user tools outside AE are not controlled; source and
  product manifests can detect many changes but do not create process isolation.
- A digest establishes content identity, not actor identity. Human approval is
  `workflow_attested` unless the released host arm provides an independently
  verifiable principal credential.
- If a rollout lock and every matching durable witness are lost together, the
  local protocol cannot distinguish total history loss from a pre-cutover
  repository. Operations must back up and restore the rollout stores as one
  atomic recovery set.

### 12.2 Platform and host scope

- v1 is a Claude Code-first implementation. It does not include a native Codex
  port, a cross-runtime Core, or a general orchestrator.
- Host behavior can drift. Support is per qualified Claude Code version,
  invocation mode, tool mapping, and result channel; unknown combinations fail
  unavailable.
- Command proof is limited to environments with an exact-match qualified child
  isolation provider. Declaring a sandbox without an effective observation is
  insufficient.
- Origin publication, rollout, migration, and finalization require separately
  qualified file and directory no-clobber primitives for the exact OS,
  filesystem, mount, and device conditions. One primitive does not imply the
  other.
- The running plugin cannot prove it is the active release by its path or an
  environment variable alone. Authority mutation requires a qualified host
  active-release attestation.

### 12.3 Concurrency and orchestration

- v1 supports one AE product writer per repository. It has no multi-writer
  scheduler, auto-merger, distributed transaction, or supported worktree merge
  protocol.
- Dynamic Workflow presets, a general Agent graph, a Pattern DSL, and new
  reactive lifecycle commands are outside v1.
- Cross-family proof is optional unless the Contract requires it. It improves a
  particular source-independence property; it does not prove the absence of
  correlated bias.
- The default topology remains solo unless a proof constraint or measured task
  geometry justifies more agents. Small samples, reviewer count, or token use do
  not establish causal value.

### 12.4 Product and learning scope

- Initial Contract approval, material amendments, human proofs, new permissions,
  and irreversible decisions still require a person.
- Knowledge does not close a proof, change the current Contract, or automatically
  become policy.
- A committed feature preserves proof at commit time; it is not a perpetual
  health assertion for today's repository.
- A single project's completed migration cannot authorize a plugin-wide legacy
  compatibility sunset.

## 13. Qualification record

No platform or host arm should be described as supported until its row links to
the exact live qualification result.

| Capability | Exact selector | Result | Evidence |
|---|---|---|---|
| Active installed release | **RELEASE-BLOCKER:** host/version/invocation | **RELEASE-BLOCKER** | **RELEASE-BLOCKER** |
| Child-process isolation | **RELEASE-BLOCKER:** provider/build/OS/runtime/fs | **RELEASE-BLOCKER** | **RELEASE-BLOCKER** |
| Atomic directory no-replace | **RELEASE-BLOCKER:** OS/fs/mount/device/helper | **RELEASE-BLOCKER** | **RELEASE-BLOCKER** |
| Atomic file no-replace | **RELEASE-BLOCKER:** OS/fs/mount/device/helper | **RELEASE-BLOCKER** | **RELEASE-BLOCKER** |
| Claude Code tool mapping | **RELEASE-BLOCKER:** CC version/invocation | **RELEASE-BLOCKER** | **RELEASE-BLOCKER** |
| Human view delivery | **RELEASE-BLOCKER:** CC version/invocation/byte limit | **RELEASE-BLOCKER** | **RELEASE-BLOCKER** |
| Cross-family backend correlation | **RELEASE-BLOCKER:** provider/build/lineage | **RELEASE-BLOCKER** | **RELEASE-BLOCKER** |

## 14. Conformance and deviations

Release acceptance must compare observed behavior with the frozen specification.
An unsupported requirement is not silently converted into a feature.

| Requirement | As-built behavior | Evidence | Residual risk | Disposition |
|---|---|---|---|---|
| **RELEASE-BLOCKER:** populate every material deviation or state `none observed` with comparison evidence | **RELEASE-BLOCKER** | **RELEASE-BLOCKER** | **RELEASE-BLOCKER** | **RELEASE-BLOCKER** |

## 15. Release identity

| Field | Released value |
|---|---|
| AE/plugin version | **RELEASE-BLOCKER** |
| Source commit | **RELEASE-BLOCKER** |
| Frozen specification identity | **RELEASE-BLOCKER** |
| Release manifest digest | **RELEASE-BLOCKER** |
| Gate code/schema/reducer identity | **RELEASE-BLOCKER** |
| Validator and adapter identities | **RELEASE-BLOCKER** |
| Filesystem helper identity | **RELEASE-BLOCKER** |
| Rollout lock and witness | **RELEASE-BLOCKER** |
| Acceptance dossier | [acceptance-dossier.md](acceptance-dossier.md) |
