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
