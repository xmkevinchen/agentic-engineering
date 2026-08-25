# Old mechanisms — disposition

> **Status:** current. Companion to [`design.md`](design.md). Every mechanism
> proposed or built under the earlier v1 design is reviewed here and given one
> disposition. Nothing carries forward by default.

Four dispositions:

| Disposition | Meaning |
|---|---|
| **keep** | Retained in v1 as designed. It earns its complexity now. |
| **simplify** | The property is retained; the mechanism is narrowed to what a real slice needs. |
| **defer** | Not v1. Revisit when a named condition occurs. Deferring it must not make it a v1 blocker in disguise. |
| **remove** | Not built, or not continued. The reason is stated, because a removal without a reason grows back. |

Where a mechanism already exists as executable code, that is noted — a
disposition of `simplify` or `defer` never means deleting the P0.1 corpus, which
stays as a frozen, passing test asset regardless.

## 1. Keep

| Mechanism | Why it stays |
|---|---|
| Restricted canonical JSON and raw-byte digests | The cheapest way to make "which bytes were approved" answerable. Already implemented and passing. |
| Pinned Ajv standalone validator build | Validation that drifts with a floating dependency is not validation. The pin is the whole point. |
| Closed schemas, fail-closed — **for objects actually in use** | Retained as a principle. Its scope is narrowed under *Simplify*: closed schemas apply to the six durable objects, not to a pre-frozen catalog. |
| Release manifest with a no-self-digest build DAG | An acyclic build order is a correctness property of any content-addressed manifest, not extra ceremony. Already implemented. |
| Path traversal / symlink / collision adversarial corpus | Real attack surface, cheap to keep, already written and passing. |
| Policy byte snapshot, upgrade-by-new-path, historical replay | Lets a policy change without rewriting history. This is what makes "the Contract as approved" durable across upgrades. |
| Contract / Strategy separation | The invariant the whole product rests on. Without it, a plan can weaken its own obligation. |
| Agent self-report is never sufficient Evidence | The failure mode AE exists to prevent. |
| Fresh reviewer / responsibility independence | The other failure mode AE exists to prevent. |
| Deterministic Gate and a single completion writer | Two writers of "done" is two truths. |

## 2. Simplify

| Mechanism | Old shape | v1 shape | Reason |
|---|---|---|---|
| Tree snapshot | Observed-source *and* synthetic `expected_after_move` projection, sized for crash recovery | Actual observation first. Keep the projection code and its corpus; do not make any v1 consumer depend on the synthetic side. | The projection exists to support crash recovery that v1 does not implement. Depending on it now would be building the consumer before the feature. |
| Active release identity | Global "this is the active release" attestation | Invocation-bound release identity, or an honest `unavailable`. | If the host cannot prove which release is globally active, AE must say so. Simulating external trust with in-process sealing (WeakSet, branded objects) proves nothing an attacker could not also produce — see *Remove*. |
| Ledger | Full event-family coverage designed up front | Append and replay for exactly the events one vertical slice produces. | Event families that have no producer are guesses about the future encoded as schema. |
| Filesystem safety | Full power-loss / mount / device qualification matrix | What `atomicFileNoReplace` actually does: `O_EXCL` no-clobber, short-write detection, `fsync` of file **and** parent directory, and **final-component** symlink refusal. Parent-path components are *not* walked by the primitive — the caller must preflight, as `policy-bundle.mjs` does. **Not staging:** a failed write leaves an empty or truncated file, detectable because its content will not match its digest. | These cover the failures a normal session actually hits. Staging via temp-file-plus-`link` would change the frozen mechanism rather than repair it, so it is deferred with formal durability qualification, which moves to V5 behind an observed failure. |
| Contract Formation | A formation artifact family per skill (F-084/F-085 direction) | One shared formation basis plus one view, consumed by every skill that touches it. | Per-skill formats multiply the trace problem instead of solving it. |
| Closed schema set | Freeze all authoritative schemas before the first user flow (old P0.2) | Freeze a schema when its slice has a real producer and a real consumer. | Freezing dozens of schemas before any user-visible flow was the largest single source of the previous plan's stall. |
| Agent topology | Agent Team, cross-family, and fixed reviewer rosters as defaults | Chosen per task geometry; Solo is the default. | Ceremony that does not pay for itself is a product defect (CF-09 in `design.md` §7.1). |

