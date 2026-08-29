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

**Prerequisites**: [Agent Teams](https://code.claude.com/docs/en/agent-teams) enabled · [Claude Code](https://docs.anthropic.com/en/docs/claude-code) v1.0.33+ · [Node.js](https://nodejs.org) (optional — only for Gemini)

```bash
# 1. Enable Agent Teams (required for /ae:discuss and /ae:review;
#    /ae:plan and /ae:work fall back to solo mode without it)
# Add to ~/.claude/settings.json:
#   { "env": { "CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS": "1" } }

# 2. Install the plugin
/plugin marketplace add xmkevinchen/agentic-engineering
/plugin install ae@agentic-engineering

# 3. In your project
/ae:setup          # creates .claude/pipeline.yml
/ae:plan add rate limiting middleware   # generate a plan with acceptance criteria
/ae:work           # execute it (TDD + commit + review loop)
```

See [Quickstart Guide](docs/quickstart.md) for a full walkthrough.

## Cross-machine setup

If you use `/ae:setup agents --library <path>` to wire an external agent library (e.g. `agency-agents`), the library path is captured as a relative path in your project's `pipeline.yml` `agent_libraries[].source`. On a fresh checkout to a different machine, the library directory may not exist at the same relative location.

**What you'll see**: actionable error messages from `/ae:setup agents --list`, `--add`, and `--sync` pointing back to this section. (Note: `/ae:setup agents --remove` is unaffected — it operates on local `.claude/agents/` and `pipeline.yml` only and does NOT read library source.)

**2-step recovery**:
1. `cd <parent-dir> && git clone <library-url>` — clone the library at the relative path your `pipeline.yml` `agent_libraries[].source` references. Example: if `source: "../agency-agents"`, then `<parent-dir>` is the parent of your project root and `<library-url>` is whatever URL the library was originally cloned from.
2. Re-run the AE command that failed; the library is now resolvable.

**Why not auto-clone?** AE keeps a local-files-only architecture for solo-dev simplicity (no network at runtime). A future enhancement to capture the library's URL at `--library` time (so error messages can include actionable git-clone hints) is on AE's internal roadmap, trigger-gated on library count growing past a threshold OR multi-user onboarding scenario OR concrete user-friction incident.

## The Pipeline

ae's project model maps to [Getting Things Done](https://en.wikipedia.org/wiki/Getting_Things_Done) phases:

```
                          GTD phase                Skill
─────────────────────────────────────────────────────────────────
Capture an idea         → Capture          →  /ae:backlog
Decide what's next      → Clarify          →  /ae:roadmap
Promote to a feature    → Organize         →  /ae:analyze
Where do I stand?       → Reflect (short)  →  /ae:dashboard, /ae:next
Execute                 → Engage           →  /ae:discuss  →  /ae:plan
                                              /ae:work     →  /ae:review
Look back on shipped    → Reflect (long)   →  /ae:retrospect
```

Each Engage stage produces artifacts that feed the next. Plans reference analysis docs. Work follows plan steps. Reviews validate against acceptance criteria. Everything persists to disk under `.ae/features/F-NNN-<slug>/`.

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
| `/ae:backlog` | Capture an idea — one-line description lands in the inbox as `BL-NNN` |
| `/ae:dashboard` | See where your features stand — pipeline progress at a glance |
| `/ae:next` | "What should I do next?" — suggests the next pipeline step |
| `/ae:status` | Session readout — git context, active features, in-flight teams, recent verdicts |
| `/ae:code-review` | Quick pre-commit review (Claude + Codex + Gemini + Doodlestein) |
| `/ae:team` | Spin up an ad-hoc agent team — auto-selects agents for your task |
| `/ae:testgen` | Generate test suites with edge case coverage |

### Analysis & Design

| Command | What it does |
|---------|-------------|
| `/ae:analyze` | GTD Organize — promote a backlog item to a feature directory (or analyze a free-text topic) |
| `/ae:roadmap` | GTD Clarify — promote candidates from the backlog, surface feature dependencies, archive done roadmaps |
| `/ae:discuss` | Structured design discussion with decision persistence |
| `/ae:think` | Deep reasoning for hard architecture decisions or complex bugs |
| `/ae:consensus` | Multi-round debate (for/against/neutral) with cross-examination |
| `/ae:trace` | Trace execution flow or map dependency chains |

### Ops & Meta

| Command | What it does |
|---------|-------------|
| `/ae:plan-review` | Re-review an existing plan (standalone, without regenerating) |
| `/ae:test-plugin` | Adversarial behavioral testing — blind execution, LLM-as-judge |
| `/ae:retrospect` | Project-level long-cycle Reflect — review what shipped, what worked, what to change |
| `/ae:plugin-stats` | AE plugin self-development stats — rework rates, P1 escape rate, drift events (separate from project retrospect) |
| `/ae:agent-teams` | Protocol reference: Agent Teams base layer + modes |
| `/ae:agent-selection` | Protocol reference: team composition and cross-family roles |

## Agents

18 specialized agents in four groups:

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
| `doodlestein-scope-reducer` | "Of everything this adds, what could be deleted such that the original problem is still solved?" |

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

ceremony: full                     # full (default) | light | minimal — see "Ceremony level" below

# Feature artifacts live at .ae/features/F-NNN-<slug>/ by default (no config needed).
# Add an `output:` block only to override legacy / free-text artifact paths
# (defaults: .ae/discussions/, .ae/plans/, .ae/reviews/, .ae/milestones/,
# .ae/backlog/, .ae/analyses/). See plugins/ae/templates/pipeline.template.yml
# for the canonical reference.

cross_family:
  codex: true
  gemini: true
```

### Ceremony level

Reduce ceremony per-project for lighter iteration:

```yaml
# pipeline.yml
ceremony: light  # full (default) | light | minimal
```

- `full` (default) — all 5 stages enabled (current behavior)
- `light` — skips accumulated Doodlestein + plan Doodlestein + sets `work.review_mode: light`
- `minimal` — `light` plus skips plan review

**Per-stage asymmetry note**: `light` reduces only background-execution stages (Doodlestein checkpoints + code-review tracks) — it does NOT skip the upfront plan review. Use `minimal` if you also want to bypass plan review. The `discuss` and `review` skills are not currently controlled by the ceremony preset.

The preset bundles 5 stages: `work.agent_teams`, `work.review_mode`, `work.accumulated_doodlestein`, `plan.plan_review`, `plan.doodlestein`. See [`plugins/ae/templates/pipeline.template.yml`](plugins/ae/templates/pipeline.template.yml) for the canonical bundling rules.

**Precedence**: env var `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=0` (global solo mode, see [Cross-machine setup](#cross-machine-setup)) overrides the ceremony preset. Use the env var for CI/CD or per-machine override; use `ceremony:` for per-project default.

## Architecture

```
plugins/ae/
  .claude-plugin/plugin.json      # Plugin manifest
  skills/                         # 24 slash commands (the shell)
  agents/                         # 18 specialized agents (the processes)
    review/                       #   4 review agents
    research/                     #   3 research agents
    workflow/                     #   7 workflow agents (incl. test-lead, minimal-change-engineer)
    workflow/doodlestein-*        #   4 Doodlestein challenge agents
  tests/                          # Persistent test cases (manual + generated)
  mcp-servers/gemini/             # Bundled Gemini MCP server (device driver)
  templates/pipeline.template.yml # Template for /ae:setup
```

The research, cross-review, and decisions that produced the v1.0 design are
preserved in the [AE v1.0 design history](docs/ae-v1-design-history/README.md).

## License

MIT
