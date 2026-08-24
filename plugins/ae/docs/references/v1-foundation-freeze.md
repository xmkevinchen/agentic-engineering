# AE 1.0 foundation freeze — implementation record

> F-083 / WP-P0.1. Records the concrete implementation choices behind the five
> foundational mechanisms and points at the executable corpus that holds them.

This document is **not** a second authority. `.ae/1.0/finalized/` is the only v1
specification; every section below cites the clause it implements and records
only what the specification leaves to the implementer: exact versions, file
formats, build order, error codes, and ownership. Where a reading was genuinely
underdetermined, the section says so and names the choice made.

Normative documents at the time of this freeze:

| Document | SHA-256 |
|---|---|
| `finalized/design.md` | `14e9aa2a153f8f5af00771c8c4fdd9307cf206533f6b984826c444bd2e06c672` |
| `finalized/implementation-plan.md` | `6cc35d538ec56b4f348805064e9f7f5d5934d2692074f0e107b17b681e75be92` |
| `finalized/acceptance-and-evaluation.md` | `db9eee35ae587f8f0e474cc578d410ca6bb8b124549e0c126c9bd5f0c01430a3` |

## Layout

```text
plugins/ae/tests/foundation/
├── lib/                  frozen mechanism implementations
│   ├── errors.mjs            typed error taxonomy
│   ├── canonical-json.mjs    restricted JCS: strict parse + canonical bytes
│   ├── tree-snapshot.mjs     ae.tree-snapshot.v1
│   ├── policy-bundle.mjs     materialization + activation/replay split
│   └── release-build.mjs     fixture release assembly (NOT a mechanism module)
├── oracle/               independent canonical-bytes oracle
├── corpus/               fixture tree definitions shared by builders and verifiers
├── release-template/     launcher template and the two fixture-scoped members
├── build/                build-only Node toolchain + fixture generators
└── bin/                  deterministic verifiers

plugins/ae/tests/fixtures/v1-foundation/
├── canonical-bytes/      inputs, hand-authored expected bytes, cases.json
├── validator/            schema, generated standalone validator, pin, cases
├── tree-snapshot/        frozen entry projections per profile
├── policy-bundle/        three plugin policy trees
└── (release-bootstrap and semantic-blind are built into temp dirs at run time)
```

Run: `sh plugins/ae/tests/scripts/test-v1-foundation-freeze.sh` (discovered
automatically by `plugins/ae/scripts/ae-run-tests.sh` through the `test-*.sh`
convention).

## Ownership

`lib/` holds the mechanism implementations that P1 is expected to promote into
`plugins/ae/runtime/`. They live under `tests/` today because **this package
freezes mechanisms, it does not ship a release**: creating
`plugins/ae/release-manifest-v1.json` or `plugins/ae/runtime/ae-gate.mjs` would
assert an installed release exists, which is exactly what the scope boundary
forbids. `release-build.mjs`, `release-template/`, and everything under `corpus/`
and `bin/` are fixture machinery and are not candidates for promotion.

## 1. Canonical bytes

Implements `finalized/design.md` §6.0 (canonical bytes and digest) and
`acceptance-and-evaluation.md` G0.2.

Frozen profile:

