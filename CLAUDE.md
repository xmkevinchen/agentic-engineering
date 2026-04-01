# Agentic Engineering Plugin Development

## Versioning

Every change MUST update:

1. `plugins/ae/.claude-plugin/plugin.json` — bump version (semver)
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

- Never push to remote unless explicitly approved by the user

## Design Principles

- **Project-agnostic** — skills and agents read project context from CLAUDE.md and pipeline.yml
- **Extensible** — projects define their own agents (developers, code reviewers) in pipeline.yml
- **Cross-family by default** — Codex is mandatory baseline, Gemini is optional add-on
- **Agent Teams** — parallel multi-agent workflows with structured communication protocols
- **先运行后决策** — new skills or significant skill changes must be followed by at least one real execution before the next discussion/plan cycle

## Agent Definition Principles

- **No duplication** — if a concept is already in the agent definition, don't add it again with different wording
- **One-line rules** — prefer `- Rule summary` over multi-paragraph explanation
- **Test after changes** — any agent definition modification must be followed by running a real task to verify no regression
- **No self-check steps** — don't add "verify your output" instructions; they add hesitation without enforcement
- **Size awareness** — if an agent definition exceeds ~100 lines, review for bloat

## TL Autonomy Boundary

TL (Team Lead / Claude) decides autonomously by default:
- Topic convergence, agent selection, round management, Doodlestein execution
- Resolving deferred items in Sweep
- Choosing between options when evidence clearly supports one

TL escalates to user only when:
- Low-reversibility decision with genuine ambiguity
- Domain context only user has
- Topic directly affects user's workflow or preferences
