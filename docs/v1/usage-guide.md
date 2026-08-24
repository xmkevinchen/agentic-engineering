# Using AE v1 correctly

> **Pre-acceptance draft.** This guide describes the intended AE v1 user
> contract. Exact installation steps, command syntax, supported Claude Code
> modes, and recovery wrappers must be verified against the accepted release
> before publication. Do not use this draft as evidence that v1 is available.

## 1. The operating model

One foreground Claude Code session may coordinate an AE feature from intent to
finalization. That does not mean one context implements a change and declares
its own work correct.

AE keeps five roles and authority boundaries separate:

- a person confirms the exact Acceptance Contract;
- the mutation owner performs the product work;
- fresh proof seats observe or judge material claims when required; and
- the deterministic Gate determines current eligibility; and
- the sole Finalizer independently rechecks eligibility and commits completion.

Think of `/ae:*` commands as views and controllers around this loop:

```text
draft boundary → human-confirmed Contract
                         ↓
                 work and observations
                         ↓
                 canonical evidence
                         ↓
                deterministic Gate
                  ↙              ↘
Strategy chooses retry,        eligible
re-plan, amendment, human,        ↓
capability restore, or stop  Finalizer rechecks
                                  ↓
                              committed
```

The command sequence is a useful interface, not the definition of completion.

### Terms used in this guide

| Term | Plain-language meaning |
|---|---|
| Contract | The exact, human-confirmed definition of what counts as correct. |
| Acceptance Criterion (AC) | One observable promise inside the Contract. |
| Proof | A locked recipe for obtaining enough evidence for an AC or floor obligation. |
| Floor | A versioned project or plugin requirement that the Contract must explicitly bind or mark inapplicable. |
| Seat | One bounded agent role and input contract, such as a fresh coverage or judge context. |
| Canonical evidence | An observation accepted through AE's schema, provenance, source, and producer rules. |
| Ledger | The append-only, hash-chained history of canonical events. |
| Gate | The deterministic reducer that reports proof, integrity, lifecycle, and finalization eligibility. |
| Finalizer | The sole authority that rechecks eligibility and commits lifecycle completion. |
| Non-vacuity | Evidence that the intended subject was actually exercised, such as tests being discovered rather than zero tests exiting successfully. |
| Lineage | The attested model-family or backend origin used for source-independence requirements. |

