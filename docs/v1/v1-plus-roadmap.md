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
Runtime-neutral conformance kit
        ├── effective host/provider attestation
        ├── workspace mutation vs durable commit authority
        │       ├── GitHub Agentic Workflows adapter
        │       ├── OpenHands/ACP sandbox adapter
        │       └── multi-worktree / multi-writer
        └── first-class Codex host port

Coordination-only adapters
        ├── Temporal durable coordinator
        ├── A2A seat transport
        └── Claude Code Dynamic Workflows bridge

Forward learning
        ├── project-wide floor activation
        └── knowledge compounding

All lanes ──→ operator UX and one-surface/many-domains experience
```

The first three foundation items should precede any claim of cross-runtime
equivalence. Otherwise each host will quietly acquire its own meaning of
Contract, evidence, or done.

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
  isomorphic proof/lifecycle status plus reason codes everywhere else.
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

This is the structural foundation for hosted runners and future multi-writer
work. It also makes the desired “Codex plans, Claude works, Codex reviews” split
a real capability boundary rather than three prompts in one trust domain.

### R+03 — Effective provider, model, and tool attestation

- **State:** `hypothesis`
- **Problem:** declared configuration can differ from the provider, model,
  profile, tools, and sandbox that actually ran.
- **Hypothesis:** each adapter can correlate a backend or host receipt with the
  exact dispatch and raw result, while treating self-report as telemetry.
- **Smallest experiment:** deliberately trigger model substitution, fallback,
  same-family masquerading, changed tool mapping, missing backend invocation,
  and authorization-route drift.
- **Admission threshold:** every declared/effective mismatch is caught; missing
  correlation has one typed `unavailable` or `invalid` result; self-report never
  satisfies a proof requirement.
- **Retreat condition:** the host exposes no independently correlatable fact. In
  that host arm, assurance remains unavailable rather than inferred.
- **Non-goal:** a universal model-quality tier.

## 5. First-class Codex port

### R+10 — Codex AE host adapter

- **State:** `hypothesis`
- **Problem:** AE 1.0's truth model is useful outside Claude Code, but its host
  binding is not portable by copying Skills and prompt text.
- **Hypothesis:** Codex can supply a first-class front end through a dedicated
  host adapter while sharing the same Contract, Ledger, Gate, fixtures, and
  Finalizer semantics.
- **Prerequisites:** R+01 and R+03; use R+02 before granting product mutation.
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
- **Prerequisites:** R+02 and a proven integration owner.
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

## 10. Cross-cutting risks

| Risk | Required response |
|---|---|
| A transport is mistaken for authority | Keep A2A, ACP, SDK, workflow, and queue status in the Coordination Plane. |
| A sandbox claim is based on configuration text | Qualify the effective runtime and inject boundary failures. |
| Hosted safe output becomes a second Finalizer | Bind it to an AE candidate tree and retain the sole deterministic commit authority. |
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

Recheck every source and pin the exact component version in the experiment
Contract; preview and host behavior may change.
