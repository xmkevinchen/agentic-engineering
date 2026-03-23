# Agentic Engineering

An operating system for AI agents in software engineering.

13 specialized agents. 3 model families. One disciplined pipeline. Built as a [Claude Code](https://docs.anthropic.com/en/docs/claude-code) plugin.

## The Problem

AI-assisted coding is powerful but unstructured. You prompt one model, hope for the best, and move on. There's no review process, no second opinion, no persistent memory of decisions made.

**ae** treats AI agents the way an operating system treats processes — scheduling them, routing communication between them, abstracting away the differences between model families, and persisting state to disk.

| OS Concept | ae Equivalent |
|-----------|---------------|
| Process scheduler | Agent Teams — dynamic formation, parallel execution, task-based selection |
| Filesystem | Persistent artifacts — plans, analysis docs, review results, decision records |
| IPC | Structured agent protocols — handoff, challenge/response, consensus |
| Device drivers | MCP servers — Codex and Gemini abstracted behind a uniform interface |
| Shell | 12 slash commands (`/ae:plan`, `/ae:work`, `/ae:review`, ...) |

## Quick Start

```bash
# Install the plugin
claude plugin marketplace add github:xmkevinchen/agentic-engineering
claude plugin install ae

# In your project
/ae:setup          # creates .claude/pipeline.yml
/ae:plan           # generate a plan with acceptance criteria
/ae:work           # execute it (TDD + commit + review loop)
```

## The Pipeline

```
/ae:analyze  →  /ae:discuss  →  /ae:plan  →  /ae:work       →  /ae:review
 (optional)      (optional)     (required)   (step by step)    (feature gate)
```

Each stage produces artifacts that feed the next. Plans reference analysis docs. Work follows plan steps. Reviews validate against acceptance criteria. Everything persists to disk — surviving context window compaction.

## Commands

### Core Workflow

| Command | What it does |
|---------|-------------|
| `/ae:setup` | Initialize pipeline config (`.claude/pipeline.yml`) — auto-detects test/lint commands |
| `/ae:plan` | Generate an execution plan with acceptance criteria, reviewed by agent teams |
| `/ae:work` | Execute the plan step by step: write test, red, implement, green, review, commit |
| `/ae:review` | Deep multi-agent review + automatic fixups — the feature completion gate |

### Analysis & Design

| Command | What it does |
|---------|-------------|
| `/ae:analyze` | Research a codebase topic with agent teams, output persistent analysis docs |
| `/ae:discuss` | Structured design discussion with decision persistence |
| `/ae:think` | Deep multi-step reasoning for hard architecture decisions or complex bugs |
| `/ae:consensus` | Structured debate (for/against/neutral) to evaluate a proposal |

### Development Support

| Command | What it does |
|---------|-------------|
| `/ae:code-review` | Quick pre-commit review (Claude + Codex + Gemini) |
| `/ae:testgen` | Generate test suites with edge case coverage |
| `/ae:trace` | Trace execution flow or map dependency chains |
| `/ae:team` | Spin up an ad-hoc agent team — auto-selects agents based on your task |

## Agents

13 specialized agents, organized in three groups:

### Review Agents — the quality gate
| Agent | Focus |
|-------|-------|
| `architecture-reviewer` | Module boundaries, dependency direction, architectural consistency |
| `code-reviewer` | Code quality, SOLID principles, security, testability |
| `performance-reviewer` | Algorithms, DB queries, memory usage, I/O hot paths |
| `security-reviewer` | Auth, injection, data protection, secrets management |
| `simplicity-reviewer` | Over-engineering detection, YAGNI enforcement |

### Research Agents — the knowledge layer
| Agent | Focus |
|-------|-------|
| `archaeologist` | Deep-dive into existing code, trace dependencies and history |
| `dependency-analyst` | Validate parallel feasibility, find hidden coupling |
| `standards-expert` | Industry best practices and conventions comparison |

### Workflow Agents — the runtime
| Agent | Focus |
|-------|-------|
| `architect` | Step decomposition, parallel execution strategy |
| `challenger` | Devil's advocate, cross-family decision-maker |
| `qa` | Post-step code review + cross-family validation |
| `codex-proxy` | Routes requests to Codex (OpenAI) via MCP |
| `gemini-proxy` | Routes requests to Gemini (Google) via MCP |

Agent teams form dynamically. `/ae:team` picks the right combination for your task. Commands like `/ae:review` assemble a full review panel automatically.

## Cross-Family Architecture

No single model family catches everything. ae abstracts three families behind a uniform MCP interface:

| Family | Channel | Role |
|--------|---------|------|
| Claude | Built-in | Primary development and agent orchestration |
| Codex (OpenAI) | `codex` MCP server | Cross-family baseline, multi-turn via `codex-reply` |
| Gemini (Google) | Bundled MCP server | Targeted review, multi-turn via `reply` with session management |

The proxy agents (`codex-proxy`, `gemini-proxy`) act as device drivers — translating between ae's internal protocols and each family's MCP interface. Without them, the system still runs; you just lose cross-family coverage.

### Codex

Uses the Codex CLI installed on the user's machine. Model is determined by the user's Codex CLI configuration (profile, default model) — ae does not override it.

### Gemini MCP Server

Bundled in `mcp-servers/gemini/`. TypeScript, stdio transport.

- **Model auto-discovery** — `models` tool lists available models at runtime, agents pick the right one (flash for quick reviews, pro for deep analysis)
- Multi-turn conversations (`chat` + `reply` with sessionId)
- Switch models mid-conversation
- Auth via `GEMINI_API_KEY` env var
- Auto session cleanup (30 min TTL)

## Installation

### Prerequisites

- [Claude Code](https://docs.anthropic.com/en/docs/claude-code) v1.0.33+
- [Node.js](https://nodejs.org) (for Gemini MCP server)

### Cross-Family Setup (optional but recommended)

| Family | How to set up |
|--------|--------------|
| Codex (OpenAI) | `npm install -g @openai/codex` |
| Gemini (Google) | Set `GEMINI_API_KEY` env var ([get a key](https://aistudio.google.com/apikey)) |

`/ae:setup` guides you through cross-family configuration and writes status to `.claude/cross-family-status.json`.

## Project Configuration

Running `/ae:setup` creates `.claude/pipeline.yml`:

```yaml
test:
  command: "npm test"              # auto-detected
lint:
  command: "npm run lint"          # auto-detected

output:
  discussions: "docs/discussions/"
  plans: "docs/plans/"
  milestones: "docs/milestones/"
  backlog: "docs/backlog/"
  reviews: "docs/reviews/"
  analyses: "docs/analyses/"

cross_family:
  codex: true
  gemini: true
```

Agents are auto-discovered at runtime from all available sources — project agents (`.claude/agents/`), installed plugin agents, and user global agents. The plugin's built-in agents provide generic roles; your project and other plugins add domain expertise.

## Architecture

```
plugins/ae/
  .claude-plugin/plugin.json      # Plugin manifest
  skills/                         # 12 slash commands (the shell)
  agents/                         # 13 specialized agents (the processes)
    review/                       #   5 review agents
    research/                     #   3 research agents
    workflow/                     #   5 workflow agents
  mcp-servers/gemini/             # Bundled Gemini MCP server (device driver)
  templates/pipeline.template.yml # Template for /ae:setup
```

## License

MIT