| Rule | Choice |
|---|---|
| Encoding | UTF-8, no BOM. A leading `EF BB BF` is `byte_order_mark`, not stripped. |
| Malformed UTF-8 | `invalid_utf8`, via `TextDecoder(..., {fatal: true})`. |
| Unpaired surrogates | `lone_surrogate`. Reachable only through a `\uXXXX` escape; passing one through would let UTF-8 encoding silently substitute U+FFFD and change the bytes an identity is computed over. |
| Duplicate keys | `duplicate_key`, detected as keys are read and before any property is materialized. |
| Number domain | Integers in `[-(2^53-1), 2^53-1]`. Fractions, exponents, `NaN` and `Infinity` are refused. |
| `-0` | `negative_zero`. It canonicalizes to `0`, so admitting it would make two distinct inputs share bytes silently. |
| Member ordering | Ascending UTF-16 code units, per JCS. This is **not** code-point order: a surrogate pair sorts below U+E000..U+FFFF. |
| Escaping | `\b \t \n \f \r` for those five controls, `\"` and `\\`, `\u00xx` lowercase hex for the remaining C0 controls. Nothing else is escaped — not `/`, not DEL, not U+2028/U+2029. |
| Unicode normalization | None. NFC and NFD forms are different values with different digests. |
| Digest | `sha256:` + 64 lowercase hex. |
| NDJSON | One already-canonical object per line, terminated by exactly one LF. A line that is semantically correct but not canonically spelled is `ndjson_not_canonical`, not silently repaired. |

**Why the parser is hand-written.** Three rules cannot be recovered after
`JSON.parse` returns: duplicate keys are already collapsed, `-0`/`1.0` are
indistinguishable from `0`/`1`, and exponent forms are normalized away. This is a
*lexical* parser, not a schema validator — see §2 for why that distinction is
load-bearing.

**Corpus.** `fixtures/v1-foundation/canonical-bytes/` holds 51 cases: 17 positive
canonicalizations, 24 rejections, 3 NDJSON acceptances, 7 NDJSON rejections. Four
of the positive cases form one equivalence group — four distinct byte sequences
with one canonical form — which is what makes "pretty printing, mtime and platform
line endings are outside the semantic digest, while artifact identity uses raw
bytes" a single testable statement.

The expected canonical bytes in `build/build-canonical-fixtures.mjs` are
**hand-authored constants read off the rules above**, not captured from the
implementation. Three parties must agree with them: `lib/canonical-json.mjs`, an
independent oracle (`JSON.parse` plus a table-driven serializer that sorts by an
explicit code-unit predicate), and the system `shasum -a 256` binary for the
expected digests.

## 2. Validator toolchain

Implements `implementation-plan.md` §2 (`runtime/validators-v1.mjs`) and G0.1.

| Pin | Value | Why |
|---|---|---|
| Node | `>=22.12.0 <23.0.0` | 22.12.0 is the first release of the Node 22 LTS line. This is a **deliberately narrow frozen choice**, not an observation: the development host runs v22.23.2, which is *not* the supported minimum. Widening to the 24 LTS line requires P0.7/P0.8 host qualification. |
| Ajv | `8.20.0` exactly | `build/package-lock.json` pins it and four transitive packages by integrity hash. |
| Dialect | JSON Schema draft 2020-12 via `ajv/dist/2020.js` | The package default is draft-07, under which `$defs` and `unevaluatedProperties` behave differently. |
| Generator options | `{strict: true, allErrors: true, code: {source: true, esm: true, optimize: 1, lines: true}}` | Recorded in the pin; any change alters the generated bytes. |

Build: `node plugins/ae/tests/foundation/build/build-validators.mjs`. Check:
same command with `--check`, which regenerates into memory and diffs.

**Standalone means standalone.** Ajv's generated code emits
`require("ajv/dist/runtime/<helper>")` for some keywords — `minLength`/`maxLength`
pull in `ucs2length`. An installed release resolves no packages at runtime, so
`build/vendor-runtime.mjs` lifts the helper source into the generated module.
Vendoring is allowed only for **leaf** helpers: `equal.js` reaches
`fast-deep-equal`, and the build fails rather than reintroducing a runtime
dependency. Adding a keyword that pulls in a new helper is therefore a deliberate
re-freeze, not a silent regression. The generated module contains zero `require(`
and zero bare imports; this is asserted, not assumed.

**The responsibility split.** Strict lexical parsing and schema validation have
non-overlapping jobs:

- `lib/canonical-json.mjs` decides which **bytes** may become a value: encoding,
  duplicate keys, the number domain.
