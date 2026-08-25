# AE 1.0 foundation freeze — implementation record

> F-083 / WP-P0.1. Records the concrete implementation choices behind the five
> foundational mechanisms and points at the executable corpus that holds them.

This document is **not** a second authority. `docs/ae-v1-design-history/finalized/`
is the archived v1 specification; every section below cites the clause it
implements and records only what the specification leaves to the implementer:
exact versions, file formats, build order, error codes, and ownership. Where a
reading was genuinely underdetermined, the section says so and names the choice
made.

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
│   ├── active-release.mjs    the sealed verified-active-release value
│   ├── active-release-provider.mjs  fixture producer: derives, never accepts
│   ├── freeze.mjs            deep freeze for producer-made values
│   ├── fs-noreplace.mjs      the no-replace write boundary
│   ├── fs-move-provider.mjs  fixture producer: plans and performs directory moves
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

## Provenance is not field agreement

The rule this package enforces everywhere, and the one that took two review
rounds to get right:

> A value is `observed`, `qualified`, or `verified` because a producer made it by
> doing the work — never because its own fields say so.

`projection_kind: "observed"`, `qualified: true`, and a `provider_id` of the
caller's choosing are all things a caller writes, and a caller can always make
them agree with each other. Internal consistency is not evidence. So each producer
brands what it makes, and each consumer asks the producer, not the value:

| Value | Producer | Consumer check |
|---|---|---|
| observed tree snapshot | `observeTree` (enumerates a real tree) | `isObservedSnapshot` |
| move plan / result | `fs-move-provider` (probes the filesystem, performs the rename) | `isQualifiedMovePlan` / `isProviderMoveResult` |
| active-release attestation | `active-release-provider` (reads the root, derives the digest) | `isObservedAttestation` |
| bootstrap result | `active-release-provider` / the bridge (rehashes every member) | `isVerifiedBootstrapResult` / `isDerivedBootstrapResult` |
| verified active release | `sealVerifiedActiveRelease` (cross-checks two independent derivations) | `isVerifiedActiveRelease` |
| operation capability | the bridge (mints against a derived bootstrap result) | membership in the bridge's mint set |

A shallow copy of a genuine value is not the value, and every table row has that
as an executable negative.

**A brand certifies identity, not content.** A WeakSet keys on the reference, so a
branded object that stays mutable certifies nothing: instead of authoring a fake
value, a caller takes a real one and edits it afterwards, and the brand survives
because the reference never changed. `Object.freeze` is not enough either — it is
shallow, and a frozen snapshot with a mutable `subject` and `entries` can be made
to claim it enumerated a directory it never read. Every producer therefore hands
out deeply frozen values (`lib/freeze.mjs`; the bridge carries its own copy, since
a manifest member cannot import `lib/`), and the corpus asserts deep freezing
directly as well as attempting in-place mutation of each field that matters.

### Two things this does *not* establish

Stated here because the tempting version of each claim is false.

**Input anchoring.** A brand records that a value passed through a producer. It
records nothing about whether the producer's *own inputs* pointed at something
trustworthy. `lib/active-release-provider.mjs` takes `releaseRoot` and
`hostRecordPath` as parameters, so a caller who builds a complete, self-consistent
release in a directory they control gets a genuinely branded attestation and
bootstrap result for it — the producer really did do the work, against data the
caller chose. The launcher does not have this weakness: `RELEASE_ROOT` comes from
`dirname(dirname(fileURLToPath(import.meta.url)))` and is checked against a
digest embedded at build time, which is what earns "a caller does not get to say
which release is running". An in-process helper cannot reproduce that anchor, so
the two are **different trust classes** and the table above should be read that
way. What the lib provider does now enforce is that a directory is not a release
unless its own launcher was built against that exact manifest
(`release_launcher_not_bound`) — which closes "a bag of files counts as a release"
without pretending to close "the caller built the release". Anchoring the policy
path to a self-located root is P1's job when it wires a real consumer.

