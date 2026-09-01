# AE 1.0 pre-acceptance evidence dossier

> **Status: superseded.** Part of the pre-acceptance documentation set for the
> v1 Kernel, which was built, proven, never called, and then archived at tag
> `v1-kernel-archive`. It describes a component no current path reaches.
> **Do not follow it as instructions.** See [`rebuild.md`](../../../rebuild.md).

> **Pre-acceptance index.** This document is not a Gate, waiver, release
> verdict, or acceptance receipt. A `PASS` label in the eventual generated view
> must be copied from a canonical result reference; this Markdown file cannot
> create `PASS`. No release is claimed here.

## 1. Authority boundary

This dossier is a human-readable index over retained evidence for one exact
release candidate. It should be generated from a closed, non-authoritative JSON
index and be safe to delete and regenerate. Markdown is never parsed back into
canonical status.

The authority chain remains:

```text
frozen specification + exact release candidate
        ↓
canonical observations, qualifications, and closed release-evaluation results
        ↓
deterministic feature Gate projections + independent release checks
        ↓
this dossier (read-only index)
        ↓
separate human release decision bound to exact digests
```

The dossier does not contain its own digest field. Freeze its bytes, calculate
its digest externally, and bind that digest together with the exact release
candidate in a later acceptance event or receipt. Do not write the human
decision back into this file and create a self-referential approval cycle.

## 2. Release-candidate identity

Every field is required before the dossier can be frozen.

| Field | Exact value | Retained source |
|---|---|---|
| Source commit and tree | **RELEASE-BLOCKER** | **RELEASE-BLOCKER** |
| AE/plugin version | **RELEASE-BLOCKER** | **RELEASE-BLOCKER** |
| Release manifest ref/digest | **RELEASE-BLOCKER** | **RELEASE-BLOCKER** |
| Bootstrap launcher ref/digest | **RELEASE-BLOCKER** | **RELEASE-BLOCKER** |
| Core and validator refs/digests | **RELEASE-BLOCKER** | **RELEASE-BLOCKER** |
| Schema bundle and reducer refs/digests | **RELEASE-BLOCKER** | **RELEASE-BLOCKER** |
| Policy, adapter, lineage, tool, and renderer bundle digests | **RELEASE-BLOCKER** | **RELEASE-BLOCKER** |
| Runner and native filesystem helper identities | **RELEASE-BLOCKER** | **RELEASE-BLOCKER** |
| Claude Code version and invocation mode | **RELEASE-BLOCKER** | **RELEASE-BLOCKER** |
| OS/kernel/runtime/filesystem/mount/device selector | **RELEASE-BLOCKER** | **RELEASE-BLOCKER** |
| Dossier generator schema/build | **RELEASE-BLOCKER** | **RELEASE-BLOCKER** |

No local temporary path is a retained source. Every referenced artifact must be
content-addressed under the release evidence retention boundary.

## 3. Normative baseline

Record the exact digest of each frozen source rather than copying its prose into
this dossier.

| Precedence | Normative source | Digest | Retained copy |
|---:|---|---|---|
| 1 | Design: objects, states, authority boundaries, host binding | **RELEASE-BLOCKER** | **RELEASE-BLOCKER** |
| 2 | Acceptance and evaluation: hard release gates | **RELEASE-BLOCKER** | **RELEASE-BLOCKER** |
| 3 | Implementation plan: dependency order and cutover | **RELEASE-BLOCKER** | **RELEASE-BLOCKER** |
| 4 | Philosophy: design principles | **RELEASE-BLOCKER** | **RELEASE-BLOCKER** |
| 5 | Migration map: pre-v1 implementation facts | **RELEASE-BLOCKER** | **RELEASE-BLOCKER** |

The [v1+ roadmap](../v1-plus-roadmap.md) is explicitly excluded from this baseline
and cannot satisfy or waive a v1 release requirement.

## 4. Canonical evidence row

All generated matrices use the same minimum fields:

| Field | Rule |
|---|---|
| `requirement_id` | Closed identifier from the frozen acceptance plan |
| `expected` | One preregistered outcome; never “fail or pending” |
| `actual_state` | Exact canonical projection; unknown, unavailable, invalid, and N/A are not collapsed |
| `canonical_result_ref` | Content-addressed result or event reference from which the displayed state was copied |
| `raw_artifact_ref` | Raw output, fixture, trace, or observation |
| `digest` | Digest of the exact canonical result and, where applicable, the raw artifact |
| `environment_ref` | Exact host/platform/provider qualification selector |
| `replay_command_id` | Closed command identifier, not an unreviewed shell snippet |
| `independent_review_ref` | Bypass or independent check where required |

