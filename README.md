# Agentic Engineering (ae)

A Claude Code plugin for multi-agent, cross-family software engineering workflows.

## What It Does

**ae** brings structured engineering discipline to AI-assisted development:

- **Multi-agent teams** — specialized agents (architect, security reviewer, challenger, etc.) collaborate via Agent Teams with structured communication protocols
- **Cross-family review** — every review includes Claude + Codex (OpenAI) + Gemini (Google) perspectives to eliminate single-family blind spots
- **TDD-first workflow** — write test → red → implement → green → review → commit
- **Structured planning** — plans with acceptance criteria, reviewed by agent teams before execution
- **Decision persistence** — all design decisions persisted to docs, surviving context window compaction

## Workflow

```
/ae:analyze (optional) → /ae:discuss (optional) → /ae:plan → /ae:work (step by step) → /ae:review
```

| Command | Purpose |
|---------|---------|
| `/ae:setup` | Initialize project pipeline config |
| `/ae:analyze` | Research codebase topic with agent teams |
| `/ae:discuss` | Structured design discussion, decisions persisted |
| `/ae:plan` | Generate plan with ACs + agent team plan review |
| `/ae:work` | Execute plan (TDD + commit + review loop) |
| `/ae:code-review` | Quick pre-commit review (Claude + Codex + Gemini) |
| `/ae:review` | Deep multi-agent review + fixup (feature gate) |

## Agents (11)

### Review
| Agent | Role |
|-------|------|
| `architecture-reviewer` | Module boundaries, dependency direction, consistency |
| `code-reviewer` | General code quality, SOLID, security, testability |
| `performance-reviewer` | Algorithms, DB queries, memory, I/O hot paths |
| `security-reviewer` | Auth, injection, data protection, secrets |
| `simplicity-reviewer` | Over-engineering, YAGNI, unnecessary abstraction |

### Research
| Agent | Role |
|-------|------|
| `archaeologist` | Deep-dive existing code, trace dependencies |
| `dependency-analyst` | Validate parallel feasibility, find hidden coupling |
| `standards-expert` | Industry best practices comparison |

### Workflow
| Agent | Role |
|-------|------|
| `architect` | Step decomposition, parallel strategy |
| `challenger` | Devil's advocate, cross-family ambassador |
| `qa` | Code review + cross-family after each step |

## Installation

### Local (recommended for now)

Clone this repo and install as a local plugin:

```bash
git clone <repo-url> ~/path/to/agentic-engineering
cd ~/path/to/agentic-engineering
claude plugin install --local .
```

### Project Setup

After installing the plugin, in your project:

```
/ae:setup
```

This creates `.claude/pipeline.yml` with auto-detected test/lint commands.

## Project-Specific Agents

The plugin provides generic agents. Your project can define domain-specific agents in `.claude/agents/` and reference them in `.claude/pipeline.yml`:

```yaml
agents:
  developers: [backend-dev, ios-dev]      # for /ae:work parallel execution
  code_reviewers: [python-reviewer, swift-reviewer]  # for /ae:code-review
```

## Cross-Family Requirements

The workflow uses three model families:

| Family | Required | How |
|--------|----------|-----|
| Claude | Yes | Claude Code (you're already here) |
| Codex | Recommended | [Codex CLI](https://github.com/openai/codex) installed locally |
| Gemini | Optional | [Gemini CLI](https://github.com/google-gemini/gemini-cli) or PAL MCP |

Without Codex/Gemini, the workflow still functions but loses cross-family blind spot coverage.

## License

MIT