**Activation.** `candidateEpochStatus` reads `activated` and `policy_epoch`
straight off a caller-supplied object with no provenance check — everywhere else
in this package that is the banned pattern. It is admissible only because
activation is established by the Ledger from a hash-chained `contract_activated`
event, and the Ledger is P1. The function classifies an epoch given an activation
state someone else established; it does not decide activation. The parameter is
named `declaredCandidateState` for that reason and the corpus asserts the
limitation, so it cannot be mistaken for a guarantee. Wiring it to a real consumer
without the upstream Ledger check would be the defect.

**This is separate from qualification, and stays separate.** Whether a real host
provider or a real filesystem helper deserves to be believed is P0.7/P0.8. Every
fixture producer here declares `qualified: false` and `fixture_only: true`. What
P0.1 owes — and now delivers — is a consumer that cannot be talked into treating
plain caller data as proof, whoever the eventual producer turns out to be.

## Ownership

`lib/` holds the mechanism implementations that P1 is expected to promote into
`plugins/ae/runtime/`. They live under `tests/` today because **this package
freezes mechanisms, it does not ship a release**: creating
`plugins/ae/release-manifest-v1.json` or `plugins/ae/runtime/ae-gate.mjs` would
assert an installed release exists, which is exactly what the scope boundary
forbids. `release-build.mjs`, `release-template/`, and everything under `corpus/`
and `bin/` are fixture machinery and are not candidates for promotion.

Two modules look like duplicates and are not.
`lib/active-release-provider.mjs` and `release-template/active-release-bridge.mjs`
both observe a root and derive a bootstrap result, because they are exercised
through different surfaces: the lib module lets the policy corpus seal a verified
active release in-process, while the bridge is a manifest member that must be
imported through the real launcher boundary in a subprocess. The bridge and the
launcher cross-check each other's derivation at run time by design; a test asserts
the lib module agrees with that pair, so the third copy cannot drift.

The semantic-blindness scan enumerates `lib/` from disk rather than from a
hand-maintained root list, so a new mechanism module is scanned whether or not
anything imports it yet. `release-build.mjs` is the one named exclusion.

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
canonicalizations, 24 rejections, 3 NDJSON acceptances, 7 NDJSON rejections. The
`.bin` fixtures are marked binary in `.gitattributes`: several deliberately encode
CRLF terminators, trailing whitespace, blank lines at EOF, invalid UTF-8 and a BOM,
which a text filter would "fix" and `git diff --check` would otherwise report. Four
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
(not UTF-16 code units — paths are byte strings on the wire). `mode` is the low 12
mode bits as exactly four octal digits, zero-padded — setuid, setgid and sticky
included, and asserted for each so the field cannot widen to five characters.

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
digests differ — both asserted.

"Observed" and "qualified" are both provenance, not fields. The source must be a
snapshot `observeTree` produced; the plan and result must come from
`fs-move-provider`, which probes the filesystem and then performs the rename. On
top of that the plan must name the exact operation `atomic_directory_noreplace`,
carry a complete qualification binding (`provider_id`, `build_digest`,
`selector_digest`, `result_ref`, `result_digest`), and be accompanied by the
successful result *of that plan* — same operation, same qualification identity,
same endpoints. An ordinary overwriting rename can destroy an existing target and
can never stand in for it.

Three negatives make that concrete, and none of them is a malformed value: a
caller-authored snapshot that claims `projection_kind: "observed"` over paths that
do not exist; a genuine provider plan for the *file* capability, refused because
this projection is defined for directory moves; and a genuine provider result
whose `outcome` is `failed`, refused on the outcome rather than on provenance.
The provider also refuses to plan at all when the source is missing or the target
already exists.

