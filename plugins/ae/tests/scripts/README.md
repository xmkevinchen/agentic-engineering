# `plugins/ae/tests/scripts/` — the deterministic suite

Every `test-*.sh` here is run by `plugins/ae/scripts/ae-run-tests.sh`, which is the
project's `test.command`. Each script exits 0 on all-pass, non-zero on any failure, and
documents its own scope in its header. Run one directly while working on it:

```sh
sh plugins/ae/tests/scripts/<name>.sh
```

What the suite currently covers:

| Area | Scripts |
|---|---|
| Skill surface | `test-check-skill-frontmatter.sh` (the structural frontmatter check behaves), `test-skill-name-convention.sh` (an agent's `skills:` value is qualified and resolves) |
| Repo text discipline | `test-jargon-tripwire.sh` (no review bookkeeping in shipped text), `test-mengdie-zero-residue.sh` (a retired name stays out) |
| Discuss loop | `test-discuss-loop-contract.sh` — the legs of the discuss stage's control flow: a seat that is told to write a file can write one, and every rule that spans a writer, a reader and a discharger keeps all of them; and the close-out sort asks one question and leaves no finding without a destination |
| Cross-family | `test-cross-family-probe-parsing.sh` (the session-start probe reads the family table correctly) |
| MCP servers | `test-f080-bundle-contract.sh` (the committed bundle needs no `node_modules`), `test-openai-compat-per-endpoint-key.sh`, `test-findings-format-compliance.sh`, `test-manifest-single-source.sh` |
| Host contract | `test-effective-metadata-contract.sh`, `test-e3-preregistration.sh`, `test-e3-execution.sh` — the F-083 experiment protocol: a design was a commitment, and a result cannot claim more than its attestation carries |
| V1 Kernel | `test-v1-kernel.sh`, `test-v1-foundation-freeze.sh` — canonical bytes, pinned validator toolchain, `ae.tree-snapshot.v1`, the acyclic installed-release bootstrap, the policy materialization/replay split, and the semantic-blindness pair. Implementation record: [`docs/references/v1-foundation-freeze.md`](../../docs/references/v1-foundation-freeze.md) |

The `.mjs` files are helpers invoked by the scripts beside them, not standalone tests.