An evidenced N/A requires a canonical result and proof that the candidate path
is unreachable in the release. It is not a blank cell.

## 5. G0–G7 release scorecard

Populate state only from the closed release-evaluation result for each gate.
Feature Gate projections supply feature-level truth, but they cannot author the
overall release verdict; host live tests, paired value records, independent
bypass checks, and the later human release decision remain distinct authorities.

| Gate | Requirement | Actual state | Canonical result | Raw evidence | Independent check |
|---|---|---|---|---|---|
| G0 | Schema, path, canonicalization, runner, provider, and filesystem safety | **RELEASE-BLOCKER** | **RELEASE-BLOCKER** | **RELEASE-BLOCKER** | **RELEASE-BLOCKER** |
| G1 | Contract and human authority | **RELEASE-BLOCKER** | **RELEASE-BLOCKER** | **RELEASE-BLOCKER** | **RELEASE-BLOCKER** |
| G2 | Evidence integrity and provenance | **RELEASE-BLOCKER** | **RELEASE-BLOCKER** | **RELEASE-BLOCKER** | **RELEASE-BLOCKER** |
| G3 | Closure completeness and reducer purity | **RELEASE-BLOCKER** | **RELEASE-BLOCKER** | **RELEASE-BLOCKER** | **RELEASE-BLOCKER** |
| G4 | Resume, idempotency, and finalizer recovery | **RELEASE-BLOCKER** | **RELEASE-BLOCKER** | **RELEASE-BLOCKER** | **RELEASE-BLOCKER** |
| G5 | Claude Code host and instruction delivery | **RELEASE-BLOCKER** | **RELEASE-BLOCKER** | **RELEASE-BLOCKER** | **RELEASE-BLOCKER** |
| G6 | Unique authority, reader cutover, and migration | **RELEASE-BLOCKER** | **RELEASE-BLOCKER** | **RELEASE-BLOCKER** | **RELEASE-BLOCKER** |
| G7 | Actual value, minimal topology, and simplification | **RELEASE-BLOCKER** | **RELEASE-BLOCKER** | **RELEASE-BLOCKER** | **RELEASE-BLOCKER** |

Any failed hard gate blocks release. Reviewer count, a lead override, or a manual
status change cannot offset it.

## 6. Completion false-pass fixtures

All eight fixtures must fail closed with their preregistered typed reason.

| ID | Failure | Expected | Actual state | Result ref | Raw artifact |
|---|---|---|---|---|---|
| F1 | Zero-test pass | Fail closed | **RELEASE-BLOCKER** | **RELEASE-BLOCKER** | **RELEASE-BLOCKER** |
| F2 | Stale evidence | Fail closed | **RELEASE-BLOCKER** | **RELEASE-BLOCKER** | **RELEASE-BLOCKER** |
| F3 | Contract tamper | Fail closed | **RELEASE-BLOCKER** | **RELEASE-BLOCKER** | **RELEASE-BLOCKER** |
| F4 | Missing artifact or reference | Fail closed | **RELEASE-BLOCKER** | **RELEASE-BLOCKER** | **RELEASE-BLOCKER** |
| F5 | Fabricated or uncorrelated backend | Fail closed | **RELEASE-BLOCKER** | **RELEASE-BLOCKER** | **RELEASE-BLOCKER** |
| F6 | Manual bypass | Fail closed | **RELEASE-BLOCKER** | **RELEASE-BLOCKER** | **RELEASE-BLOCKER** |
| F7 | Early archive | Fail closed | **RELEASE-BLOCKER** | **RELEASE-BLOCKER** | **RELEASE-BLOCKER** |
| F8 | Forged semantic authority | Fail closed | **RELEASE-BLOCKER** | **RELEASE-BLOCKER** | **RELEASE-BLOCKER** |

Required aggregate: **8/8**. Do not use only the aggregate; retain each result.

## 7. Runner attack matrix