Rejections: `move_projection_requires_observed_source`,
`move_projection_plan_not_qualified`, `move_projection_unqualified_helper`,
`move_projection_source_mismatch`, `move_projection_same_identity`,
`move_projection_cross_device`, `move_projection_unsupported_operation`,
`move_projection_qualification_incomplete`, `move_projection_qualification_mismatch`,
`move_projection_failed_operation`, `move_projection_result_mismatch`. Whether a
real helper earns qualification is P0.8; that the consumer refuses a self-declared
one is settled here.

### Mutation corpus

16 mutations across the three profiles, plus five mode-encoding vectors: file
bytes, file mode, directory mode,
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
6. resolve every member ref — plugin-relative, canonical (no `..`, no `.`, no
   empty component), no symlink component, and unique by **device+inode** rather
   than by ref string;
7. recompute every installed member's raw digest;
8. require the singleton `activation_base_bundle_ref`/`digest` to name exactly one
   verified policy member and match its raw digest;
9. import the verified validator, then the verified bridge;
10. obtain host active-root attestation; require **both** the manifest digest and
    the resolved root identity to equal our own;
11. mint the operation capability, bound to the bootstrap result that already
    exists and to the exact scope it may be used for;
12. only now import and call the core.

Every rejection case asserts the typed code **and an empty import trace**. Exit
status alone would not distinguish "refused before importing anything" from
"imported the core, then noticed", and the second is the failure that matters.

Two identity rules deserve their own note, because the obvious version of each is
wrong:

- **Member uniqueness is by inode, not by path string.** `policies/./runner-v1.json`
  and `policies/runner-v1.json` are two ref strings for one file, and on a
  case-insensitive volume so are `runner-v1.json` and `RUNNER-V1.json`. `realpath`
  does not fold case, so it cannot settle the second; `st_dev`+`st_ino` settles
  both, and catches hardlinked members as well. Non-canonical components are
  refused outright on top of that.
- **Active release is manifest digest AND root identity.** Two byte-identical
  installations have the same manifest digest by construction. Comparing only the
  digest makes them indistinguishable, so an inactive root would run whenever its
  twin was the active one.

Corpus: valid build; byte-identical rebuild; six required members each tampered
(twice — appended and length-preserving) and each removed; manifest tamper;
`self_digest`; unknown field; duplicate keys; absolute / `..` / `.` / empty-component
/ symlink / string-duplicate / inode-duplicate refs; activation base digest not
matching its member, naming no member, and naming a non-policy member; launcher
listed as a member; direct core CLI invocation; a two-root A/B fixture with
distinct digests; and a **byte-identical twin** fixture where only the root
identity separates them.

**Capabilities cannot be built from public data.** Everything a forger knows — both
digests, the scope, the schema version — is public, so a capability is accepted
only if this bridge instance minted it, tracked by a module-private brand. Minting
requires an attestation the bridge itself produced and a bootstrap result whose
manifest digest *and* root identity it re-checks against that attestation; the
bearer never leaves the bridge. A genuine capability is still inert outside the
bootstrap result, scope, and lifetime it was issued for, and the corpus exercises
forged, replayed, wrong-scope and expired cases plus a direct `import(core)`.

**Honest boundary.** This defends against a caller holding only public data. It
does not defend against code running as the same OS user that simply calls the
bridge itself — that remains inside the threat boundary `design.md` declares, and
is not papered over with a fabricated signature.

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
and copied byte-for-byte into the project's `.ae/policies/**`. Same path with the
same bytes is idempotent; same path with different bytes is `integrity_error` and
never a silent upgrade. An upgrade ships new content at a new versioned path —
`release-b` in the corpus does exactly that (`runner-v2.json` alongside an
untouched `runner-v1.json`), and `release-c-bad` publishes v2 content over the v1
path and is refused.

Two things make that claim true rather than merely stated:

