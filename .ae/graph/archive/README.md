# Graph archive — retired generated artifacts

Files here are NOT part of the live graph. Nothing reads them; no read path
resolves ids against them. They are kept because they are the last surviving
record of corpus that no longer exists.

## themes/ — Tier B pages for 79 features that no longer exist

`.ae/features/` was gitignored process state and was lost with the machine it
lived on (2026-08-12). The knowledge graph's node layer went with it: every
`F-NNN` node page, every edge target, the whole backlog.

These nine files are `graph-index-gen.py` Tier B output — for each of F-001
through F-079: id, title, status, and the first body paragraph of its
`index.md`. That is all that remains of those features.

They were moved out of `.ae/graph/themes/` rather than deleted, for two reasons:

1. **Archaeology.** Prose across `plugins/ae/skills/` and `plugins/ae/agents/`
   cites `F-NNN` as provenance. These files are the only way to resolve such a
   cite to a title and a one-line summary.
2. **They would have been silently orphaned.** `graph-index-gen.py` rewrites
   `index.md` unconditionally from whatever `.ae/features/` holds. The first
   run after the features root is recreated emits a zero-theme index; the theme
   files themselves survive on disk (the reap loop is guarded against
   zero-record runs) but become unreachable from Tier A. Moving them makes that
   outcome explicit instead of accidental.

Do not regenerate these. Do not add them back to `themes/`. If the feature dirs
are ever restored from a backup, delete this directory and let the generator
rebuild Tier B from the real corpus.

## What survived, and why it matters

The four `synthesis/syn-*.md` pages came through the loss intact and still
check `fresh`. They anchor into the **working tree** — code and doc lines that
are in git. The theme pages anchor into **feature frontmatter**, which was not.
Same graph, same generation date; the layer that pointed at version-controlled
sources is the layer that is still alive.
