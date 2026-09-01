# `plugins/ae/tests/scripts/` — the deterministic suite

Every `test-*.sh` here is run by `plugins/ae/scripts/ae-run-tests.sh`, which is the
project's `test.command`. Each script exits 0 on all-pass, non-zero on any failure, and
documents its own scope in its header. Run one directly while working on it:

```sh
sh plugins/ae/tests/scripts/<name>.sh
```

**What belongs here: a script that runs a program and checks what it returns.** Nothing
else. A check that reads a `SKILL.md` and asserts a sentence is present proves the words
are on disk, which is not the same as anything obeying them — and it has to be edited
every time the prose is reworded, so it converts a rule into maintenance. Most of what
used to live here was that. The way this plugin is actually evaluated is by **running it
closed-book: a fresh session, given only the skill file, driven by a controller session
that watches what it does.** That is what finds real defects; six such runs of the discuss
stage produced five, plus two rule ambiguities.

What the suite covers:

| Area | Scripts |
|---|---|
| Skill surface | `test-check-skill-frontmatter.sh` — the structural frontmatter check itself behaves, rather than merely being present |
| Repo text discipline | `test-jargon-tripwire.sh` — no review bookkeeping in shipped text. An absence check, which is the one thing a scan over prose can actually establish |
| Discuss composite | `test-composite-contract.sh` — drives `scripts/check-composite.py` over the fixtures under `../fixtures/composite/`, one directory per way a round can be malformed, and requires it to refuse each |
| Cross-family | `test-cross-family-probe-parsing.sh` — the session-start probe reads the family table correctly |
| MCP servers | `test-f080-bundle-contract.sh` (the committed bundle starts with no `node_modules`), `test-openai-compat-per-endpoint-key.sh` (the bridge sends the credential the caller named and no other), `test-findings-format-compliance.sh`, `test-manifest-single-source.sh` |
| Archived Kernel | `test-v1-kernel.sh` — runs `plugins/ae/v1/`'s own suite. The Kernel is archived and on no workflow path; this is the only thing that executes it |

The `.mjs` files are helpers invoked by the scripts beside them, not standalone tests.