| Requirement | Required result | Actual state | Canonical result | Raw trace | Environment |
|---|---|---|---|---|---|
| R-01 through R-12, including every specified sub-arm | Exact preregistered outcome for every arm | **RELEASE-BLOCKER** | **RELEASE-BLOCKER** | **RELEASE-BLOCKER** | **RELEASE-BLOCKER** |

Required aggregate: **12/12**, with distinct retained rows for sub-arms such as
R-10a and R-10b. The generated dossier must expand this summary into one row per
closed case; a summary-only aggregate is insufficient.

## 8. Host and Pattern failure matrix

| Requirement | Expected | Actual state | Canonical result | Unreachable-path evidence, if N/A | Host matrix |
|---|---|---|---|---|---|
| AP-01 through AP-17, including every specified sub-arm | **RELEASE-BLOCKER:** preregister exactly `PASS` or `evidenced N/A` for each expanded arm before execution | **RELEASE-BLOCKER** | **RELEASE-BLOCKER** | **RELEASE-BLOCKER** | **RELEASE-BLOCKER** |

Required aggregate: every AP arm meets its one preregistered expectation. An N/A
expectation is legal only when the capability is not published and exact
unreachable-path evidence is retained. Expand AP-02a/AP-02b and every other
specified arm separately.

## 9. Dogfood and normal-use streak

| ID | Scenario | Required result | Feature/Contract | Gate/finalize refs | Raw records |
|---|---|---|---|---|---|
| D1 | Command-only small change | Correct direct closure | **RELEASE-BLOCKER** | **RELEASE-BLOCKER** | **RELEASE-BLOCKER** |
| D2 | Cross-file refactor | Source/stale/single-writer behavior | **RELEASE-BLOCKER** | **RELEASE-BLOCKER** | **RELEASE-BLOCKER** |
| D3 | Fact-bearing document or artifact | Fresh judge and traceable claims | **RELEASE-BLOCKER** | **RELEASE-BLOCKER** | **RELEASE-BLOCKER** |
| D4 | Human proof | Correlated, rejectable human decision | **RELEASE-BLOCKER** | **RELEASE-BLOCKER** | **RELEASE-BLOCKER** |
| D5 | Planted coverage gap | Human scope/amendment authority | **RELEASE-BLOCKER** | **RELEASE-BLOCKER** | **RELEASE-BLOCKER** |
| D6 | Required cross-family | Correlated available and explicit unavailable arms | **RELEASE-BLOCKER** | **RELEASE-BLOCKER** | **RELEASE-BLOCKER** |

Code-freeze normal-use streak:

| Sequence | AE-on-AE feature | Enforce result | Release identity | Evidence |
|---:|---|---|---|---|
| 1 | **RELEASE-BLOCKER** | **RELEASE-BLOCKER** | **RELEASE-BLOCKER** | **RELEASE-BLOCKER** |
| 2 | **RELEASE-BLOCKER** | **RELEASE-BLOCKER** | **RELEASE-BLOCKER** | **RELEASE-BLOCKER** |
| 3 | **RELEASE-BLOCKER** | **RELEASE-BLOCKER** | **RELEASE-BLOCKER** | **RELEASE-BLOCKER** |

Required result: all six dogfood scenarios and three consecutive normal
AE-on-AE features through the enforce path.

## 10. Requirement traceability

Generate one row for every normative requirement, including negative and crash
requirements.

| Requirement ID | Implementation ref | Test/fixture ref | Canonical result | Raw evidence | Deviation/risk ref |
|---|---|---|---|---|---|
| **RELEASE-BLOCKER:** generated complete matrix | **RELEASE-BLOCKER** | **RELEASE-BLOCKER** | **RELEASE-BLOCKER** | **RELEASE-BLOCKER** | **RELEASE-BLOCKER** |

The completeness check must compare the closed requirement catalog with this
index. A missing row is a blocker, not an implied N/A.

## 11. Qualification catalog

Record separately qualified capabilities. A directory no-replace result cannot
qualify file no-replace, and a declared sandbox cannot qualify an isolation
provider.