- **No-clobber is one operation, not a check followed by a write.** An existence
  check and then `writeFileSync` is a TOCTOU window, and it is not what
  "no-clobber" means. `lib/fs-noreplace.mjs` performs a single
  `open(O_CREAT|O_EXCL)`: the kernel decides atomically whether this call created
  the file, and O_EXCL additionally refuses to follow a symlink at the final
  component. `writeSync` may also write fewer bytes than asked, so the write loops
  until the buffer is exhausted and fails with `short_write` if it stalls —
  otherwise a short write would fsync and report success over a truncated file.
  The write syscall is injectable so that path is exercised deterministically. The
  provider declares `qualified: false` on purpose — a real `atomic_file_noreplace`
  provider needs an immutable passed result bound to OS/filesystem/mount
  selectors, and earning that is P0.8. Nothing here may read it as qualified.
- **Every destination is unique before anything is written.** Two entries naming
  one target is a malformed bundle, not a race settled by write order, and
  uniqueness is checked on the *resolved* path so that refs differing only by case
  collide on a case-insensitive volume. Both the identical-bytes and
  different-bytes duplicates are rejected with `duplicate_project_ref`, and the
  corpus asserts zero targets were created.
- **Path safety is by component, not by string.** A `.ae/policies` symlink
  pointing outside the project passes every lexical test and still lands the bytes
  elsewhere. Both `plugin_source` and `project_ref` are refused if they are
  absolute, contain `..`, contain a `.` or empty component, escape their root, or
  traverse a symlink at *any* existing component. Every destination is validated
  before any byte is written, so a rejected bundle cannot leave a half-materialized
  policy set behind. Codes: `ref_escapes_project_root`, `ref_non_canonical`,
  `ref_symlink_component`, `plugin_source_escapes_plugin_root`.

`fsync` is called on the file and its parent directory. **Crash and power-loss
durability is not claimed** and remains P0.7/P0.8.

The bundle manifest itself materializes to a **content-addressed** path,
`.ae/policies/bundles/<digest>.json`. This is a **frozen implementation choice**: a
fixed path would make every legitimate bundle upgrade collide with the previous
bundle, and the old bundle has to remain readable for replay.

**Selection.** A new candidate may bind exactly the singleton
`activation_base_bundle_digest` of the currently active verified release. An older
bundle the project still holds is retained to replay history, not to be selected —
requesting it is `base_bundle_not_current`, with `retained_for_replay_only` in the
diagnostic.

The input naming the current release is a **sealed value**, not a string and not a
plain manifest object. A string parameter would make the authoritative branch
whatever the caller types, and with a default applied, whatever the caller omits —
so there is no default and no string.

Sealing takes no manifest, no root identity and no digest as parameters, because
every one of those would be a caller assertion. It takes two producer-made values
— an attestation from `observeActiveRoot` and a bootstrap result from
`verifyBootstrap` — and requires them to agree. Those two were derived
independently: the attestation reads which root the host considers active and then
reads *that root's* manifest to get its digest, while the bootstrap result
recomputes every member's raw digest. So a bootstrap result cannot be earned for a
tampered release, and a caller who controls the host record can choose among
installed releases but cannot describe one that is not there.

Executable negatives: a plain attestation, a plain bootstrap result, both plain
and fully self-consistent, a shallow copy of either genuine value, two genuine
values describing different releases, a tampered release, an unresolvable root,
and every impostor shape at the selection boundary itself. The honest boundary is
unchanged: this stops a caller holding only public data, not code running as the
same OS user, and the fixture provider is not a qualified host provider.

**Epoch.** A current-release change makes an *unactivated* candidate
`policy_epoch_stale`. It does not reach back into an existing activation: an
activated candidate keeps its own epoch and `rewritten` is false.

**Replay.** `replayFromLocalSnapshots` reads no plugin path at all. The corpus
deletes every installed plugin tree and replays again, requiring an identical
effective digest. A missing local snapshot is `snapshot_missing` and a tampered one
is `snapshot_tampered` — the current plugin's bytes never stand in for history.

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

`lib/errors.mjs` groups 68 codes by the mechanism that raises them; a code appears
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

