# Capability contract: stating a need without naming a mechanism

A skill sometimes benefits from something the plugin itself cannot provide — a way to run a
piece of work in its own independent session, for instance. AE's own skill prose must never name
the specific tool, product, or host API that satisfies such a need: `F-113` shipped a version
that did, was reviewed as passing, and was still rejected because it baked a Claude-Code-version-
specific detail into permanent-sounding skill text (see that feature's retrospective). This
document states the pattern that replaces doing that, once, so a future capability follows it
instead of repeating the mistake.

## The three parts

1. **A skill states a need, never a mechanism.** It names the capability and the property it
   requires — nothing about how that property gets satisfied. "This benefits from running as
   `independent-top-level-session`: a way to run this stage's work somewhere addressable, whose
   completion can be waited on, that can receive an explicit handoff" is the shape. "Use herdr"
   or "spawn a Claude Code Agent-tool call" is not — those are bindings, and they belong in the
   next part.

2. **A project's or a user's own instructions state the binding**, in ordinary prose. No schema
   is required and none is defined here — the reader is always an LLM session, which already
   reads a project's `CLAUDE.md`/`AGENTS.md` or a user's global instructions as context, so prose
   that plainly says how to satisfy a named capability on this setup is already legible without
   any parser. `instructions/herdr-coordination.md`, imported into this user's global `CLAUDE.md`,
   is the first real instance of this shape: it already reads "use the shared `herdr` skill when
   an authorized task needs an independent top-level Agent session" — naming the same property a
   capability declaration would need, written before this convention existed to name it.

3. **Absent a binding, the skill's default behavior applies, unchanged.** A capability is checked
   for; it is never a precondition. A skill that names a capability and finds no binding for it
   anywhere in context proceeds exactly as it would if the capability had never been mentioned —
   no error, no pause, no request to the human to go supply one.

## Why this is three parts and not one file format

A capability name lets a skill and a binding find each other without either one committing to
how — the name is the only thing both sides have to agree on. Requiring a structured file (a new
`.claude/` config key, a YAML table) would add a parsing step neither side needs: the skill's own
reader is the same LLM session that would read a structured file, so structure buys nothing here
that prose does not already give, and it would be one more place a future maintainer has to keep
in sync with the skills that read it. `.claude/pipeline.yml`'s `cross_family` table is structured
because its consumers are shell/Python scripts (`check-cross-family.sh`, `read-family-table.py`)
that genuinely cannot read prose — that is the case a schema earns its cost, and capability
declarations are not that case.

## Currently declared capabilities

- **`independent-top-level-session`** — used by `work/SKILL.md` and `review/SKILL.md` (`F-114`).
  A way to run a stage's work in a session distinct from the one that invoked it, addressable,
  awaitable for completion, and able to receive an explicit handoff of what it needs to act on.

A future skill declaring a new capability adds a name and a one-line description here, following
the same shape — this document is not specific to `independent-top-level-session`, which is one
worked example, not the whole of what it states.
