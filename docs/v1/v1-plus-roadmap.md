# AE after 1.0: candidate directions and admission experiments

> **Status:** non-normative candidate roadmap
>
> **Authority:** none
>
> **AE 1.0 baseline:** **RELEASE-BLOCKER:** bind the exact accepted release digest
>
> **External research snapshot:** 2026-08-23

Nothing in this document is an AE 1.0 requirement, release gate, waiver, or
product promise. A direction enters a product version only through a separate
human-confirmed Contract after AE 1.0 is committed. An experiment can produce
evidence; it cannot ship itself.

External product documentation establishes candidate capabilities, not AE
assurance. Every adapter still needs live qualification against the exact host,
build, environment, identity, and failure model used by AE.

## 1. What must survive every future version

Future implementations may replace Claude Code, Skills, subagents, Teams,
commands, prompts, model providers, or storage layout. They must preserve the
proof boundary:

- people confirm material boundaries;
- Contract and mutable Strategy remain separate;
- canonical observations, not prose, feed a deterministic Gate;
- a material claim is not solely passed by its generating context;
- unavailable capability is visible and fail-closed;
- coordination systems do not become a second truth plane; and
- one clearly identified authority commits durable completion.

The purpose of v1+ is not to add more agents. It is to make these invariants
portable, more strongly isolated, easier to operate, and capable of compounding
without weakening proof.

## 2. Admission model

Each candidate has exactly one roadmap state:

| State | Meaning |
|---|---|
| `hypothesis` | Worth testing; no implementation commitment |
| `experiment-authorized` | A separate Contract authorizes a bounded experiment |
| `evidenced` | The experiment met its preregistered threshold; still not a product commitment |
| `admitted-by-separate-contract` | A person accepted an implementation Contract for a later release |
| `rejected` | Evidence showed that the candidate should not enter the product |
| `parked` | No current experiment; revisit only when a named condition changes |

There is deliberately no ambiguous `planned` state.

An admission experiment must state:

- the protected failure and hypothesis;
- the smallest mechanism and fault matrix that can test it;
- the exact v1 behavior used as baseline;
- raw measures, acceptance threshold, and retreat condition;
- the new complexity and the older mechanism it replaces or strengthens; and
- explicit non-goals.

Passing an experiment permits a later design decision. It does not amend v1,
promote a floor, or create completion authority.

## 3. Dependency map

```text
Bootstrap and semantic convergence
        ├── runtime-neutral conformance kit
        ├── BootstrapLock + externally authorized release digest
        └── proof-work authorization vocabulary
                ├── portable AE runtime + capsule
                ├── AE-owned state provider + fenced recorder
                ├── effective host/provider attestation
                ├── Claude Code standalone frontend
                ├── first-class Codex frontend
                └── replaceable control planes
                        ├── Loom distributed execution / Pattern runtime
                        ├── Temporal durable coordinator
                        ├── A2A seat transport
                        └── Claude Code Dynamic Workflows bridge

Workspace mutation vs durable commit authority
        ├── deterministic integrator + applied-tree re-proof
        ├── GitHub Agentic Workflows adapter
        ├── OpenHands/ACP sandbox adapter
        └── multi-worktree / multi-writer

Forward learning
        ├── project-wide floor activation
        └── knowledge compounding
```

The foundation items R+01 through R+06 should precede any claim of
cross-runtime equivalence or AE-native distributed execution. Otherwise each
host or controller will quietly acquire its own meaning of Contract, evidence,
or done.

### 3.1 Parallel workstreams and convergence

The portable runtime and Loom do not require a serial rewrite. They require a
short protocol-first convergence point, after which independent workstreams can
proceed against shared conformance fixtures:

| Workstream | Owns | Must not own |
|---|---|---|
| AE 1.0 release | the accepted Claude Code-first implementation and release evidence | a speculative Loom dependency |
| portable AE runtime | host-neutral proof semantics, provider interfaces, and runtime manifest | scheduling policy, durable truth storage, or a second product surface |
| AE state provider | canonical blobs, Ledger, recorder fencing, projection head, and Finalizer journal | worker placement or controller recovery state |
| Claude Code frontend | standalone AE UX and qualified host binding | a private fork of Contract, Ledger, Gate, or Finalizer semantics |
| Loom control plane | ordering AE-projected open operations, seats, execution domains, retries, recovery, and operator projection | proof-node definition, admission, or lifecycle completion |
| Codex frontend | Codex-specific host delivery and receipt correlation | translated or reinterpreted proof semantics |
| provider qualification | last-qualified route facts and post-invocation effective correlation | predeclaring an invocation's effective identity |
| conformance | shared corpus, fake runtime, fake seat runner, and cross-frontend parity | implementation-specific exceptions hidden as fixtures |

The first shared seam consists of a minimal `BootstrapLock`, a versioned
`RuntimeManifest`, `ProofWorkRequest`/`SeatConstraints`, `DispatchProposal`,
`SeatAuthorization`, `SeatReceipt`, `BackendInvocationReceipt`,
`AdmissionResult`, and `GateProjection`. AE owns their proof and authority
meaning. Loom may extend its private coordination records, but it may not extend
an AE proof requirement or interpret a private status as completion.

The authorization handshake has one writer at each step:

