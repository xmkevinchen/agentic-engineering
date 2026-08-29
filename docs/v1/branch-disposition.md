# AE v1 — branch disposition

> **Status:** historical (2026-08-28) — accurate as the record of where each branch's thinking went; the v1 they converged into is archived (tag `v1-kernel-archive`). One row per source branch and per superseded design goal.
> Records where each branch's thinking went, and why.

Consolidation branch: `feature/ae-v1-consolidation`, created from
`feature/ae-v1-implementation` at `bb57d6e6065e8504c75c8168c505341ec5797e6e`
(the final WP-P0.1 commit).

Statuses used below: `merged`, `referenced`, `superseded`, `deferred`,
`rejected`, `already-mainline`.

## 1. Branches

### `feature/ae-v1-implementation` @ `bb57d6e`

| Field | Value |
|---|---|
| Original goal | Land the executable v1 foundation: Phase-0 metadata repairs, the P0.G-lite feasibility spike, and the WP-P0.1 foundation freeze. |
| Retained insight | Canonical bytes and raw-byte digests; a pinned validator toolchain; closed tree-snapshot profiles; the acyclic release-bootstrap build; the policy materialization/replay split; semantic blindness; and the discipline that a fixture producer declares itself unqualified rather than minting authority. |
| Status | `merged` — this is the consolidation branch's base. |
| Destination | Kept in place as `plugins/ae/tests/foundation/**` and `plugins/ae/tests/fixtures/v1-foundation/**`. Disposition in [`mechanism-disposition.md` §5](mechanism-disposition.md#5-disposition-of-the-p01-corpus). |
| Reason | It is passing, mutation-tested, honestly scoped, and its own freeze record already declines to be a second authority. Nothing about the consolidation invalidates it. |

### `feature/ae-v1-plus-loom-plan` @ `b2b3d92`

| Field | Value |
|---|---|
| Original goal | Define AE v1 from the user's side (design and limitations, usage guide, acceptance dossier) and set out the v1+ roadmap including a Loom distributed execution/control plane. |
| Retained insight | The product definition and the trust-boundary language; the invariant set; "coordination plane is not truth plane"; **native Agent Teams first, cross-family bridge only for the remaining gap** (roadmap §3.2); the admission model that has no ambiguous `planned` state; and the rule that a roadmap item may not satisfy or waive a v1 requirement. |
| Status | `merged` |
| Destination | Product definition, trust boundary, and role/handoff material → [`design.md`](design.md) §§1–2, 4, 8. Release criteria → [`acceptance.md`](acceptance.md). The three pre-acceptance documents are retained verbatim under [`superseded/`](superseded/). The roadmap stays current *as a non-normative roadmap* at [`v1-plus-roadmap.md`](v1-plus-roadmap.md). |
| Reason | Its user-facing framing is the best statement of what AE v1 is for. Its as-built documents describe the larger v1 that this consolidation narrows, so they become historical rather than current. |

### `docs/ae-v1-preacceptance` @ `eeb9142`

| Field | Value |
|---|---|
| Original goal | Draft the v1 pre-acceptance documentation set. |
| Retained insight | Same as above — this branch's commits are the first three of `feature/ae-v1-plus-loom-plan`. |
| Status | `merged` (transitively) |
| Destination | Reached the consolidation branch through `feature/ae-v1-plus-loom-plan`. It was **not** merged separately; doing so would have duplicated history. |
| Reason | `eeb9142` is an ancestor of `b2b3d92`. One merge carries both. |

### `feature/ae-v1-contract-formation` @ `5c9e5e6`

| Field | Value |
|---|---|
| Original goal | F-084: specify a Contract Formation phase — how repository facts, intent, assumptions, unknowns, alternatives, and decisions become an exact Contract candidate. F-085: implement it across the Claude Code skills. |
| Retained insight | The CF-01…CF-09 failure model; the separation of Contract Formation from Proof Execution; the planner as compiler rather than sole author; the human owning the material boundary; pre-Contract material never being completion Evidence; formation scaling with task geometry rather than mandating a pipeline; and CF-09 — that unnecessary ceremony is itself a product failure. |
| Status | `merged` — and both features are **`absorbed_and_replanned`**. |
| Destination | [`design.md` §7](design.md#7-contract-formation). The failure model is retained in full; the mechanism is collapsed to one shared formation basis and one view. |
| Reason | The problem F-084 identified is real and belongs in v1: a Contract can be perfectly proven and still be the wrong Contract. The *response* — a formation plane with its own schema family, a per-skill artifact set, and F-085's seven work packages threaded through the old P0–P3 milestones — repeats the pattern this consolidation exists to stop. F-084 and F-085 are therefore not continued as originally scoped. |

**Note on the merged files.** This branch tracked
`.ae/features/active/F-084-*/` and `.ae/features/active/F-085-*/`, which sit
under a gitignored path (`.ae/*`) that `test-graph-gitignore.sh` asserts stays
excluded — only `.ae/graph/` is version-controlled. Merging the branch tracked
them and turned that guard red, so they were untracked on the consolidation
branch (`80cff4b`). The files remain on disk as ordinary gitignored process
artifacts, the source branch keeps them, and the merge ancestry still carries
them. Their bytes were never edited, `status: active` frontmatter included: this
document is the authority on their disposition, not their frontmatter.

### `docs/ae-v1-implementation-thinking` @ `8d8b1cc`

| Field | Value |
|---|---|
| Original goal | Preserve F-083's bootstrap reasoning: the frozen goal, decision register, material revisions M3–M4, the E3 execution amendments, the handoff protocol, and the early implementation plan. |
| Retained insight | The handoff protocol's structure (work order → work result → verification subject → accepted attempt) informs the Assignment and Evidence Package objects. The decision register is the record of why the earlier design took the shape it did. |
| Status | `referenced` — deliberately **not merged**. |
| Destination | Cited from [`history.md`](history.md). The branch and commit `8d8b1cc` are kept intact. |
| Reason | It is valuable archaeology and would be a second authority if merged. Its goals and plans are historical; nothing in it is current work. |

### `feature/f-080-gemini-cross-family-path` @ `dbd6088` and `feature/f-082-openai-compat-bridge` @ `b8f6804`

| Field | Value |
|---|---|
| Original goal | The Gemini cross-family path and the generic OpenAI-compatible bridge. |
| Retained insight | Together with the Codex proxy, these are `agent-proxy`: the transport that supplies an optional cross-family seat. |
| Status | `already-mainline` — both are ancestors of the consolidation branch. No feature merge was performed or needed. |
| Destination | [`design.md` §5](design.md#5-agent-proxy) treats them as available execution substrate and transport capability. |
| Reason | They are execution substrate, not proof truth, family authority, or an orchestrator. v1 uses them; it does not rebuild them. |

### `fix/graph-recovery-after-corpus-loss` @ `badcb44`

| Field | Value |
|---|---|
| Original goal | Restore the knowledge-graph index after corpus loss. |
| Status | `already-mainline` — ancestor of the consolidation branch. |
| Destination | The `.ae/graph` corpus stays, outside the completion path ([`design.md` §6](design.md#6-knowledge-feedback)). |
| Reason | Nothing to consolidate. |

## 2. Superseded design goals

| Goal | Where it came from | Status | Why |
|---|---|---|---|
| `docs/references/finalized/**` as the sole current v1 specification | Design freeze, 2026-08-23 | `superseded` | Demoted to normative design input and audit record. [`design.md`](design.md) and [`implementation-plan.md`](implementation-plan.md) are the current pair. Its bytes are unchanged; its README now states the change. |
| The P0.2–P0.10 / P1–P6 phase plan | `finalized/implementation-plan.md` | `superseded` | Replanned item by item in [`implementation-plan.md` §3](implementation-plan.md#3-replan-of-the-old-p0p6-packages). |
| F-084 Contract Formation Phase (as a specification amendment with its own object family) | `feature/ae-v1-contract-formation` | `absorbed_and_replanned` | Problem retained in [`design.md` §7](design.md#7-contract-formation); mechanism collapsed to one shared basis. |
| F-085 formation-aware skills (seven work packages joined to the old milestones) | `feature/ae-v1-contract-formation` | `absorbed_and_replanned` | The milestones it attached to no longer exist. Formation behavior arrives with the slice that needs it. |
| Loom as a v1 dependency | `feature/ae-v1-plus-loom-plan` | `deferred` | It is a v1+ hypothesis in the roadmap's own admission model, and the roadmap says so. [`mechanism-disposition.md` §3](mechanism-disposition.md#3-defer) names the condition for revisiting it. |
| Recursive bootstrap qualification ceremony | F-083 / E3 line of work | `rejected` | Each round generated another round and produced no user-visible capability. See [`mechanism-disposition.md` §4](mechanism-disposition.md#4-remove-or-prohibit-in-v1). |

## 3. What was not touched

- No source branch was deleted.
- No worktree was removed. `/Users/ckai/Projects/ae-v1-plus-plan` still holds
  `feature/ae-v1-plus-loom-plan`.
- No design history was deleted. `docs/ae-v1-design-history/**` and
  `docs/references/finalized/**` are intact.
- No production runtime or test code changed in this consolidation.
- Nothing was pushed to any remote.