The suite is mutation-tested: 67 deliberate defects, each of which must turn it
red. They cover every guard described above — canonical ordering, duplicate keys,
the number domain, the `feature_evidence` boundary, symlink rejection, move
subject/operation/outcome/qualification, member digest recomputation, import
ordering, `self_digest`, ref canonicality, inode-level duplicate detection, the
activation-base cross-binding, active-root identity, capability minting and scope,
policy symlink components, `plugin_source` validation, the no-replace boundary,
short writes, duplicate and colliding destinations, every provenance brand, the
derived-rather-than-declared active-release digest, snapshot tampering, mode
width, and business vocabulary in a mechanism module.

Two checks exist specifically because a mutation run showed they were missing:

- the **length-preserving** member tamper in §4, because the append-only tamper
  was already satisfied by the declared-length check, leaving digest
  recomputation unexercised;
- the `active-root:matched` trace event in §4, because the bridge refuses to mint
  against a mismatched root too, and that second guard masked the removal of the
  launcher's own comparison. Asserting the trace rather than only the error code
  separates them.

A third came from the same place: the "wrong move operation" guard was
unreachable while the provider had only one capability, so the provider gained a
file-move capability and the guard became a real test rather than dead code.

A fourth round of survivors was more instructive still, because none of them was a
missing guard — each was a guard *masked by a redundant second one*. The
immutability assertions ran after a projection had already deep-frozen the members
it carried over, so they would have passed even if enumeration froze nothing; the
capability's scope was frozen both inline and by the deep freeze, so removing
either left the property intact by accident; and the scope presence check was
shadowed by the value comparison. Two mechanisms for one property is not twice the
safety — it means either can be deleted with the suite still green, which is how a
regression later goes unnoticed. Each was resolved by removing the redundancy or
by asserting on a value nothing else had touched.

### The floor

A green suite says nothing about how much of it ran. Emptying the tree-snapshot
mutation table deleted 48 checks and reported `ALL PASSED` — *louder-looking* than
before, because the failures went with them. Every case table here was deletable
that way, and `manifest-case-count` only looked like protection: both of its
operands live in the same file.

`fixtures/v1-foundation/coverage-floor.json` is now a checked-in minimum for each
section's *present* check count and for each corpus's size. Skips count toward it:
a skip is not a deletion, and excluding them made skipping impossible rather than
merely visible — it turned the documented toolchain-absent skip into a hard failure
on any clone that had not run `npm ci`, which is the state the suite header
promises to support. The floor section is scored from its own observed results
rather than from the table, so the one section whose job is detecting deletion is
not the one section whose deletion is invisible, asserted by
`bin/verify-all.mjs` and by the individual verifiers. The floor counts its own
section too, so deleting it fails as well. Shrinking coverage is now a visible edit
to a fixture rather than a silent consequence of editing a test — verified by
re-running the three deletions that used to pass.

### Masked pairs, found mechanically

Reading for masked guards found three instances. Neutering **every** guard and
freeze site one at a time, then jointly deleting each cluster of survivors, found
more — and distinguishes the two cases that look identical from a green suite:
a cluster that still survives joint deletion is genuinely uncovered, while a
cluster that *fails* jointly though every member survived alone is masking.

Three of the pairs were one structural shape: **a lexical guard masked by a
resolved-path guard raising the same typed code**, because every negative fixture
violated both at once. `policies/../policies/runner-v1.json` is the case that
separates them — it is non-canonical, and it resolves perfectly well inside the
root, so containment cannot see it. Left unsplit, the lexical guard was deletable
while green, and one file became addressable under two member refs: precisely the
aliasing the inode-level duplicate detection exists to prevent, reintroduced by
spelling.

`..` is therefore now a canonicality failure (`member_ref_non_canonical` /
`ref_non_canonical`) rather than an escape, and containment keeps
`member_ref_escapes_root` / `ref_escapes_project_root` for refs that actually land
outside. Since no canonical ref can resolve outside its root, the containment
guards are unreachable end to end and are exported for direct testing, as
`resolveMemberRef` already was.

