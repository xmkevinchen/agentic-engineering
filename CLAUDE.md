# Agentic Engineering Plugin Development

## Versioning

Every change MUST update:

1. `.claude-plugin/plugin.json` — bump version (semver)
2. `CHANGELOG.md` — document changes
3. `README.md` — verify component counts

## Directory Structure

```
agents/
├── review/     # Code review agents (architecture, code, performance, security, simplicity)
├── research/   # Research agents (archaeologist, dependency-analyst, standards-expert)
└── workflow/   # Workflow agents (architect, challenger, qa)

commands/ae/    # All commands use ae: prefix (/ae:plan, /ae:work, etc.)

skills/         # Passive knowledge skills

templates/      # pipeline.yml template for /ae:setup
```

## Design Principles

- **Project-agnostic** — commands and agents read project context from CLAUDE.md and pipeline.yml
- **Extensible** — projects define their own agents (developers, code reviewers) in pipeline.yml
- **Cross-family by default** — Codex is mandatory baseline, Gemini is optional add-on
- **Agent Teams** — parallel multi-agent workflows with structured communication protocols
