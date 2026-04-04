# Agentic Engineering

An operating system for AI agents in software engineering.

17 specialized agents. 3 model families. 2 output styles. One disciplined pipeline. Built as a [Claude Code](https://docs.anthropic.com/en/docs/claude-code) plugin.

## The Problem

AI-assisted coding is powerful but unstructured. You prompt one model, hope for the best, and move on. There's no review process, no second opinion, no persistent memory of decisions made.

**ae** treats AI agents the way an operating system treats processes — scheduling them, routing communication between them, abstracting away the differences between model families, and persisting state to disk.

| OS Concept | ae Equivalent |
|-----------|---------------|
| Process scheduler | Agent Teams — dynamic formation, parallel execution, task-based selection |
| Filesystem | Persistent artifacts — plans, analysis docs, review results, decision records |
| IPC | Structured agent protocols — handoff, challenge/response, consensus |
| Device drivers | MCP servers — Codex and Gemini abstracted behind a uniform interface |
| Shell | 17 slash commands (`/ae:plan`, `/ae:work`, `/ae:review`, `/ae:test-plugin`, ...) |

## Quick Start

```bash
# Install the plugin
/plugin marketplace add xmkevinchen/agentic-engineering
/plugin install ae@xmkevinchen-agentic-engineering

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
| `/ae:plan-review` | Re-review an existing plan with agent teams (standalone, without regenerating) |
| `/ae:work` | Execute the plan step by step: write test, red, implement, green, review, commit |
| `/ae:review` | Deep multi-agent review + automatic fixups — the feature completion gate |

### Analysis & Design

| Command | What it does |
|---------|-------------|
| `/ae:analyze` | Research a codebase topic with agent teams, output persistent analysis docs |
| `/ae:discuss` | Structured design discussion with decision persistence |
| `/ae:think` | Deep multi-step reasoning for hard architecture decisions or complex bugs |
| `/ae:consensus` | Adaptive multi-round debate (for/against/neutral) with cross-examination |

### Development Support

| Command | What it does |
|---------|-------------|
| `/ae:code-review` | Quick pre-commit review (Claude + Codex + Gemini + Doodlestein) |
| `/ae:test-plugin` | Adversarial behavioral testing — blind execution, LLM-as-judge, persistent test cases |
| `/ae:testgen` | Generate test suites with edge case coverage |
| `/ae:trace` | Trace execution flow or map dependency chains |
| `/ae:team` | Spin up an ad-hoc agent team — auto-selects agents based on your task |
| `/ae:retrospect` | Analyze pipeline execution history — trends, rework rates, actionable insights |

### Protocol Reference

| Command | What it does |
|---------|-------------|
| `/ae:agent-teams` | Unified protocol for all Agent Teams — Base layer + Debate/Investigation modes + Doodlestein |
| `/ae:agent-selection` | Agent selection reference — context-based team composition and cross-family role assignment |

## Agents

17 specialized agents, organized in four groups:

### Review Agents — the quality gate
| Agent | Focus |
|-------|-------|
| `architecture-reviewer` | Module boundaries, dependency direction, architectural consistency |
| `code-reviewer` | Code quality, SOLID principles, security, testability |
| `performance-reviewer` | Algorithms, DB queries, memory usage, I/O hot paths |
| `security-reviewer` | Auth, injection, data protection, secrets management |

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
| `challenger` | Pure adversarial opposition, blind spot detection |
| `qa` | Post-step code review + cross-family validation |
| `test-lead` | Adversarial test generation + LLM-as-judge evaluation |
| `codex-proxy` | Routes requests to Codex (OpenAI) via MCP |
| `gemini-proxy` | Routes requests to Gemini (Google) via MCP |

### Doodlestein Agents — the challenge layer
| Agent | Focus |
|-------|-------|
| `doodlestein-strategic` | "What's the smartest alternative that makes this unnecessary?" |
| `doodlestein-adversarial` | "Which part solves a problem that doesn't exist?" |
| `doodlestein-regret` | "Which decision will be reversed within 2 weeks?" |

Agent teams form dynamically. `/ae:team` picks the right combination for your task. Commands like `/ae:review` assemble a full review panel automatically. **TL (Session TL) always synthesizes** — agents research, challenge, and report; TL merges findings into final output.

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
- **Agent Teams** (experimental) — required for multi-agent workflows (10 of 13 commands). Add to `~/.claude/settings.json`:
  ```json
  {
    "experiments": {
      "CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS": true
    }
  }
  ```
  Then restart Claude Code. See [Agent Teams docs](https://code.claude.com/docs/en/agent-teams) for details.

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
  skills/                         # 17 slash commands (the shell)
  agents/                         # 17 specialized agents (the processes)
    review/                       #   4 review agents
    research/                     #   3 research agents
    workflow/                     #   7 workflow agents (incl. test-lead)
    workflow/doodlestein-*        #   3 Doodlestein challenge agents
  tests/                          # Persistent test cases (manual + generated)
  mcp-servers/gemini/             # Bundled Gemini MCP server (device driver)
  templates/pipeline.template.yml # Template for /ae:setup
```

## License

MIT