| Capability | Exact selector | Result ref/digest | Live probe | Fault suite | Release disposition |
|---|---|---|---|---|---|
| Active installed release | **RELEASE-BLOCKER** | **RELEASE-BLOCKER** | **RELEASE-BLOCKER** | dual-root/stale-session/direct-import | **RELEASE-BLOCKER** |
| Child-process isolation provider | **RELEASE-BLOCKER** | **RELEASE-BLOCKER** | **RELEASE-BLOCKER** | escape/network/env/child lifecycle | **RELEASE-BLOCKER** |
| Atomic directory no-replace | **RELEASE-BLOCKER** | **RELEASE-BLOCKER** | **RELEASE-BLOCKER** | race/no-clobber/parent fsync/power loss | **RELEASE-BLOCKER** |
| Atomic file no-replace | **RELEASE-BLOCKER** | **RELEASE-BLOCKER** | **RELEASE-BLOCKER** | race/no-clobber/parent fsync/power loss | **RELEASE-BLOCKER** |
| Claude Code tool mapping | **RELEASE-BLOCKER** | **RELEASE-BLOCKER** | **RELEASE-BLOCKER** | unknown/changed tool semantics | **RELEASE-BLOCKER** |
| Renderer and view delivery | **RELEASE-BLOCKER** | **RELEASE-BLOCKER** | **RELEASE-BLOCKER** | injection/encoding/byte limit/truncation | **RELEASE-BLOCKER** |
| Provider lineage/backend correlation | **RELEASE-BLOCKER** | **RELEASE-BLOCKER** | **RELEASE-BLOCKER** | fallback/substitution/no-call/replay | **RELEASE-BLOCKER** |

## 12. Rollout, migration, and finalization

| Property | Required result | Actual state | Canonical result | Raw evidence |
|---|---|---|---|---|
| Every shadow divergence has a disposition | Zero unresolved | **RELEASE-BLOCKER** | **RELEASE-BLOCKER** | **RELEASE-BLOCKER** |
| Rollout lock and matching PUBLISHED witness | Healthy enforce | **RELEASE-BLOCKER** | **RELEASE-BLOCKER** | **RELEASE-BLOCKER** |
| New/migrated production finalization entries | Exactly one | **RELEASE-BLOCKER** | **RELEASE-BLOCKER** | **RELEASE-BLOCKER** |
| Early or double finalize | Zero | **RELEASE-BLOCKER** | **RELEASE-BLOCKER** | **RELEASE-BLOCKER** |
| Replay divergence | Zero | **RELEASE-BLOCKER** | **RELEASE-BLOCKER** | **RELEASE-BLOCKER** |
| Unauthorized amendment | Zero | **RELEASE-BLOCKER** | **RELEASE-BLOCKER** | **RELEASE-BLOCKER** |
| Crash/recovery matrix | Unique result at every injection point | **RELEASE-BLOCKER** | **RELEASE-BLOCKER** | **RELEASE-BLOCKER** |
| Legacy-live migration join | Every locked item taken over; zero prose consumer | **RELEASE-BLOCKER** | **RELEASE-BLOCKER** | **RELEASE-BLOCKER** |
| Historical legacy done | Read-only adapter, unchanged history | **RELEASE-BLOCKER** | **RELEASE-BLOCKER** | **RELEASE-BLOCKER** |
| Fresh legacy project compatibility | Shadow/reader/migrate-on-touch still available | **RELEASE-BLOCKER** | **RELEASE-BLOCKER** | **RELEASE-BLOCKER** |

## 13. Value and cost

Keep raw, paired records rather than only averages. Every non-baseline arm must
share a comparison ID with the solo baseline.

| Comparison ID | Task class | Baseline arm | Candidate arm | Correctness | Time | Tokens | Useful findings | Duplicate/invalid findings | Human interruptions | Raw records |
|---|---|---|---|---|---|---|---|---|---|---|
| **RELEASE-BLOCKER** | **RELEASE-BLOCKER** | **RELEASE-BLOCKER** | **RELEASE-BLOCKER** | **RELEASE-BLOCKER** | **RELEASE-BLOCKER** | **RELEASE-BLOCKER** | **RELEASE-BLOCKER** | **RELEASE-BLOCKER** | **RELEASE-BLOCKER** | **RELEASE-BLOCKER** |

An unavailable measure is `null` plus an explicit unavailable reason, never
zero. If a more complex default Pattern exceeds the preregistered budget or
does not repeatedly outperform solo, narrow the default Pattern; never weaken
proof requirements to improve the metric.

## 14. Documentation deliverables

