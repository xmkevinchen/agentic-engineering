# `plugins/ae/tests/foundation/` — AE 1.0 foundation freeze

Executable freeze of the five foundational v1 mechanisms (F-083 / WP-P0.1). The
implementation record — frozen choices, pinned versions, build order, error
taxonomy, ownership, and what is explicitly *not* claimed — is
[`docs/references/v1-foundation-freeze.md`](../../docs/references/v1-foundation-freeze.md).

## Run

```sh
sh plugins/ae/tests/scripts/test-v1-foundation-freeze.sh            # summary
sh plugins/ae/tests/scripts/test-v1-foundation-freeze.sh --verbose  # every check
```

Deterministic and offline: no network, no `npm install`, no host qualification.
One check (validator regeneration is byte-identical) needs the build toolchain and
reports `SKIP` rather than `PASS` when it is absent.

Individual sections:

```sh
node plugins/ae/tests/foundation/bin/verify-canonical-bytes.mjs
node plugins/ae/tests/foundation/bin/verify-validator.mjs
node plugins/ae/tests/foundation/bin/verify-tree-snapshot.mjs
node plugins/ae/tests/foundation/bin/verify-release-bootstrap.mjs
node plugins/ae/tests/foundation/bin/verify-policy-bundle.mjs
node plugins/ae/tests/foundation/bin/verify-semantic-blind.mjs
```

## Directories

| Path | Contents |
|---|---|
| `lib/` | The frozen mechanism implementations. Candidates for promotion to `plugins/ae/runtime/` in P1 — except `release-build.mjs`, which assembles fixture releases. |
| `oracle/` | An independent canonical-bytes serializer, written against the specification rather than against `lib/`. |
| `corpus/` | Fixture tree definitions shared by the builders and the verifiers, so both sides cannot drift apart. |
| `release-template/` | The launcher template plus the two fixture-scoped release members. These mint nothing real; a qualified active-release provider is P0.7/P0.8 work. |
| `build/` | Build-only Node toolchain (`package.json`, `package-lock.json`) and the fixture generators. Never resolved on a verification run. |
| `bin/` | The deterministic verifiers and the shared check harness. |

## Regenerating fixtures

Only needed when a frozen rule changes — which is a deliberate re-freeze, not
routine maintenance.

```sh
cd plugins/ae/tests/foundation/build
npm ci                                  # pinned Ajv, build-time only
node build-validators.mjs               # standalone validator + toolchain pin
node build-canonical-fixtures.mjs       # canonical-byte corpus
node build-policy-fixtures.mjs          # three plugin policy trees
node build-tree-fixtures.mjs            # frozen tree entry projections
```

The expected canonical bytes in `build-canonical-fixtures.mjs` are hand-authored
constants, not implementation output. Regenerating rewrites the same bytes; it does
not re-derive them from `lib/`.