The fourth pair was the seal comparison in `lib/active-release.mjs`: its single
test used a genuinely different release, which differs in both manifest digest and
root identity, so either check alone caught it. Two fixtures now isolate one
dimension each — a twin release at another path (same digest, different root) and
a release rebuilt in place (same root, different digest).

### A frozen handle over mutable contents

The same sweep found a live defect the corpus could not see: `PROFILES` used
`Object.freeze`, so `PROFILES.feature_evidence.includes` was replaceable in place
through a value the module publishes as frozen. Redefining it turned a closed
20-entry profile into 26, and nothing in 750 checks noticed. `CODES` had the same
shape. Both are deep-frozen now, module-level constants carry immutability
assertions, and the specific mutation is an executable negative — the guidance in
`freeze.mjs` was right and simply had not been applied to its own module's
constants.

Two dead declarations were made load-bearing rather than deleted: the profiles'
`exclusions` field, which nothing read, is now asserted against the observed entry
set (and each named exclusion is asserted to exist on disk, since an exclusion
naming nothing proves nothing); and `origin_complete`/`rollout_inventory`, which
were literally the same object, are now distinct objects with identical
definitions, as the spec describes them.

### Guards that were bound to nothing

An audit of typed error codes found eight that no check could reach, so the guard
raising each could be deleted with the suite green. Two causes, both now fixed:

- **Ordering shadowed the branch.** `move_projection_cross_device` sat behind a
  `sameSubject` comparison that already includes `device_id`, so a cross-device
  plan was indistinguishable from a mismatched one and the dedicated code could
  never fire. The device comparison now precedes it.
- **Provenance shadowed the content rules.** Once plans and results must come from
  a provider, and a provider builds them correctly by construction, every interior
  content check became unreachable. `assertMoveContent` and
  `assertProjectionEndpoints` are exported and tested directly, the same way
  `resolveMemberRef` is in the launcher.

Two more shared a code with a neighbouring check, which made them unobservable:
the launcher's declared-length check reported `member_digest_mismatch` like the
digest comparison below it, and now has `member_length_mismatch` of its own — so
the append tamper and the length-preserving tamper each exercise exactly one.

### Checks that could not fail

Also from that audit, and repaired: the equivalence-group checks compared
`cases.json` against itself, so breaking `canonicalize()` outright left all 28
green — they now group by the digest the implementation computes and require that
grouping to match the declared one. The digest-form checks were one-sided;
`DIGEST_PATTERN` could be replaced with `/^/`. Path ordering is specified over raw
UTF-8 bytes, but every corpus path was ASCII, so swapping the comparator to UTF-16
changed nothing — the tree corpus now contains U+1F600 and U+FB33, whose byte order
is the reverse of their code-unit order. The surrogate bounds were tested only at
the low end of each range, so either could be shifted upward by one.

Applying that same lens deliberately then found a fifth: every rejection case in
the canonical-bytes corpus reaches the serializer through `parseStrict`, which
refuses bad numbers and lone surrogates first — so the serializer's own admission
rules were never exercised and could be deleted with all 750 checks still green.
They are not redundant, because `canonicalize()` is called on in-memory values
throughout this package (algorithm identity, policy epochs, snapshot digests), and
there the serializer is the only thing between a float and a silently wrong
digest. Seventeen direct cases now cover that path, nested inside arrays and
objects to prove the whole value is walked.

Not every guard is independently mutable, and the corpus says so rather than
padding the count: the attestation objects are flat, so shallow and deep freezing
coincide for them today. They use the deep helper anyway, so a nested field added
later is covered by construction.

All three are worth stating plainly: defense in depth makes a suite look green
when one layer is removed, and only a mutation run finds that. Each round of this
package has produced at least one such finding, which is the argument for keeping
the mutation corpus alongside the fixtures rather than treating a green suite as
the result.
