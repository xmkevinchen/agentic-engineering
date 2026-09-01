# Agentic Engineering Plugin Development

## Language Convention

All git-tracked files in this repository are written in English: `README.md`, `CHANGELOG.md`, every `SKILL.md`, agent definition files under `plugins/ae/agents/`, and everything under `docs/` (references, public-facing guides). Process artifacts under `.ae/` (gitignored — discussions, plans, reviews, analyses, milestones) may use whatever language is convenient for the working session; they never ship to the published repository. Local-only contributor notes (such as `CLAUDE.local.md` and files under `docs/decisions/`) follow the same convenience-language policy and are kept out of the repository.

## Versioning

Version bumps are for **intentional releases**, not every commit. Accumulate changes and bump once when there's a meaningful release.

When releasing:
1. `plugins/ae/.claude-plugin/plugin.json` — bump version (semver: patch for enhancements, minor for new components)
2. `CHANGELOG.md` — document changes
3. `README.md` — verify component counts

## Directory Structure

```
.claude-plugin/
└── marketplace.json    # Marketplace manifest (repo = marketplace)

plugins/ae/             # The actual plugin
├── .claude-plugin/
│   └── plugin.json     # Plugin manifest (name: "ae")
├── skills/             # The entry and the five stages
│   ├── go/SKILL.md     #   the entry: runs a work item through the stages
│   ├── analyze|discuss|plan|work|review/SKILL.md
│   └── ...
├── agents/             # Subagents (ae:workflow:architect, etc.)
│   ├── review/ research/ workflow/ engineering/
├── scripts/            # The session-start probe, its reader, the Codex seat runner, the test runner
├── mcp-servers/        # Bundled MCP servers (Gemini, OpenAI-compatible)
├── v1/                 # The Phase 1 Kernel, built against its own frozen Contract
└── templates/          # pipeline.yml template
```

## Naming Convention

- SKILL.md `name` field is the bare skill segment (e.g. `name: plan`), matching its directory
- Claude Code prepends the plugin namespace itself, so `name: plan` autocompletes as `/ae:plan`
- Agent names are auto-prefixed the same way; a `:` in either field is rejected or doubled

### Internal terminology referenced in skill/agent prose

Skill definitions and agent files occasionally cite the following internal terms. They are project artifacts, not external concepts:

- **`F-NNN`** — a *feature* identifier. Features live under `.ae/features/{active,done,abandoned}/F-NNN-<slug>/` (gitignored process artifacts). When a SKILL.md says e.g. "F-019 cast-block protocol" it is naming a specific past feature that introduced the protocol now described.
- **`BL-NNN`** — a *backlog item* identifier (idea / task / known gap). Backlog files live under `.ae/backlog/` (gitignored). When prose says "BL-076" it is citing the backlog entry that produced or motivated the surrounding behavior.
- **`Plan NNN`** — a *legacy plan number* from the pre-feature-directory era of this plugin's own self-development. Plans now live inside their feature dir; references to `Plan 0XX` in older prose mean "the historical plan record that established the behavior being described". They are archaeological references, not currently-tracked artifacts.
- **`KL #N`** — a *knowledge-ladder* finding number; cited only in `plugins/ae/skills/review/SKILL.md` as part of a synthesis-quality check the reviewer applies.

These identifiers do not need to be resolved to understand what a skill does — they are provenance hooks for contributors interested in the design history.

## Repo-entering text discipline

Everything that lands in the repository — code comments, commit messages, skill/agent prose, tests, docs — describes the WORK, never the review conversation that shaped it:

- **Code comments** state a constraint the code can't show; never where a finding came from. Review bookkeeping is noise the moment it merges.
- **Commit messages** describe what the change did and why. **The test is resolvability: every identifier, file and fact a message names must be findable by someone who has only this repository.** `.ae/` is gitignored, so a criterion id (`AC3`), a feature or backlog id (`F-099`, `BL-247`), or a path under `.ae/` resolves to nothing for that reader — state the substance instead of the pointer. Review bookkeeping fails the same test from the other side: reviewer names, finding counts, severities and iteration counts describe the conversation, not the work, and no file records them. What a message *may* name is anything the repository holds — a path, a symbol, a measured number, a behaviour a reader can go and check.
- **Skill/agent prose** may keep a terse provenance cite (`F-NNN`, `Plan NNN`, `BL-NNN` — see Internal terminology above); reviewer attribution goes.
- Nothing enforces this mechanically. It is a writing rule, checked by whoever reads the diff; functional cross-family references (proxy agents, track names, family selection) are not violations of it.

## Git

- **Feature branch** — all work on feature branches, PR to main. Branch naming: `feature/<slug>` or `fix/<slug>`
- Never push to remote unless explicitly approved by the user

## Design Principles

- **Self-bootstrapping** — AE develops AE. All changes to this plugin go through the AE pipeline (discuss→plan→work→review). This is the default working mode, not a special case.
  Bootstrapping is what makes this repository's edit loop unlike an ordinary project's: elsewhere you edit code that a test then runs, here you edit the instructions the running agent is made of. Two consequences, both silent when ignored — **within a session**, nothing reaches the agent until `/reload-plugins` (see *Run before deciding* below); **across sessions**, this repo loads the plugin from its own working tree (`.claude/settings.json`), so a new session reads the current files with no version bump, while a marketplace install anywhere else stays pinned to the version it was installed at until that version is bumped and the plugin updated.
- **Project-agnostic** — skills and agents read project context from CLAUDE.md
- **Extensible** — projects define their own roles as `.claude/agents/*.md`, which the host
  discovers; a project role is preferred over an AE one when both fit
- **Cross-family by default** — Codex is mandatory baseline, Gemini is optional add-on
- **Run before deciding** — new skills or significant skill changes must be followed by at least one real execution before the next discussion or plan cycle. That execution needs `/reload-plugins` first: skill bodies and agent definitions are read once at session start, so `Skill` returns the old text and a new agent is `not found`, with no warning either way — the call succeeds and the content looks normal. **Reload is a snapshot, not a subscription:** it loads what is on disk at that instant, so every further edit needs its own reload. Two rounds of edits, two reloads.

## Agent Definition Principles

- **No duplication** — if a concept is already in the agent definition, don't add it again with different wording
- **One-line rules** — prefer `- Rule summary` over multi-paragraph explanation
- **Test after changes** — any agent definition modification must be followed by running a real task to verify no regression
- **No self-check steps** — don't add "verify your output" instructions; they add hesitation without enforcement
- **Size awareness** — if an agent definition exceeds ~100 lines, review for bloat

## Further reading

- [docs/rebuild.md](docs/rebuild.md) — why AE was rebuilt, what the minimum is, and the roadmap
- [docs/quickstart.md](docs/quickstart.md) — getting started
- [docs/references/](docs/references/) — design rationale, plugin API, prompt patterns, AE↔CC contract surface

Contributors actively running the AE-on-AE workflow can additionally maintain a local-only `CLAUDE.local.md` for AE-internal process detail (project-management model, feature directory layout, frontmatter schemas, autonomy boundary). That file is gitignored and never ships.