The [design's core-object table](design-and-limitations.md#31-core-objects)
contains the more precise authority definitions.

## 2. Before starting

### 2.1 Release prerequisites

Fill this table from the accepted release. Until then, it is intentionally not
an installation guide.

| Requirement | Accepted value |
|---|---|
| AE/plugin version | **RELEASE-BLOCKER** |
| Supported Claude Code versions | **RELEASE-BLOCKER** |
| Supported invocation modes | **RELEASE-BLOCKER** |
| Installation and update command | **RELEASE-BLOCKER** |
| Project setup or migration command | **RELEASE-BLOCKER** |
| Supported OS/filesystem combinations | **RELEASE-BLOCKER** |
| Optional correlated cross-family providers | **RELEASE-BLOCKER** |

Do not assume that an installed path is the active plugin release. Authority
operations require the host binding to attest the active release and for that
attestation to match the verified release manifest.

### 2.2 Repository conditions

Before creating or resuming a feature:

- know which local changes are already present and who owns them;
- avoid a second AE product mutation session in the same repository;
- expect AE to account for pre-existing dirty/untracked paths and to scan the
  closed product universe, including ignored entries, after activation;
- keep every product change inside the Contract's product roots and proof/source
  coverage; a plan mention does not authorize an out-of-bound change;
- ensure required tests and deterministic tools can run in an accepted
  isolation provider;
- keep the `.ae` authority, transaction, and rollout stores on a supported
  filesystem; and
- use status or diagnostics first if AE reports an integrity or recovery state.

### 2.3 Rollout and existing features

Check effective rollout state before entering the normal v1 flow. Mutable
configuration alone does not make v1 authoritative.

| Observed project state | Meaning and correct action |
|---|---|
| No rollout lock and no PUBLISHED witness | Production remains on the legacy reader; shadow is diagnostic only. Complete the supported cutover before treating a new feature as v1-authoritative. |
| Matching rollout lock and unique PUBLISHED witness | Healthy enforce may create and operate v1 features. |
| Matching lock with only a PREPARED witness | Cutover committed but needs recovery. Stop normal operations and run only matching rollout recovery. |
| Lock/witness missing, corrupt, mismatched, or duplicated | Global rollout integrity error. Keep old-writer guards in place and diagnose; never fall back silently. |
| Legacy active or paused feature | Migrate on touch before v1 work. Migration requires a human-confirmed conservative seed that accounts for reachable history and current dirty/untracked paths. |
| Legacy done feature in the locked inventory | Read-only compatibility record; do not rewrite it as a v1 commit. |

Shallow, partial, missing, or otherwise incomplete Git history can make the
conservative migration seed impossible to prove. In that case migration is
blocked; do not substitute a current snapshot or old prose as pre-mutation
authority.

## 3. Normal feature flow

The normal path is not one pass through six stages. Planning activates a
Contract once; Steps 3–5 then form a bounded work → proof → Gate-status loop.
After each status read, Strategy may retry, re-plan without changing the
Contract, request capability restoration, stop, or open a human-confirmed
amendment. Continue to Step 6 only when the Gate reports finalization
eligibility.

### Step 1: Explore only when useful

Use `/ae:analyze <goal>` to inspect the repository and establish source and
intent facts. It may fan out independent read-only questions. It does not create
a Contract or produce a completion verdict.

Use `/ae:discuss` when intent, scope, constraints, or alternatives need
exploration. A Team is justified only when participants must exchange evidence
or test genuinely competing hypotheses. Discussion output is draft input, not
approval.

Both steps are optional. A clear, bounded request can go directly to planning.

### Step 2: Draft and confirm the Contract

Run:

```text
/ae:plan <feature intent>
```

`/ae:plan` should:

1. inspect the actual repository;
2. draft Intent, Scope, Acceptance Criteria, falsifiers, and proof recipes;
3. obtain a fresh, independent coverage review;
4. present the complete deterministic human view; and
5. let you accept, edit, or reject it.

Read the Contract as the boundary of the feature, not as an implementation
checklist. In particular, check:

- what observable user result each acceptance criterion promises;
- what would falsify each criterion;
- which files and product roots may change;
- which source set each proof observes;
- whether a proof runs commands or handles credentials/network access;
- whether a human or different model family is required; and
- how applicable project or plugin floors are handled.

Only an explicit acceptance of the exact view may activate the Contract.
Silence, cancellation, an empty response, a note saying "approved," or a manual
frontmatter edit is not approval.

Use `/ae:plan-review` for an additional independent check of coverage, proof
executability, or Strategy risk. It cannot approve the Contract for you and
cannot silently change a locked Contract.

### Step 3: Implement against Gate obligations

Run:

```text
/ae:work
```

`/ae:work` reads the current Gate projection and chooses work for proofs that are
`pending`, `failed`, `invalid`, `unavailable`, or `stale`. It acquires the single
repository writer lease before product mutation and uses bounded attempts.

The worker may adapt its Strategy, use TDD, collect observations, or ask
read-only subagents to investigate. It may not reduce the Contract so that the
current implementation passes.

When an attempt fails, preserve the observation and record a diagnosis. A new
attempt may fix the product or evidence problem. If the next action would change
scope, an acceptance criterion, a falsifier, a locked source set, a proof mode,
or a required independence property, stop and propose an amendment.

### Step 4: Produce independent proof

Run:

```text
/ae:review
```

`/ae:review` builds a proof manifest from the current Contract. It records
deterministic observations and uses one fresh evaluator for each proof question
that needs semantic judgment. The evaluator receives controlled Contract,
source, artifact, and rubric references; it does not inherit the worker's
persuasive summary.

Review may produce a readable report, but the report is only a view. Review does
not:

- decide the global feature result;
- mark a Task as authoritative completion;
- archive or move the feature; or
- write `done`.

### Step 5: Read the Gate

Use `/ae:status`, `/ae:next`, or the dashboard to read the Gate projection.
These views must not infer state from plan checkboxes, notes, `review.md`, Task
status, Team messages, or directory names.

Interpret proof status as follows:

| Proof status | Meaning | Normal next action |
|---|---|---|
| `pending` | Admissible evidence is absent. | Perform or collect the current proof. Never interpret absence as pass. |
| `failed` | An admissible observation failed the obligation. | Fix the product or artifact, then create a legitimate new attempt. |
| `invalid` | Evidence violates schema, provenance, reference, non-vacuity, authority, or cardinality rules. | Correct the evidence path; amend only if the locked recipe itself must change. |
| `unavailable` | A required qualified capability cannot be used. | Restore or select a qualified capability, stop, or ask a person to confirm a material amendment. Do not silently downgrade. |
| `stale` | Evidence no longer matches the active Contract or source snapshot. | Re-run the proof against current bytes. The old event remains history. |
| `passed` | This proof is closed for the selected attempt. | Check every other proof, floor, amendment, integrity, and lifecycle condition. |

`retry`, `replan`, and `human_required` are Strategy actions, not alternative
Gate proof statuses.

Proof status is separate from lifecycle and integrity. Read the three axes
together:

| Axis/state | User meaning |
|---|---|
| `draft_unactivated` | A candidate may exist, but no Contract is current and no proof or finalization claim is allowed. |
| `active` | Normal work and proof may proceed, subject to `feature_status=ok`. |
| `paused` | Evidence may be inspected, but work, new proof, amendment, and finalization are blocked until resume. |
| `committed` | Historical proof-at-commit is read-only; normal finalization is no longer available. |
| `legacy_readonly` | A rollout-bound historical feature is served only by the permanent compatibility adapter. |
| `unresolved` | AE cannot reliably classify lifecycle state; preserve the state and diagnose. |
| `feature_status=ok` | The classified lifecycle branch is healthy. |
| `feature_status=integrity_recovery_required` | Stop ordinary operations and run only matching read-only diagnostics or recovery. |
| `feature_status=integrity_error` | Fail closed and preserve the evidence for human diagnosis. |
| `feature_status=unsupported_version` | Use a runtime that understands the stored semantics; do not guess or finalize. |

Even when every proof is `passed`, finalization remains false unless lifecycle,
feature integrity, floors, amendments, source state, and runtime identity are all
eligible.

### Step 6: Finalize once eligible

Only when the Gate reports `finalize_eligible=true`, request the sole finalizer.

**RELEASE-BLOCKER:** insert the exact supported user-facing Finalize action from
the accepted build. The architecture reserves lifecycle commit for
`ae-gate finalize`, but that internal entry-point name is not an unverified
public command recommendation.

The finalizer rechecks the active Contract, Ledger, source manifests, selected
attempts, runtime identity, and locks. It then performs the durable transaction
and reports the committed state. A Skill may request and display this operation;
it cannot replace it.

Do not manually move the feature to `done`, even if every proof appears passed.

## 4. When AE must ask you

AE should interrupt for a real authority decision:

- first activation of a Contract;
- a material Contract amendment;
- an explicit `human` proof;
- resolution of a material coverage gap;
- a new permission or irreversible external operation;
- a security, compliance, or product-policy choice; or
- continuation after a retry cap when the goal or Contract must change.

AE need not ask for every retry, stage transition, reviewer count, or topology
choice. If it can stop safely without changing the Contract, reaching an
attempt cap is not itself a reason to manufacture a user approval.

## 5. Amendments

A material change requires a new Contract revision. Examples include:

- adding, deleting, weakening, or strengthening an acceptance criterion;
- changing intent, in-scope or out-of-scope behavior;
- changing a proof's subject, source boundary, proof mode, security policy, or
  required independence; or
- changing a floor disposition.

The amendment keeps the old revision and evidence, drafts a new immutable
candidate, obtains fresh coverage, and shows you the exact changed view. Only
after your explicit acceptance does the new revision activate. v1 re-runs proof
for the new revision; an old pass is not carried forward.

Changing implementation order, retrying the same locked recipe, or adding a
temporary stricter check does not by itself require an amendment.

## 6. Choosing an execution topology

Use the smallest topology that satisfies the task and Contract.

| Need | Use |
|---|---|
| Straightforward implementation with no independent execution question | One mutation owner |
| One independent, return-only question | Anonymous read-only subagent |
| Several independent inspections or validations | Read-only fan-out |
| Evidence must be exchanged or competing hypotheses tested | Agent Team |
| Required capability or decision authority is absent | Human boundary |

Do not open a panel by default. Parallelize research and evidence, not product
decision ownership.

Coverage and every semantic proof judge require fresh context. A fresh context
must be bound to the exact subject and controlled inputs and must not be one of
the material authors of the claim. "I am independent" in model output is not
evidence of independence.

### Cross-family proof

Cross-family is used only when the Contract requires source-family independence
or when the Strategy chooses it without weakening required proof.

To count, the invocation must have correlated backend, input, output, lineage,
and assurance records. A different agent name, a provider label, or a same-family
fallback does not count. If a required cross-family provider is unavailable,
the proof is `unavailable`; AE must not substitute Claude self-review and call it
equivalent.

## 7. Pause, resume, and recovery

Three operations are different:

- **Claude Code session continuation** restores foreground UX;
- **feature resume** changes a logically paused AE feature back to active; and
- **transaction recovery** resolves an interrupted authority or finalization
  transaction.

Pausing and resuming append canonical events; they do not move the feature
directory. While paused, only read-only status/diagnostics, resume, and matching
recovery are allowed. Resume re-evaluates current bytes and the current Ledger
head rather than trusting session memory.

**RELEASE-BLOCKER:** document the exact accepted user-facing pause, resume, and
recover commands.

If status reports `integrity_recovery_required`:

1. stop normal work and all product mutation;
2. preserve the transaction, Ledger, and filesystem state;
3. inspect the named transaction with the supported diagnostic command; and
4. run only the matching recovery operation.

If the irreversible move already occurred, recovery proceeds forward to append
the fixed event and seal the transaction. Do not move the directory back.

If status reports `integrity_error`, fail closed. Preserve the evidence and seek
human diagnosis; do not edit the Ledger, journal, pointer, or target until the
failure has been understood.

If status reports `unsupported_version`, use a runtime that supports the stored
semantics. Do not finalize with a newer runtime that merely guesses at old event
meaning.

## 8. Actions that are never proof

Do not treat any of the following as completion:

- exit code zero without the locked adapter and non-vacuity facts;
- zero discovered tests;
- a plan checkbox or Task marked completed;
- a Team or mailbox message;
- `/goal` reporting achieved;
- a worker or reviewer saying "pass";
- a `review.md` verdict;
- notes, waivers, or manually edited status metadata; or
- the feature appearing under a `done` path.

Only canonical evidence reduced by the Gate and committed by the Finalizer has
lifecycle authority.

## 9. Forbidden operations

- Do not edit an activated Contract, lock, current pointer, Ledger/head, Gate
  runtime, policy snapshot, rollout state, lease, transaction, or committed
  target by hand.
- Do not use notes or review prose to claim that the user approved a boundary.
- Do not manually archive, restore, or move a v1 feature.
- Do not let `/ae:review`, a worker, a hook, or a public recorder write `done`.
- Do not run two product mutation owners in one repository.
- Do not use an implementation context as the sole judge of its material claim.
- Do not shop for a passing reviewer after the same semantic subject failed.
- Do not silently replace a required unavailable capability with a weaker one.
- Do not let a command recipe write AE authority paths or product paths outside
  the Contract boundary.
- Do not weaken the current Contract by changing the plan, selector, or worker
  instructions.

Maintainer-only publication checks and dogfood records belong in the
[acceptance dossier](acceptance-dossier.md), not in the user's completion path.
