# Agentic Engineering

**Stop prompting one model and hoping for the best.**

ae is a [Claude Code](https://docs.anthropic.com/en/docs/claude-code) plugin that runs one piece
of work through a fixed workflow: establish the problem is real, settle what *done* means, cut
the work, execute it against checks that were seen failing first, then judge it against the
criteria that were frozen before any of it started. Two points wait for a human. Everything
else the loop decides for itself.

Think of it as a disciplined senior engineer who will not let you skip the boring part.

## Who is this for?

Solo developers and small teams who want:
- **A repeatable loop** — not ad-hoc prompting: analyze → plan → work → review, with named refusals between stages
- **Criteria settled before work starts** — and never edited silently once they are
- **Persistent artifacts** — the analysis, plan, log and review survive context compaction, because they are files
- **Cross-family review** — Codex and Gemini catch what a Claude-only panel shares a blind spot on
- **Agent extensibility** — add your own domain-expert agents alongside the built-in ones

## When NOT to use ae

- Simple one-off tasks (just use Claude Code directly)
- Non-Claude-Code environments
- Projects where you don't want persistent artifacts on disk

## Quick Start

**Prerequisites**: [Claude Code](https://docs.anthropic.com/en/docs/claude-code) · [Node.js](https://nodejs.org) (optional — only for the bundled MCP servers)

```bash
# 1. Install the plugin
/plugin marketplace add xmkevinchen/agentic-engineering
/plugin install ae@agentic-engineering

# 2. In your project — this is the whole interface
/ae:go add rate limiting middleware with per-IP limits
```

See the [Quickstart Guide](docs/quickstart.md) for a full walkthrough.

## The workflow

```
        intent (human)
           │
           ▼
       1 ANALYZE ──── premise fails → stop, report why
           │
           ▼
      [2 DISCUSS] ─── only if a decision is genuinely contested
           │
           ▼
       3 PLAN
           │
           ▼  ← HUMAN CONFIRMS the acceptance criteria
       4 WORK ◄──────────┐
           │             │ findings needing rework
           ▼             │
       5 REVIEW ─────────┘
           │             ╌╌╌► a criterion changes — back to ANALYZE, via the human
           ▼  ← HUMAN SIGNS completion
         done
```

Everything a run produces lives in one feature directory under
`.ae/features/active/F-NNN-<slug>/`. A stage reads the previous stage's deliverable off disk
before it starts, and may **refuse** it — naming the admission check that failed, and sending
it back one stage rather than to the start. What each stage may refuse, and what needs a
human signature, is in [`plugins/ae/handover.md`](plugins/ae/handover.md).

Open [`docs/workflow-graph.html`](docs/workflow-graph.html) in a browser for the same graph
with the return edges and refusal conditions drawn in.

## Commands

| Command | What it does |
|---------|-------------|
| `/ae:go` | **The entry.** Runs a work item through every stage in turn. |
| `/ae:analyze` | Stage 1 — is the problem real, and what does *done* mean? Creates the feature directory. |
| `/ae:discuss` | Stage 2 (conditional) — settle one contested decision into a record the plan can consume. |
| `/ae:plan` | Stage 3 — copy the criteria, cut dependency-ordered steps, freeze the goal. |
| `/ae:work` | Stage 4 — check red, implement, check green, commit. One step, one commit. |
| `/ae:review` | Stage 5 — judge the work against the frozen criteria. The completion gate. |

Invoke a single stage directly when you are resuming or redoing one part; otherwise use
`/ae:go`.

## Agents

18 specialized agents in four groups. `/ae:go` and the stage skills spawn them; you can also
ask for one by name in any session.

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
| `codex-proxy` | Routes requests to Codex (OpenAI) via MCP |
| `gemini-proxy` | Routes requests to Gemini (Google) via MCP |
| `openai-compat-proxy` | Any OpenAI-compatible backend — endpoint, model and family per call |

### Engineering Agents — the implementer
| Agent | Focus |
|-------|-------|
| `minimal-change-engineer` | Minimum-viable diffs; refuses scope creep |

### Doodlestein Agents — the challenge layer
| Agent | Focus |
|-------|-------|
| `doodlestein-strategic` | "What's the smartest alternative that makes this unnecessary?" |
| `doodlestein-adversarial` | "Which part solves a problem that doesn't exist?" |
| `doodlestein-regret` | "Which decision will be reversed within 2 weeks?" |
| `doodlestein-scope-reducer` | "Of everything this adds, what could be deleted such that the original problem is still solved?" |

## Cross-Family Architecture

No single model catches everything. ae reaches other families through MCP:

| Family | Channel | Role |
|--------|---------|------|
| Claude | Built-in | Primary development and orchestration |
| Codex (OpenAI) | `codex` MCP server (external CLI) | Cross-family baseline |
| Gemini (Google) | Bundled MCP server | Targeted review and analysis |
| Anything OpenAI-compatible | Bundled MCP server | A local or hosted backend on the generic seat |

The proxy agents act as device drivers — translating between ae's protocols and each family's
interface. Without them the system still runs; you just lose cross-family coverage.

A SessionStart hook probes every seat you configured and warns about the ones that are
configured but unreachable, so a missing family is visible rather than silent.

### Cross-Family Setup (optional but recommended)

| Family | How to set up |
|--------|--------------|
| Codex (OpenAI) | `npm install -g @openai/codex` |
| Gemini (Google) | Set `GEMINI_API_KEY` ([get a key](https://aistudio.google.com/apikey)) |
| OpenAI-compatible | Set the endpoint, model and family in plugin settings |

## Extending ae

Claude Code auto-discovers agents from `.claude/agents/` in your project. Add a 3-line file
and it becomes spawnable:

```markdown
# .claude/agents/security-auditor.md
---
name: security-auditor
description: "Reviews code for security vulnerabilities and auth bypass"
---
You are a security specialist. Focus on OWASP Top 10 and injection vectors.
```

See the [Agent Authoring Guide](docs/agent-authoring.md) for the full contract, role
taxonomy, and examples.

## Project Configuration

`.claude/pipeline.yml` is optional. Two things read it:

```yaml
test:
  command: "npm test"        # what a stage runs to turn a check red

cross_family:                # which second-opinion seats exist
  codex:  { seat: codex,  family: openai }
  gemini: { seat: gemini, family: google }
```

Copy [`plugins/ae/templates/pipeline.template.yml`](plugins/ae/templates/pipeline.template.yml)
as a starting point. Feature artifacts live under `.ae/features/` regardless; that layout is
fixed, not configured.

## Architecture

```
plugins/ae/
  .claude-plugin/plugin.json      # Plugin manifest, MCP servers, SessionStart hook
  skills/                         # 6 skills — the entry plus five stages
  handover.md                     # What one stage may refuse the next for
  agents/                         # 18 agents
    review/                       #   4 review agents
    research/                     #   3 research agents
    workflow/                     #   10 workflow agents (incl. proxies + Doodlestein)
    engineering/                  #   1 implementer
  scripts/                        # Session-start probe, its reader, the test runner
  mcp-servers/                    # Bundled Gemini + OpenAI-compatible servers
  v1/                             # The Phase 1 Kernel, against its own frozen Contract
  tests/                          # The deterministic suite
  templates/pipeline.template.yml
```

The research, cross-review, and decisions that produced the v1.0 design are
preserved in the [AE v1.0 design history](docs/history/ae-v1-design-history/README.md).

## License

MIT