```text
AE -> ProofWorkRequest / SeatConstraints
Loom -> DispatchProposal
AE -> immutable SeatAuthorization
adapter/collector -> raw receipts
AE recorder -> AdmissionResult -> GateProjection
```

`SeatAuthorization` binds the `ProofWorkRequest`/`SeatConstraints` digest,
request/operation/attempt identities, operation kind, kind-specific subject
identities, proposal digest, producer ACL, and single-use operation token. Loom
cannot add placement or authority fields after issuance. Redelivery of one
result may be idempotent; a genuine rerun requires a new AE-issued attempt and
token.

The earliest vertical slice must deliberately launch a session with no AE
plugin installed. An external trust policy authorizes the `BootstrapLock`; Loom
materializes the exact capsule, executes one writer seat, returns a base-bound
candidate and receipt, launches a fresh judge seat, and consumes only a
state-head-bound external Gate projection. This is the bootstrap test that
breaks the plugin-installation dependency without making Loom a proof system.

The dependency schedule is deliberately not a serial rewrite:

1. converge on the bootstrap envelope, R+05 vocabulary, and R+01 golden corpus;
2. develop runtime extraction, Loom's fake-runtime client, seat collectors,
   R+06 state, and provider qualification in parallel; then
3. converge first on a read-only slice, next on candidate writer/judge, and only
   then on integrator, applied-tree re-proof, and lifecycle Finalizer.

## 4. Foundation candidates

### R+01 — Runtime-neutral conformance kit

- **State:** `hypothesis`
- **Problem:** the Claude Code implementation can accidentally make host details
  part of proof semantics.
- **Hypothesis:** a frozen corpus of schemas, reducer cases, false-pass fixtures,
  and crash states can define a host-neutral compatibility boundary.
- **Smallest experiment:** run the same canonical inputs through the accepted CC
  build and a second adapter with no host-specific imports in the proof kernel.
- **Required evidence:** byte-identical canonicalization where required and
  isomorphic proof/lifecycle status plus reason codes everywhere else. The
  baseline is the accepted v1 golden corpus, not two views of the newly
  extracted implementation.
- **Admission threshold:** every difference is explained by an explicit host
  capability or `unsupported`, never by a forked Contract, Ledger, Gate, or
  finalization rule.
- **Retreat condition:** the corpus cannot distinguish host transport from proof
  semantics, or maintaining it creates two sources of normative truth.
- **Non-goal:** a universal agent framework.

### R+02 — Workspace mutation versus durable commit authority

- **State:** `hypothesis`
- **Problem:** a worker that can edit a workspace often also inherits Git,
  credential, hook, or repository authority that it does not need.
- **Hypothesis:** agents can mutate only a disposable worktree or container and
  return a base-bound candidate tree plus evidence, while a deterministic
  integrator alone applies durable changes.
- **Smallest experiment:** give a worker a credential-free disposable worktree;
  review the exact tree read-only; apply it with an external integrator; then
  require the applied tree digest to equal the reviewed tree and re-run affected
  proofs.
- **Fault injections:** base drift, duplicate apply, crash at every boundary,
  symlink and submodule changes, case folding, renames, Git filters/LFS,
  malicious hooks, ignored/untracked files, and path-allowlist escape.
- **Admission threshold:** the worker cannot reach commit/push/finalizer
  credentials; reviewed tree equals applied tree; retries are idempotent; all
  conflicts fail closed.
- **Retreat condition:** Git normalization or project tooling prevents reliable
  reviewed-tree binding without giving the agent durable authority.
- **Relationship to v1:** strengthens the mutation boundary; it does not replace
  the v1 Finalizer.

For R+33, Loom may allocate and preserve the candidate workspace, but the
worker receives no durable repository or Finalizer credential. Loom's rescue
ref or journal entry is not reviewed-tree identity and cannot authorize apply.

This is the structural foundation for hosted runners and future multi-writer
work. It also makes the desired “Codex plans, Claude works, Codex reviews” split
a real capability boundary rather than three prompts in one trust domain.

### R+03 — Effective provider, model, and tool attestation

- **State:** `hypothesis`
- **Problem:** declared configuration can differ from the provider, model,
  profile, tools, and sandbox that actually ran.
- **Hypothesis:** each adapter can correlate a backend or host receipt with the
  exact dispatch and raw result, while treating self-report as telemetry.
- **Prerequisite:** R+05's protocol vocabulary must be stable enough to bind a
  proposal, authorization, invocation, and result. R+03 may run in parallel
  with R+04, but R+04 may claim only materialized or declared identity until
  R+03 qualifies effective correlation.
- **Protocol relationship:** R+05's raw `BackendInvocationReceipt` is produced
  by an outer host adapter or collector, not by the agent whose family or tools
  are being attested. Only the AE recorder may validate and canonicalize it as
  the v1 `backend_invocation` event.
- **Smallest experiment:** deliberately trigger model substitution, fallback,
  same-family masquerading, changed tool mapping, missing backend invocation,
  and authorization-route drift.
- **Admission threshold:** every declared/effective mismatch is caught; missing
  correlation has one typed `unavailable` or `invalid` result; self-report never
  satisfies a proof requirement.
- **Retreat condition:** the host exposes no independently correlatable fact. In
  that host arm, assurance remains unavailable rather than inferred.