## 3. Defer

Each deferred item names the condition that would bring it back.

| Mechanism | Revisit when |
|---|---|
| Loom control plane / distributed execution | AE has a working single-host Harness *and* an operator problem that native Agent Teams demonstrably cannot express. |
| Portable multi-host AE runtime; native Codex frontend | A second frontend is actually wanted, and the v1 semantics have stabilized enough to be worth extracting. |
| Hosted / AE-owned durable state provider | Local artifacts demonstrably fail a real user need. |
| Full active-release host/session/cache qualification matrix | An observed case where invocation-bound identity produced a wrong acceptance. |
| Immutable provider qualification catalogs | A cross-family seat is shown to have been believed when it should not have been. |
| Complete filesystem / mount / power-loss matrices | A real interruption corrupts real state. |
| Legacy migration and general rollout machinery | v1 has users with legacy features to migrate. Until AE v1 is used on something, there is nothing to roll out. |
| Complex finalizer crash recovery | An interrupted acceptance leaves a state that ordinary no-clobber writes cannot resolve. |
| General policy-extension publication system | A second project needs a policy that the first project's approach cannot express. |
| Automatic knowledge-to-policy promotion | Knowledge has produced enough accepted proposals for the pattern to be worth automating. Not before V4 has real data. |
| Every schema not exercised by the first vertical slices | Its slice arrives. |
| `agents-peer`-class native cross-family session bridge | The narrow gap it addresses — a symmetric native Codex/Claude host team — actually blocks a Contract. agent-proxy covers the seat-level need in v1. |

**Deferral discipline:** a deferred item may not appear as a prerequisite of a
V0–V5 exit condition. If a slice cannot proceed without a deferred mechanism,
that is a planning error to be reported, not a quiet re-promotion.

## 4. Remove or prohibit in v1

| Practice | Why it is prohibited |
|---|---|
| Branded objects / `WeakSet` sealing presented as external proof | A caller-written field wrapped in an in-process brand is still a caller-written field. It records that a value passed through a producer, not that the producer's inputs were trustworthy. Using it to describe external trust is a false claim in the product's own voice. |
| Recursive bootstrap ceremony to "prove the proof system" | Each round produced another round. It generated no user-visible capability and no evidence a user could act on. |
| Positive authority fixtures built where no producer exists, then described as qualification | A fixture that mints a `qualified: true` with no real provider behind it is the exact false-acceptance AE claims to prevent. (The P0.1 corpus is explicitly the opposite of this: every fixture producer declares `qualified: false` and `fixture_only: true`. That is why it stays.) |
| Implementing dozens of schemas before any user flow exists | Ordering that guarantees the product cannot be dogfooded until the end, which is when design errors are most expensive. |
| A fixed `analyze → discuss → plan → work → review` command chain | Commands are controllers and views. Making the chain mandatory converts a useful default into ceremony and hides the fact that completion is defined by the Contract, not by the sequence. |
| Treating Agent Teams task completion, mailbox messages, summaries, or `/goal` as completion | Coordination state is lossy and retryable by design. Reading it as truth reintroduces exactly the failure v1 exists to remove. |
| Cross-family review as a default cost on every task | It is a risk-selected seat, not a ritual. Charging every task for it makes the product worse and teaches users to skip it. |

## 5. Disposition of the P0.1 corpus

The foundation freeze delivered under WP-P0.1 (`plugins/ae/tests/foundation/`,
`plugins/ae/tests/fixtures/v1-foundation/`, and
`plugins/ae/docs/references/v1-foundation-freeze.md`) is **kept in place and
unchanged** by this consolidation.

- It is a passing, mutation-tested corpus. It runs as part of the standard suite.
- Its modules under `tests/foundation/lib/` remain the candidate implementations
  for canonical bytes, tree snapshots, the policy bundle, and the release
  bootstrap. V1 promotes what it actually needs; it does not promote the set
  wholesale.
- Its own scope statement already excludes Gate, Ledger, Contracts, lifecycle,
  and rollout. That statement stands.
- Its freeze record is an implementation record, not a second design authority,
  and it says so.

No part of this consolidation deletes, rewrites, or reinterprets it.