| Deliverable | Exact RC-bound digest | Fresh-session verification | Status source |
|---|---|---|---|
| [Design and limitations](design-and-limitations.md) | **RELEASE-BLOCKER** | as-built mapping and limitation audit | **RELEASE-BLOCKER** |
| [Usage guide](usage-guide.md) | **RELEASE-BLOCKER** | clean-session replay of supported paths | **RELEASE-BLOCKER** |
| [v1+ roadmap](../v1-plus-roadmap.md) | Optional publication digest; excluded from v1 acceptance | non-authority/exclusion check only | excluded from v1 acceptance |
| This dossier | external digest after freeze | clean-clone ref/digest verification | no self-verdict |

Documentation acceptance must confirm that current released behavior is not
described using normative future tense and that unsupported host/platform arms
are not presented as available.

## 15. Known limitations and residual risk

This section may index only an as-built limitation and its separate human risk
decision. It cannot invent a waiver.

| Risk ID | Design limitation ref | Observed exposure | Human decision ref | Residual risk |
|---|---|---|---|---|
| **RELEASE-BLOCKER:** generated risk register | **RELEASE-BLOCKER** | **RELEASE-BLOCKER** | **RELEASE-BLOCKER** | **RELEASE-BLOCKER** |

## 16. Open blockers

The initial draft carries three explicit implementation prerequisites. They
remain blockers until replaced by canonical evidence and the resulting status;
work-in-progress prose is not closure.

| Blocker | Required closure | Canonical status/evidence |
|---|---|---|
| Six malformed frontmatter definitions and the invalid E3 attribution | Fix all six definitions; pass negative fixtures and plugin validation; capture effective host metadata; re-run the preregistered two-axis E3 comparison before retaining any model/profile conclusion | **RELEASE-BLOCKER** |
| Active-release, child isolation, and filesystem primitives | Complete live spikes and qualification for active-release identity, child isolation, atomic directory no-replace, and atomic file no-replace on every release environment; otherwise narrow support or stop release | **RELEASE-BLOCKER** |
| F-082 duplicate identity across live/done inventory | Human disposition followed by two exact, unique rollout partition scans before publishing the rollout lock | **RELEASE-BLOCKER** |

The generated dossier must also list every non-passing canonical requirement,
not only these known prerequisites.

## 17. Independent bypass and replay checks

At least one release-critical conclusion must be checked without depending on
the same Gate implementation under test.

| Check | Required method | Result/evidence |
|---|---|---|
| Canonical JSON/NDJSON and digest replay | Independent implementation over retained bytes | **RELEASE-BLOCKER** |
| Ledger head and reducer replay | Clean process or implementation over exact release inputs | **RELEASE-BLOCKER** |
| Release manifest/member verification | Clean clone before importing release code | **RELEASE-BLOCKER** |
| Finalizer journal/snapshot cross-check | Read-only independent reconstruction | **RELEASE-BLOCKER** |
| Reference and digest existence | Traverse every dossier ref in retained storage | **RELEASE-BLOCKER** |
| Secret and absolute-path scan | Reject secrets, machine-local `/tmp` paths, and ephemeral refs | **RELEASE-BLOCKER** |
| Raw-to-sanitized publication mapping | Raw digest plus explicit redaction manifest | **RELEASE-BLOCKER** |

## 18. Reproduction and retention

For every replayable result, record:

- a closed command ID resolved by the accepted release;
- input fixture and environment manifest digests;
- exact stdout/stderr or structured raw artifact refs;
- expected typed outcome;
- result and runtime identities; and
- retention and redaction policy.

Do not embed secrets or turn arbitrary command text from an artifact into a
reproduction instruction. Public sanitized artifacts retain the raw artifact's
digest and a redaction manifest so that publication does not silently change the
claim.

## 19. Pre-acceptance handoff

When every placeholder is resolved:

1. regenerate this dossier from the closed index;
2. verify that no placeholder, missing ref, temporary path, or uncorrelated PASS
   remains;
3. freeze the exact dossier bytes;
4. calculate its digest externally;
5. bind the dossier digest, release-candidate digest, and normative baseline
   digests in a pre-acceptance handoff; and
6. obtain the final human accept or reject as a separate canonical event or
   receipt.

The acceptance event may point to the frozen dossier. It must not modify the
dossier and then claim that the newly modified bytes were what the person
accepted.