- **Non-goal:** a universal model-quality tier.

### R+04 — Portable AE runtime and bootstrap capsule

- **State:** `hypothesis`
- **Problem:** a controller that spawns a clean agent session cannot assume the
  AE Claude Code plugin is globally installed, active, or the release selected
  by the feature. Copying Skills into every session would also duplicate
  normative logic and make effective-version claims unverifiable.
- **Hypothesis:** Contract, canonical recording, Ledger replay, Gate reduction,
  lifecycle state, and Finalizer eligibility can run in a headless portable
  runtime, while host-specific frontends and qualified providers remain thin
  adapters. A content-addressed capsule can bind the exact runtime, schemas,
  provider manifests, and non-authoritative method pack used by one run, while
  a much smaller runtime-independent `BootstrapLock` binds its envelope-schema
  version, authorized release/capsule-manifest digest, protocol generation, and
  AE state-provider/namespace binding.
- **Prerequisites:** R+01 defines semantic parity; converge on the minimal R+05
  vocabulary before external clients implement it. R+03 is a parallel gate on
  any effective runtime, provider, or host-identity claim.
- **Trust root:** content addressing proves which bytes were materialized, not
  whether those bytes were authorized. A human- or administrator-controlled
  trust policy selected out of band and outside the writable product boundary
  must allow the exact `BootstrapLock` digest or full tuple. The lock cannot
  select its own trust policy. AE owns the lock schema and interpretation; human
  or administrator policy authorizes an instance. A repository file may propose
  a lock but cannot authorize it; Contract parsing happens only after runtime
  selection; cache or bundled copies are retrieval sources, never silent
  defaults.
- **Smallest experiment:** extract one read-only Gate replay and one command
  proof recording path without changing canonical bytes or reason codes; run
  them through the accepted Claude Code frontend and through a headless CLI
  launched from a clean environment with no AE plugin installation. Then let a
  writable repository propose an untrusted release while cache and bundle hold
  other releases; only the externally allowed digest may start.
- **Bootstrap receipt:** selected release digest, materialized capsule digest,
  trust-policy decision, declared/materialized identities, any qualified
  effective runtime/provider/frontend identities, route snapshot, and terminal
  status must correlate to the operation.
- **Fault injections:** missing plugin, wrong global plugin, wrong capsule,
  unauthorized repository lock, conflicting external policy, missing lock,
  silent bundled fallback, partial extraction, schema/runtime skew, replaced
  launcher, missing provider, replay under a different release, and frontend
  self-report without an external correlator.
- **Admission threshold:** the standalone frontend and headless runtime produce
  the same canonical events, Gate projection, and lifecycle result; a clean
  seat needs no plugin installation; authorization and content identity remain
  separate; every missing, unauthorized, conflicting, or mismatched release
  fails closed.
- **Retreat condition:** extraction requires two normative implementations or
  the host-independent boundary cannot be stated and tested without weakening
  the accepted v1 behavior.
- **Non-goal:** making filesystem, identity, isolation, or human-delivery
  providers magically host-neutral. Those remain separately qualified.

The Claude Code plugin remains a supported standalone frontend and may bundle
the runtime. It stops being the only place where AE truth semantics exist.

### R+05 — AE proof-work and seat protocol

- **State:** `hypothesis`
- **Problem:** feature-level prompts and mutable files do not provide a stable
  boundary between a proof authority and an external execution controller.
- **Hypothesis:** AE can project immutable constraints, validate a controller's
  placement proposal, and issue one immutable authorization while an
  authority-untrusted but transport-qualified controller returns raw,
  digest-bound receipts that AE validates before any canonical event is
  recorded.
- **Protocol nucleus:**
  - `ProofWorkRequest`/`SeatConstraints` projects the operation kind, immutable
    Contract/proof constraints, producer ACL, and required subject identities;
  - `DispatchProposal` carries Loom's selected route, topology/seat placement,
    advertised or last-qualified capabilities, budgets, and fallback;
  - `SeatAuthorization` is minted by AE only after proposal validation and binds
    the constraints digest, request/operation/attempt identities, operation
    kind, kind-specific subjects, proposal digest, role, controlled inputs,
    exclusions, tools, mutation scope, independence/family/assurance, stop
    conditions, producer ACL, and single-use operation token;
  - `SeatReceipt` returns input/output digests, raw artifacts, effective
    backend/session facts, terminal status, and external attestation references;
  - `BackendInvocationReceipt` is an outer collector's raw correlation input;
    only the AE recorder may admit it as canonical `backend_invocation`;
  - `AdmissionResult` reports acceptance or typed rejection of delivery without
    becoming proof status; and
  - `GateProjection` is a rebuildable, AE-state-head-bound result consumed by
    coordinators; it is not truth storage and is not authored by them.
- **Operation subjects:** a writer binds activation, base, product boundary, and
  controlled inputs, and returns a candidate; a proof/judge binds an existing
  candidate or other exact subject plus rubric and source manifest; integration
  binds candidate, target base, and deterministic apply rules and returns an
  `AppliedTreeReceipt`; finalization binds applied head, current activation,
  Ledger head, runtime identity, and locks in a separate
  `FinalizeRequest/Result`. No pre-writer request requires a nonexistent
  candidate digest.
