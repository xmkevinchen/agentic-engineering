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
├── skills/             # Slash commands (/ae:plan, /ae:work, etc.)
│   ├── plan/SKILL.md
│   ├── work/SKILL.md
│   └── ...
├── agents/             # Subagents (ae:workflow:architect, etc.)
│   ├── review/
│   ├── research/
│   └── workflow/
├── mcp-servers/        # Bundled MCP servers (Gemini)
└── templates/          # pipeline.yml template for /ae:setup
```

## Naming Convention

- SKILL.md `name` field MUST include `ae:` prefix (e.g. `name: ae:plan`)
- This ensures `/ae:plan` shows in autocomplete, not just `/plan (ae)`
- Agent names are auto-prefixed by plugin system

## Git

- **Feature branch** — all work on feature branches, PR to main. Branch naming: `feature/<slug>` or `fix/<slug>`
- Never push to remote unless explicitly approved by the user

## Design Principles

- **Self-bootstrapping** — AE develops AE. All changes to this plugin go through the AE pipeline (discuss→plan→work→review). This is the default working mode, not a special case.
- **Project-agnostic** — skills and agents read project context from CLAUDE.md and pipeline.yml
- **Extensible** — projects define their own agents (developers, code reviewers) in pipeline.yml
- **Cross-family by default** — Codex is mandatory baseline, Gemini is optional add-on
- **Agent Teams** — parallel multi-agent workflows with structured communication protocols
- **Run before deciding** — new skills or significant skill changes must be followed by at least one real execution before the next discussion or plan cycle

## Agent Definition Principles

- **No duplication** — if a concept is already in the agent definition, don't add it again with different wording
- **One-line rules** — prefer `- Rule summary` over multi-paragraph explanation
- **Test after changes** — any agent definition modification must be followed by running a real task to verify no regression
- **No self-check steps** — don't add "verify your output" instructions; they add hesitation without enforcement
- **Size awareness** — if an agent definition exceeds ~100 lines, review for bloat

## Further reading

- [docs/quickstart.md](docs/quickstart.md) — getting started
- [docs/agent-authoring.md](docs/agent-authoring.md) — authoring custom agents
- [docs/references/](docs/references/) — design rationale, plugin API, prompt patterns, AE↔CC contract surface

Contributors actively running the AE-on-AE workflow can additionally maintain a local-only `CLAUDE.local.md` for AE-internal process detail (project-management model, feature directory layout, frontmatter schemas, autonomy boundary). That file is gitignored and never ships.