- the Ajv standalone build decides which **shape** a value may have: which fields
  exist, their types, closedness.

Neither can cover for the other, and the corpus proves it in both directions. A
duplicate-key manifest is *accepted* by Ajv, because `JSON.parse` collapsed the
duplicate before Ajv ever saw it — only the lexical layer refuses it. Conversely
the lexical layer happily admits a structurally invalid manifest, because shape is
not its concern. There is no handwritten approximate JSON-Schema validator
anywhere beside Ajv; `bin/verify-validator.mjs` scans the mechanism modules for
schema keywords to keep it that way.

Path safety is deliberately **not** in either layer. The schema's `plugin_ref`
pattern happens to refuse absolute refs, but `..` and symlink traversal are
semantic questions answered by the launcher with their own typed codes, and both
layers are asserted separately.

## 3. Tree snapshots

Implements `design.md` §6.0 (`ae.tree-snapshot.v1`) and G0.20.

Entries are `{path, type, mode}` for directories and
`{path, type, mode, length, digest}` for files, sorted by **raw UTF-8 path bytes**
(not UTF-16 code units — paths are byte strings on the wire). `mode` is the
four-digit octal of the low 12 permission bits.

`algorithm.build_digest` is the canonical digest of the algorithm *contract*
object — the include/exclude sets, entry field lists, sort rule and rejection
list — not of the source file. A comment edit must not invalidate every stored
snapshot; a change to the include set must.

### Profiles

`origin_complete` and `rollout_inventory` cover every descendant with zero
exclusions. `feature_evidence` is closed and caller-supplied globs do not exist:

| Included | Form |
|---|---|
| `authority`, `contract`, `runs` | prefix roots |
| `ledger/events.ndjson`, `ledger/head.json` | exact files |
| `origin-marker.json` | exact file |

Two reading rules that `contract/**` alone does not settle, **frozen here**:

- a prefix root is itself an entry (the `contract` directory's own mode is
  evidence);
- the parent of an exact included file is not an entry — `ledger/events.ndjson`
  is covered, the `ledger` directory is not.

`origin-marker.json` at the feature root is a **frozen implementation choice**.
`design.md` names a "feature-internal origin marker" and lists it separately from
`contract/**` and `authority/**`, which implies a path outside both, but does not
give one.

Excluded and asserted as such: `index.md`, `plan.md`, `ledger/telemetry.ndjson`,
`state/status.json`. A temp/quarantine/unknown file *inside* an included root is
not skipped — it enters the snapshot and moves the digest, which is the intended
alarm.

On the reference corpus the complete profiles yield 24 entries and
`feature_evidence` yields 18.

### Move projection

`projection_kind=expected_after_move` is derivable from exactly three inputs: an
observed source snapshot, a qualified same-filesystem move plan/result, and the
intended target identity. Entries are carried over verbatim; the subject becomes
the target. Consequently the entry projection digests are equal and the snapshot
digests differ — both asserted. Rejections: `move_projection_requires_observed_source`,
`move_projection_source_mismatch`, `move_projection_same_identity`,
`move_projection_cross_device`.

### Mutation corpus

16 mutations across the three profiles: file bytes, file mode, directory mode,
path rename, missing descendant, unexpected file in an included root, file→directory
type change, five exclusion-boundary cases, symlink inside and outside the include
set, hardlink, and a FIFO. Rejections are typed and deterministic.

**Two cases are synthetic, and are marked as such.** APFS refuses to create a
filename that is not well-formed UTF-8, so `invalid_utf8_path` is exercised against
the path-decoding guard directly; `path_collision` likewise, since a real
filesystem walk cannot produce two identical logical paths. Whether any supported
filesystem can produce either on disk is a P0.7/P0.8 host-matrix question. **No
crash durability or filesystem qualification is claimed from any of this.**

## 4. Acyclic installed-release bootstrap