- **Human boundary:** a qualified AE frontend/provider owns `HumanRequest`,
  `HumanDeliveryReceipt`, and `HumanResponseReceipt`. Loom may route opaque
  messages, but a UI click or journal record cannot become human proof; the AE
  recorder assigns only supported `workflow_attested` or `host_verified`
  assurance.
- **Initial threat model:** operation tokens provide correlation, scoping, and
  replay control; a bearer token visible to Loom does not make Loom
  cryptographically unforgeable. The first admitted path treats Loom and its
  collector as a qualified faithful-transport TCB and tests crashes,
  misconfiguration, and accidental faults. Resistance to a malicious
  controller requires a later independent collector identity/key or qualified
  OS boundary plus producer-ACL verification.
- **Smallest experiment:** use a fake runtime and fake seat runner to exercise
  success, invalid schema, wrong token, missing result, duplicate delivery,
  stale subject, wrong backend, timeout, human-required outcomes, post-token
  proposal mutation, and attempted token reuse from both sides of the boundary.
- **Admission threshold:** delivery retry of the same bytes is idempotent; a
  genuine rerun requires a new AE attempt/token; private queue or journal state
  never closes a proof; only the AE recorder can normalize a receipt into a
  canonical event; unsupported authority fields fail visibly.
- **Retreat condition:** the protocol leaks host-specific prompt structure into
  proof meaning or requires Loom, a model, or a queue to implement the Gate.
- **Non-goal:** a general inter-agent messaging standard. A2A, MCP, stdio, or a
  local socket may carry the protocol after separate transport qualification.

### R+06 — AE durable state provider and recorder fencing

- **State:** `hypothesis`
- **Problem:** a portable runtime capsule is executable code, not durable truth
  state. Deleting a controller cannot leave AE replayable unless canonical
  bytes, heads, and lifecycle journals have an explicit owner.
- **Hypothesis:** an `AEStateProvider` can own Contract activations, raw canonical
  blobs, Ledger, Gate inputs/projection heads, issued authorizations, consumed
  tokens, durable admission decisions, recorder leases, rollout locks, and
  Finalizer journal in an AE-controlled state root outside `.loom`, seat
  worktrees, and controller caches.
- **Prerequisites:** R+01 and the state/head vocabulary in R+05. R+04 supplies
  the portable clients but is not the state store.
- **Write discipline:** raw bytes enter the AE blob store atomically before an
  event may reference them; each proof subject has one active recorder fenced by
  provider lease/token and compare-current-head. Authorization issuance is
  durably journaled before dispatch. First delivery atomically binds token,
  result digest, admission decision, and any event/head transition; redelivery
  of the same bytes returns that decision, while different bytes or a rerun need
  a new token. Stale or concurrent writers fail closed. Loom discovers the
  provider and current head through the authorized runtime binding after
  restart.
- **Smallest experiment:** run two recorder processes against one subject, kill
  either at every authorization/blob/token/admission/event/head transition,
  delete all Loom state, and replay Contract, Ledger, Gate projection,
  authorization/admission decisions, and Finalizer journal from the AE state
  root alone.
- **Admission threshold:** no accepted event references missing bytes; exactly
  one recorder advances a subject head; issued/consumed-token and
  `AdmissionResult` behavior survives every crash; coordinator loss changes no
  proof or lifecycle fact; unavailable state pauses execution rather than
  creating local temporary truth.
- **Retreat condition:** the provider cannot fence concurrent processes or the
  state root must live inside a controller/seat authority boundary.
- **Non-goal:** multi-host consensus. The first scope is one logical recorder
  and state authority with distributed seats.

## 5. First-class Codex port

### R+10 — Codex AE host adapter

- **State:** `hypothesis`
- **Problem:** AE 1.0's truth model is useful outside Claude Code, but its host
  binding is not portable by copying Skills and prompt text.
- **Hypothesis:** Codex can supply a first-class front end through a dedicated
  host adapter while sharing the same Contract, Ledger, Gate, fixtures, and
  Finalizer semantics.
- **Prerequisites:** R+01, R+03, and R+04; use R+05 for seat execution, R+06
  before authoritative recording or finalization, and R+02 before granting
  product mutation.
- **Adapter surface:** capability snapshot, exact instruction delivery, tool
  mapping, human-boundary delivery, dispatch/result correlation, sandbox and
  mutation endpoints, resume semantics, active-release identity, and host
  telemetry.

