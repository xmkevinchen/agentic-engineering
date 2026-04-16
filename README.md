# Agentic Engineering

**Stop prompting one model and hoping for the best.**

ae is a [Claude Code](https://docs.anthropic.com/en/docs/claude-code) plugin that runs structured, multi-agent workflows on your codebase. It plans features with acceptance criteria, executes them step by step with TDD, reviews with cross-family agents (Claude + Codex + Gemini), and persists every decision to disk.

Think of it as a disciplined senior engineer running a small team inside your repo.

## Who is this for?

Solo developers and small teams who want:
- **Repeatable workflows** — not ad-hoc prompting, but a pipeline: analyze → discuss → plan → work → review
- **Multi-agent review** — 3 model families catch different things; one model alone misses too much
- **Persistent artifacts** — plans, decisions, and reviews survive context window compaction
- **Agent extensibility** — add your own domain-expert agents alongside the built-in ones

## When NOT to use ae

- Simple one-off tasks (just use Claude Code directly)
- Non-Claude-Code environments
- Projects where you don't want persistent artifacts on disk

## Quick Start

**Prerequisites**: [Claude Code](https://docs.anthropic.com/en/docs/claude-code) v1.0.33+ · [Node.js](https://nodejs.org) · [Agent Teams](https://code.claude.com/docs/en/agent-teams) enabled

```bash
# 1. Enable Agent Teams (required for 12 of 20 commands)
# Add to ~/.claude/settings.json:
#   { "env": { "CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS": "1" } }

# 2. Install the plugin
/plugin marketplace add xmkevinchen/agentic-engineering
/plugin install ae@xmkevinchen-agentic-engineering

# 3. In your project
/ae:setup          # creates .claude/pipeline.yml
/ae:plan           # generate a plan with acceptance criteria
/ae:work           # execute it (TDD + commit + review loop)
```

See [Quickstart Guide](docs/quickstart.md) for a full walkthrough.

## The Pipeline

```
/ae:analyze  →  /ae:discuss  →  /ae:plan  →  /ae:work       →  /ae:review
 (optional)      (optional)     (required)   (step by step)    (feature gate)
```

Each stage produces artifacts that feed the next. Plans reference analysis docs. Work follows plan steps. Reviews validate against acceptance criteria. Everything persists to disk.

## Commands

### First Run

| Command | What it does |
|---------|-------------|
| `/ae:setup` | Initialize pipeline config — auto-detects test/lint commands, discovers agents |
| `/ae:plan` | Generate an execution plan with acceptance criteria, reviewed by agent teams |
| `/ae:work` | Execute the plan: write test → red → implement → green → review → commit |
| `/ae:review` | Deep multi-agent review — the feature completion gate |

### Daily Use

| Command | What it does |
|---------|-------------|
| `/ae:dashboard` | See where your features stand — pipeline progress at a glance |
| `/ae:next` | "What should I do next?" — suggests the next pipeline step |
| `/ae:code-review` | Quick pre-commit review (Claude + Codex + Gemini + Doodlestein) |
| `/ae:team` | Spin up an ad-hoc agent team — auto-selects agents for your task |
| `/ae:testgen` | Generate test suites with edge case coverage |

### Analysis & Design

| Command | What it does |
|---------|-------------|
| `/ae:analyze` | Research a codebase topic with agent teams |
| `/ae:discuss` | Structured design discussion with decision persistence |
| `/ae:think` | Deep reasoning for hard architecture decisions or complex bugs |
| `/ae:consensus` | Multi-round debate (for/against/neutral) with cross-examination |
| `/ae:trace` | Trace execution flow or map dependency chains |
| `/ae:roadmap` | Feature clustering and roadmap analysis |

### Ops & Meta

| Command | What it does |
|---------|-------------|
| `/ae:plan-review` | Re-review an existing plan (standalone, without regenerating) |
| `/ae:test-plugin` | Adversarial behavioral testing — blind execution, LLM-as-judge |
| `/ae:retrospect` | Pipeline execution history — trends, rework rates, insights |
| `/ae:agent-teams` | Protocol reference: Agent Teams base layer + modes |
| `/ae:agent-selection` | Protocol reference: team composition and cross-family roles |

## Agents

16 specialized agents in four groups:

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

Agent teams form dynamically — `/ae:team` picks the right combination for your task. TL (Session Lead) always synthesizes: agents research, challenge, and report; TL merges findings into final output.

## Cross-Family Architecture

No single model catches everything. ae abstracts three families behind a uniform MCP interface:

| Family | Channel | Role |
|--------|---------|------|
| Claude | Built-in | Primary development and orchestration |
| Codex (OpenAI) | `codex` MCP server | Cross-family baseline |
| Gemini (Google) | Bundled MCP server | Targeted review and analysis |

The proxy agents act as device drivers — translating between ae's protocols and each family's interface. Without them, the system still runs; you just lose cross-family coverage.

### Cross-Family Setup (optional but recommended)

| Family | How to set up |
|--------|--------------|
| Codex (OpenAI) | `npm install -g @openai/codex` |
| Gemini (Google) | Set `GEMINI_API_KEY` env var ([get a key](https://aistudio.google.com/apikey)) |

`/ae:setup` guides you through cross-family configuration.

## Extending ae

ae auto-discovers agents from `.claude/agents/` in your project. Add a 3-line file and ae includes it in the right teams:

```markdown
# .claude/agents/security-auditor.md
---
name: security-auditor
description: "Reviews code for security vulnerabilities and auth bypass"
---
You are a security specialist. Focus on OWASP Top 10 and injection vectors.
```

Project agents are preferred over built-in agents when roles match. See the [Agent Authoring Guide](docs/agent-authoring.md) for the full contract, role taxonomy, and examples.

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

## Architecture

```
plugins/ae/
  .claude-plugin/plugin.json      # Plugin manifest
  skills/                         # 20 slash commands (the shell)
  agents/                         # 16 specialized agents (the processes)
    review/                       #   4 review agents
    research/                     #   3 research agents
    workflow/                     #   6 workflow agents (incl. test-lead)
    workflow/doodlestein-*        #   3 Doodlestein challenge agents
  tests/                          # Persistent test cases (manual + generated)
  mcp-servers/gemini/             # Bundled Gemini MCP server (device driver)
  templates/pipeline.template.yml # Template for /ae:setup
```

## License

MIT