Implements `design.md` §policy/release boundary and G0.21/G0.22.

```text
core + standalone validator + active-release bridge + schemas + policy members
  -> closed release manifest with raw member digests and no self_digest
  -> SHA-256(JCS(complete manifest object)) held externally
  -> minimal launcher with the expected manifest digest and bootstrap validator embedded
```

The launcher is built last and is **not a member**, so no step depends on a digest
that does not exist yet. It *embeds* rather than imports its canonical-JSON parser
and its bootstrap validator: importing a member to check the members is the cycle
the DAG exists to break. It resolves its own plugin root from its own location —
a caller does not get to say which release is running.

Frozen order, asserted by an observable trace rather than by exit status alone:

1. read the installed manifest bytes;
2. strict lexical parse;
3. refuse `self_digest`;
4. recompute `SHA-256(JCS(manifest))`, compare to the embedded constant;
5. closed schema validation;
6. resolve every member ref — plugin-relative, no `..`, no symlink component, unique;
7. recompute every installed member's raw digest;
8. import the verified validator, then the verified bridge;
9. obtain host active-root attestation, require it to equal our own verified digest;
10. mint the operation capability, bound to the bootstrap result that already exists;
11. only now import and call the core.

Every rejection case asserts the typed code **and an empty import trace**. Exit
status alone would not distinguish "refused before importing anything" from
"imported the core, then noticed", and the second is the failure that matters.

Corpus: valid build; byte-identical rebuild; six required members each tampered
(twice — appended and length-preserving) and each removed; manifest tamper;
`self_digest`; unknown field; duplicate keys; absolute / `..` / symlink /
duplicate refs; launcher listed as a member; direct core CLI invocation; direct
core import with no capability; and a two-root A/B fixture where the host reports
B active — A's launcher verifies its own members, asks the host, and stops at
`release_not_active` without importing the core.

**Nothing here mints a real active-release capability.** The bridge and core are
fixture-scoped templates that read a fixture host record and mark every
attestation and capability `fixture_only: true`. A real active-release provider is
P0.7/P0.8 work; the P0.G-lite spike established only that the host emits a
session-correlated plugin record on one arm. Releases are built into temporary
directories; no release manifest or runtime launcher is installed into
`plugins/ae/`.

## 5. Policy bundle and the activation/replay split

Implements `design.md` §policy layers and G1.17.

Two decisions that look like one:

**Materialization.** Plugin policy sources are verified against `bundle-v1.json`
and copied byte-for-byte into the project's `.ae/policies/**`, with `fsync` on both
the file and its parent directory. Same path with the same bytes is idempotent;
same path with different bytes is `integrity_error` and never a silent upgrade. An
upgrade ships new content at a new versioned path — `release-b` in the corpus does
exactly that (`runner-v2.json` alongside an untouched `runner-v1.json`), and
`release-c-bad` publishes v2 content over the v1 path and is refused.

The bundle manifest itself materializes to a **content-addressed** path,
`.ae/policies/bundles/<digest>.json`. This is a **frozen implementation choice**: a
fixed path would make every legitimate bundle upgrade collide with the previous
bundle, and the old bundle has to remain readable for replay.

**Selection.** A new candidate may bind exactly the singleton
`activation_base_bundle_digest` of the currently active verified release. An older
bundle the project still holds is retained to replay history, not to be selected —
requesting it is `base_bundle_not_current`, with `retained_for_replay_only` in the
diagnostic. Only a verified, host-attested active release names the current epoch:
a rollout lock, a caller claim, a self-declaration, or a plugin-root environment
string all get `current_release_not_selectable_by_declaration`.

**Epoch.** A current-release change makes an *unactivated* candidate
`policy_epoch_stale`. It does not reach back into an existing activation: an
activated candidate keeps its own epoch and `rewritten` is false.