The official Codex SDK can programmatically start, continue, and resume local
threads, and its Python API exposes per-thread or per-turn filesystem sandbox
presets. Those capabilities make an adapter experiment plausible; they do not
by themselves prove AE freshness, active-release identity, effective model
lineage, human assurance, or durable mutation authority. See the
[official Codex SDK documentation](https://learn.chatgpt.com/docs/codex-sdk).

#### Port sequence

1. **Read-only conformance:** status, Gate replay, diagnostics, and exact view
   rendering over existing v1 artifacts.
2. **Proof seats:** coverage and review dispatch with read-only sandbox,
   controlled inputs, raw-result correlation, and fresh-context tests.
3. **Planning front end:** Contract candidate rendering and human decision
   delivery without introducing Codex-specific authority semantics.
4. **Disposable writer:** mutation only through R+02 candidate workspaces.
5. **Full front end:** recovery and finalization requests after every earlier
   phase passes the shared conformance and live-host matrices.

This is an AE frontend port, not the same deliverable as a Codex worker adapter
inside Loom. The former supplies qualified host interaction for the shared AE
runtime; the latter lets Loom choose Codex as one execution provider. They may
share transport code, but neither may define a Codex-specific meaning of pass.

#### Admission experiment

- pin an exact Codex SDK/App Server/CLI build;
- run the shared reducer, false-pass, and host failure corpus;
- dogfood command, artifact, human, and required cross-family features;
- inject declared/effective model mismatch, sandbox mismatch, resume/replay,
  missing result correlation, stale worktree, and denied human delivery; and
- verify that every unsupported host fact yields explicit unavailability rather
  than a new Codex-specific meaning of pass.

**Admission threshold:** no forked proof semantics, a live-qualified host matrix,
and the same final state for the same canonical input corpus. A successful
read-only port does not automatically authorize writer support.

## 6. External execution and isolation candidates

### R+20 — GitHub Agentic Workflows adapter

- **State:** `hypothesis`
- **Opportunity:** GitHub Agentic Workflows runs natural-language workflows in
  GitHub Actions, supports Copilot, Claude, Codex, and Gemini engines, and is in
  public preview. GitHub documents read-only agent tokens by default, agent
  containers, and write actions performed by separate safe-output jobs. See
  [GitHub's overview](https://docs.github.com/en/enterprise-cloud@latest/copilot/concepts/agents/about-github-agentic-workflows).
- **Useful boundary:** `allowed-files` is documented as an exclusive allowlist,
  and GitHub Environment protection can gate a downstream write job. See the
  [pull-request file policy](https://github.github.com/gh-aw/reference/safe-outputs-pull-requests/)
  and [security FAQ](https://github.github.com/gh-aw/reference/faq/).
- **AE hypothesis:** separate engine jobs can supply isolated planning, work, and
  review seats while an AE-controlled safe-output integrator remains the only
  durable writer.
- **Smallest experiment:** agents produce only a structured candidate tree and
  evidence; no safe-output job may declare AE completion or bypass the
  Finalizer.
- **Fault injections:** prompt injection, secret exfiltration, out-of-bound path,
  partial Actions rerun, duplicate dispatch, broad permission configuration,
  and reviewer/apply tree mismatch.
- **Admission threshold:** read-only agent credentials, exclusive path denial,
  idempotent retries, exact reviewed-tree binding, and an external deterministic
  commit authority.
- **Caveat:** configuration can broaden sandbox, network, and write access. Do not
  market a configured Actions design as absolute physical isolation.

### R+21 — OpenHands/ACP sandbox adapter

- **State:** `hypothesis`
- **Opportunity:** OpenHands can run its agent server in a Docker sandbox and can
  delegate to ACP servers over JSON-RPC. Its Docker documentation says read-write
  workspace mounts are modifiable by the agent. Its ACP documentation also says
  ACP permission requests are automatically approved. See the
  [Docker sandbox documentation](https://docs.openhands.dev/openhands/usage/sandboxes/docker)
  and [ACPAgent guide](https://docs.openhands.dev/sdk/guides/agent-acp).
- **AE hypothesis:** one disposable container per seat can provide stronger
  workspace separation, while ACP is only the backend transport and all AE
  authority remains outside the container.
- **Smallest experiment:** read-only source or a disposable writable clone,
  external credentials, and exact correlation of container image, ACP server,
  dispatch, raw result, and candidate tree.
- **Fault injections:** cross-seat contamination, container escape probes,
  credential leakage, kill/restart, image drift, mutable mounts, and result
  replay.
- **Admission threshold:** live-qualified isolation, no shared durable write
  credentials, and complete correlation to raw results.
- **Retreat condition:** ACP auto-approval or mounts cannot be contained by an
  outer filesystem/network/capability boundary.

## 7. Coordination and transport candidates

### R+30 — Temporal durable coordinator

- **State:** `hypothesis`
- **Opportunity:** Temporal is designed to resume applications after process,
  network, or infrastructure failure. See the
  [Temporal platform documentation](https://docs.temporal.io/).
- **AE hypothesis:** Temporal can durably schedule attempts, timers, human
  signals, and worker routing while AE's Ledger, Gate, and Finalizer remain the
  only truth plane.
- **Smallest experiment:** separate planner, worker, reviewer, and finalizer task
  queues and identities; kill and replay every dispatch/result/judge/finalize
  boundary.
- **Admission threshold:** activity retries cannot create duplicate canonical
  events or lifecycle commits, crash recovery materially improves, and Temporal
  history is never interpreted as proof status.
- **Retreat condition:** coordination status becomes a second eligibility model
  or side effects cannot be bound to AE idempotency keys.

### R+31 — A2A seat transport

- **State:** `hypothesis`
- **Opportunity:** A2A defines versioned operations for messages, tasks, status,
  artifacts, streaming, and agent discovery. See the
  [A2A v1.0 specification](https://a2a-protocol.org/dev/specification/).
- **AE hypothesis:** a remote seat may receive an AE subject digest as an A2A
  task and return raw artifact bytes for local canonical normalization.
- **Smallest experiment:** map one read-only proof dispatch to a version-pinned
  task and treat every remote status as coordination only.
- **Fault injections:** protocol downgrade, cross-dispatch replay, completed task
  without artifact, partial artifact, unknown extension, duplicate push, and a
  hostile opaque agent.
- **Admission threshold:** Task status never closes proof; only an exact artifact
  correlated and normalized by AE may enter the Ledger.
- **Non-goal:** treating A2A as a sandbox, identity authority, or proof system.

### R+32 — Claude Code Dynamic Workflows bridge

- **State:** `hypothesis`
- **v1 boundary:** unreachable by the v1 selector.
- **Opportunity:** Dynamic Workflows provide script-driven subagent fan-out and
  same-session pause/resume. Current official documentation also states that
  spawned agents run in `acceptEdits`, file edits are auto-approved, ordinary
  mid-run user input is unavailable, and exiting Claude Code causes the next
  session to start the workflow fresh. See the
  [Claude Code Dynamic Workflows documentation](https://code.claude.com/docs/en/workflows).
- **AE hypothesis:** a saved read-only workflow can improve research or review
  fan-out if a unique bridge preserves every result and the Gate stays outside
  the workflow.
- **Smallest experiment:** one read-only fan-out with exact dispatch/result
  digests and explicit preservation of `null`, failure, and invalid results.
  The official example's `filter(Boolean)` behavior is unacceptable on an AE
  evidence path because missing results must remain visible.
- **Fault injections:** pause, same-session resume, new-session restart, agent
  failure, partial result, duplicate bridge delivery, and a human boundary
  between stages.
- **Admission threshold:** idempotent bridge, no dropped null/invalid result,
  external Gate, and repeated value over ordinary subagent fan-out in a
  preregistered task class.
- **First admissible scope:** read-only research/review, not product writing.

### R+33 — Loom AE-native distributed execution and control plane

- **State:** `hypothesis`
- **Existing precursor:** [Loom](https://github.com/xmkevinchen/loom) already
  contains a local feature DAG scheduler, headless Claude Code worker adapter,
  per-feature worktrees, bounded parallel dispatch, durable run journal,
  recovery, rescue refs, and operator logs. Those are implementation facts
  about a pre-alpha coordinator, not evidence that it satisfies this candidate.
- **Problem:** AE 1.0 can complete one feature in a foreground Claude Code
  environment, but physical seat separation, cross-feature scheduling, durable
  retries, resource policy, and operator visibility do not belong in the proof
  kernel. Loom's current plugin-inside-every-worker bootstrap and mutable
  `review.md` verdict interface cannot carry the accepted v1 truth boundary.
- **Hypothesis:** an admitted target Loom can become AE's reference distributed
  execution and coordination system while the portable AE runtime and R+06
  state provider retain the single logical truth plane. Distribution applies to
  sessions, seats, workspaces, backends, time, and eventually hosts—not to
  Contract, Ledger, Gate, or Finalizer authority.
- **Prerequisites:** R+01, R+03, R+04, R+05, and R+06. Product mutation also
  requires R+02.
- **Authority boundary:** Loom may order and execute AE-projected open
  operations, propose a route, allocate an execution domain, preserve raw
  results, retry byte-identical delivery, route an opaque human request, and
  display an AE state-head-bound Gate projection. It may not define proof nodes,
  mint proof events, interpret its journal as evidence, weaken a locked
  constraint, infer pass from process exit or review prose, or write lifecycle
  completion.
- **Smallest experiment:** from a clean environment with no AE plugin, Loom
  resolves an externally authorized `BootstrapLock`; materializes its exact
  runtime capsule; runs a writer in one session; returns a candidate and
  receipt; runs a fresh read-only judge in another session; asks an external
  deterministic integrator to apply the reviewed candidate; reruns affected
  proofs against the applied identity; and waits for the external AE Gate and
  lifecycle Finalizer. The current one-session `work → review` prompt and direct
  `review.md` verdict consumption are absent.
- **Fault injections:** capsule mismatch, missing runtime, wrong frontend,
  writer self-authored pass, process exit zero with judge fail, lost or duplicate
  receipt, stale candidate/base, worktree creation failure, coordinator crash at
  every handoff, forged journal state, missing Gate, denied human delivery, and
  Finalizer request replay.
- **Admission threshold:** a launched seat has no plugin prerequisite; every
  accepted result binds to an operation and effective session; work and material
  adjudication are physically distinct where required; Loom recovery produces
  no duplicate event or completion; coordinator deletion leaves R+06 truth
  replayable; only qualified faithful-transport behavior is claimed; every
  unsupported boundary is explicit and fail-closed.
- **Retreat condition:** Loom must copy Gate logic, require mutable authority
  files inside seats, or hold Finalizer credentials to make progress.
- **Non-goals:** Byzantine consensus, an authority federation, multi-user
  authorization, or a claim that local processes constitute security isolation.

Current Loom is a precursor substrate for a distributed form of AE's Execution
and Coordination Plane. Only an admitted target Loom may claim that role, and
it is never a distributed implementation of AE truth. AE must remain usable
without Loom through its standalone frontend; Loom must remain replaceable
behind R+05.

### R+34 — Loom Pattern and topology runtime

- **State:** `hypothesis`
- **Source design:** the AE Agent Patterns study separates worker cognition,
  workflow control, collaboration topology, judgment, transport, guardrails,
  and memory. With an explicit control plane, workflow and topology execution
  belong in Loom rather than becoming new AE lifecycle stages.
- **Hypothesis:** Loom can select the smallest sufficient topology from an
  immutable AE constraint projection, recomputable task geometry, and an
  advertised/last-qualified route snapshot, while AE retains all proof and
  human authority. Effective backend/model/tool/isolation identity exists only
  in the post-invocation collector receipts.
- **Initial static topologies:**
  1. solo writer;
  2. writer followed by a fresh read-only judge; and
  3. read-only fan-out followed by a lossless collector/fan-in; an optional
     synthesis seat still returns only a raw artifact for AE admission.
- **Later candidates:** prompt chaining, routing, manager/workers,
  ReWOO-shaped fan-out/fan-in, bounded Evaluator-Optimizer, independent-first
  debate, pairwise order swapping, and human interruption. ReAct and TDD remain
  inside a seat attempt; Loom does not implement a model cognition engine.
- **Shared boundary:** AE defines proof scope, rubric, source set, mutation
  authority, required independence/family/assurance, admissible result schema,
  amendment boundary, open operations, and Gate meaning. Loom defines session
  placement proposals, controlled context delivery, communication topology,
  time/resource budgets, retry scheduling, route fallback, lossless collection,
  and coordination observability. Only the deterministic AE Gate is a reducer.
- **Smallest experiment:** run the three static topologies against preregistered
  task classes and the same solo baseline, first with a fake runtime and then
  through R+33. Record why the topology was chosen, every pre-dispatch route
  claim, and every post-invocation effective fact without making the dispatch
  record proof-authoritative.
- **Fault injections:** missing fresh seat, same-family fallback, invalid/null
  fan-out result, teammate/result-channel mismatch, overlapping mutation,
  unchanged findings through the retry cap, debate without competing
  hypotheses, pairwise order reversal, capability loss, and a mid-run human
  amendment.
- **Admission threshold:** the same canonical event set always yields the same
  Gate result; a topology may change that result only by producing additional
  admissible events, never through dispatch, journal, or queue state; required
  degradation is visible; false-pass does not increase; a selected topology
  shows repeated benefit over solo in its preregistered task class; removing it
  causes measurable loss greater than its cost.
- **Retreat condition:** the selector becomes ceremonial, duplicates AE proof
  semantics, or adds cost without repeatable quality, latency, or operator
  benefit.
- **Non-goal:** a general Pattern DSL in the first admitted release.

## 8. Scale and learning candidates

### R+40 — Project-wide floor activation

- **State:** `hypothesis`
- **v1 baseline:** a post-commit retrospective can create a non-authoritative
  floor proposal; a separate human-confirmed policy extension makes it available
  for explicit opt-in by future Contracts.
- **Problem:** v1 does not make an escaped project defect an automatic exam for
  every future feature.
- **Hypothesis:** a project-policy activation/current chain can make a
  human-approved floor forward-applicable to all new Contracts without changing
  old Contracts.
- **Smallest experiment:** escaped defect → proposal → independent human policy
  activation → automatic snapshot into a later Contract candidate.
- **Fault injections:** concurrent activation, replace/retire, plugin upgrade,
  cross-project leakage, malformed proposal, and attempted retroactive effect.
- **Admission threshold:** explicit human authority, no self-promotion,
  forward-only semantics, project isolation, and improved seeded recurrence
  performance over v1 opt-in.

### R+41 — Knowledge compounding

- **State:** `hypothesis`
- **Boundary:** knowledge may influence future source discovery or Strategy; it
  never changes the current Contract, evidence, or Gate.
- **Smallest experiment:** preregister repeated tasks with and without delivered
  knowledge; measure rediscovery, time, tokens, actual read hits, stale or
  misleading hits, and maintenance cost.
- **Admission threshold:** repeated benefit with acceptable error and upkeep;
  every item retains source and invalidation conditions; Contract wins every
  conflict.
- **Retreat condition:** knowledge is not read, does not save work, or creates
  recurring misleading decisions. The 30/60/90-day decision remains human; there
  is no automatic death sentence based only on age.

### R+42 — Multi-worktree and multi-writer execution

- **State:** `parked`
- **Prerequisites:** R+02, R+05, and a proven integration owner. R+33 is the
  reference experiment vehicle, not a prerequisite for another conforming
  controller.
- **Hypothesis:** two strictly disjoint product boundaries may reduce wall time
  if each worker returns an isolated candidate tree and only the merged tree is
  the proof subject.
- **Smallest experiment:** two path-disjoint changes plus adversarial rename,
  case-fold, generated output, shared fixture, port/database, stale base, and
  shared semantic-decision cases.
- **Admission threshold:** conflicts cover paths and hidden shared resources;
  merged-tree proofs are mandatory; repeated wall-time benefit over the v1
  single-writer baseline does not reduce correctness.
- **Retreat condition:** integration uncertainty or re-proof cost consumes the
  concurrency benefit.

## 9. Product surface candidate

### R+50 — One surface, many execution domains

- **State:** `hypothesis`
- **Problem:** correct physical separation is operationally expensive if users
  must manually copy prompts, patches, and evidence between sessions.
- **Hypothesis:** one foreground operator surface can coordinate multiple
  isolated execution domains while showing only a rebuildable Gate projection.
- **Smallest experiment:** a new user follows the v1 usage model through command,
  artifact, human, and required cross-family features, including interruption,
  resume, and unavailable capability.
- **Measures:** time to correct next action, mistaken interpretation of `done`,
  meaningless human interruptions, manual artifact transfers, and attempts to
  bypass authority files.
- **Admission threshold:** no shadow status or second truth plane; users do not
  manually shuttle authoritative artifacts; every isolation and human boundary
  remains visible.
- **Reference candidate:** Loom may provide this surface after R+33, but its
  phase, queue, journal, worker, and recovery views remain coordination
  projections. The only displayed proof/lifecycle state is rebuilt from AE.

## 10. Cross-cutting risks

| Risk | Required response |
|---|---|
| A transport is mistaken for authority | Keep A2A, ACP, SDK, workflow, and queue status in the Coordination Plane. |
| Loom becomes a distributed truth plane | Distribute execution only; keep one AE recorder, Gate, and Finalizer authority per subject. |
| Clean seats depend on a hidden global plugin or self-authorized capsule | Require external `BootstrapLock` trust, materialize its exact R+04 capsule, and reject repository/bundle fallback. |
| Portable code is mistaken for durable truth state | Require R+06 blob ownership, fenced recorder, current head, and Finalizer journal outside controller state. |
| Runtime, frontend, and controller select different releases | Bind all three effective identities to the operation and reject any digest mismatch. |
| Loom duplicates proof semantics to unblock development | Develop against fake-runtime fixtures; never implement a private pass reducer. |
| A controller-visible bearer token is called adversarial isolation | State the faithful-transport TCB; require an independent collector identity/key or qualified OS boundary for stronger claims. |
| A controller UI action becomes human proof | Route qualified AE human request/delivery/response receipts; journal state remains non-authoritative. |
| A sandbox claim is based on configuration text | Qualify the effective runtime and inject boundary failures. |
| Hosted safe output becomes a second integrator or Finalizer | Bind it to an authorized candidate/apply operation, re-prove the applied tree, and retain the sole AE lifecycle Finalizer. |
| Each host forks proof semantics | Require R+01 before a first-class port. |
| Model/provider names substitute for lineage proof | Require R+03 correlation; self-report remains telemetry. |
| Concurrency hides semantic conflicts | Prove merged-tree subject identity and re-run affected proofs. |
| Learning silently rewrites standards | Separate proposal, human policy activation, and future Contract snapshot. |
| Roadmap language becomes a release promise | Use only the admission states defined here and keep the roadmap out of the v1 Gate. |

## 11. Governance

A roadmap change may add or refine a hypothesis. It cannot:

- alter the accepted AE 1.0 release or its evidence;
- mark an experiment admitted without a separate human-confirmed Contract;
- turn external product documentation into an AE qualification result;
- use a successful demo as proof of crash, identity, or authority behavior; or
- promote a floor or knowledge item into current policy.

Cross-repository ownership follows the authority boundary:

- AE owns `BootstrapLock` semantics, canonical schemas, proof meaning,
  authorization/token rules, conformance fixtures, state-provider protocol, and
  the portable runtime release manifest;
- Loom owns private scheduling schemas, resource policy, topology selection,
  runtime materialization, session/workspace lifecycle, and operator views;
- a Loom-only field never becomes an AE proof requirement;
- an AE protocol change is versioned and proven in the AE repository before
  Loom consumes it; and
- Loom may use a fake runtime for parallel development, but the fake runtime
  returns preregistered projections and never becomes a normative reference.

When an experiment finishes, retain raw evidence and set exactly one state.
Rejected mechanisms remain in the history with their retreat reason so that a
future host change does not erase what was learned.

## 12. Source snapshot

The following official sources were checked on 2026-08-23. They describe
candidate product capabilities, not AE assurance:

- [Codex SDK](https://learn.chatgpt.com/docs/codex-sdk)
- [GitHub Agentic Workflows overview](https://docs.github.com/en/enterprise-cloud@latest/copilot/concepts/agents/about-github-agentic-workflows)
- [GitHub safe outputs](https://github.github.com/gh-aw/reference/safe-outputs/)
- [GitHub pull-request safe-output file policy](https://github.github.com/gh-aw/reference/safe-outputs-pull-requests/)
- [GitHub Agentic Workflows security FAQ](https://github.github.com/gh-aw/reference/faq/)
- [OpenHands ACPAgent](https://docs.openhands.dev/sdk/guides/agent-acp)
- [OpenHands Docker sandbox](https://docs.openhands.dev/openhands/usage/sandboxes/docker)
- [Temporal platform](https://docs.temporal.io/)
- [A2A v1.0 specification](https://a2a-protocol.org/dev/specification/)
- [Claude Code Dynamic Workflows](https://code.claude.com/docs/en/workflows)
- [Loom source snapshot at `2c048ea`](https://github.com/xmkevinchen/loom/tree/2c048ea0c1a3049b914a10e084b1231c9beb6949)

Recheck every source and pin the exact component version in the experiment
Contract; preview and host behavior may change.