**Replay.** `replayFromLocalSnapshots` reads no plugin path at all. The corpus
deletes every installed plugin tree and replays again, requiring an identical
effective digest. A missing local snapshot is `snapshot_missing` and a tampered one
is `snapshot_tampered` — the current plugin's bytes never stand in for history.

`fsync` is called on the write path. **Crash and power-loss durability is not
claimed** and remains P0.7/P0.8.

## 6. Semantic blindness

Implements D18 and G0.13.

Case B is not authored separately: it is generated by applying the declared rename
mapping to every path and every byte of case A. That construction makes "these two
differ only in feature ID and business path/name" true by definition rather than a
property a hand-written second fixture might quietly violate. The mapping is
`F-100→F-742`, `billing-export→checkout-ledger`, `src/billing→lib/checkout`,
`Billing Export→Checkout Ledger`, `billing→checkout`.

The engine's full decision set — all three snapshot profiles' entries, types,
modes, lengths and digests; entry ordering; canonical digests of every JSON
document; NDJSON record counts; and typed rejection codes for a five-case
malformed-input battery — is projected from case A into case B's namespace using
only the declared mapping, and must match. Digests are recomputed from the
**renamed bytes**: a digest is not a renameable string, and pretending otherwise
would hide exactly the bug being looked for. Two guards keep the check honest: the
two runs are asserted to produce different projection digests (so the isomorphism
is not a tree compared with itself), and every battery entry is asserted to be a
rejection rather than `accepted`.

**The structural half is not a grep.** `bin/verify-semantic-blind.mjs` resolves the
mechanism modules' actual relative-import graph from four entry points, asserts the
closed set stays inside `lib/` and never reaches the fixture release builder, and
only then scans exactly those resolved files for business vocabulary and feature-ID
patterns. Resolving the graph first is what establishes which files are production
code instead of assuming it. Protocol constants (`.ae/policies`, `contract/`,
`ledger/events.ndjson`) are legitimately present — they are injected by the
versioned protocol. The forbidden-token list is itself asserted non-vacuous against
the corpus vocabulary.

## Error taxonomy

`lib/errors.mjs` groups 45 codes by the mechanism that raises them; a code appears
in exactly one group, and overlap between the lexical and schema groups is the
defect the split exists to prevent. Callers branch on `code`, never on `message`:
messages are diagnostics and may gain detail without a version bump, codes may not.

## What this package does not establish

Deliberately out of scope, and not claimed anywhere in the corpus:

- **P0.2** owns the full authoritative schema set. Exactly one schema is frozen
  here (`ae.release-manifest.v1`), as the representative closed schema for the
  toolchain and the bootstrap validator.
- **P0.7/P0.8** own live host matrices and formal provider/helper qualification:
  the real active-release provider, child isolation, filesystem helper
  qualification, minimum-platform support, crash/power-loss durability, and
  whether any supported filesystem can produce an invalid-UTF-8 path or a path
  collision on disk. The bridge and core in `release-template/` are fixture-scoped
  and mint nothing real.
- **P0.9** owns F-082 disposition. Untouched.
- **P1** owns the first production Gate vertical slice: Gate completion truth,
  Ledger/reducer/finalizer, Contracts, proof adjudication, lifecycle mutations and
  rollout. None of it exists here, and promoting `lib/` into `plugins/ae/runtime/`
  is P1's decision.

## Keeping the corpus honest

The suite is mutation-tested. Thirteen deliberate defects — unsorted canonical
keys, admitted duplicate keys, admitted floats, a widened `feature_evidence`
include set, admitted symlinks, a move projection that keeps the source subject,
skipped member-digest recomputation, a core imported before verification, a
tolerated `self_digest`, removed no-clobber, a selectable old bundle, tolerated
snapshot tampering, and a feature ID leaked into a mechanism module — each turn the
suite red. The length-preserving member tamper in §4 exists because the first
mutation run showed the append-only tamper was satisfied by the declared-length
check alone, leaving digest recomputation unexercised.
