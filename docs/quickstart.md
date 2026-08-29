# Quickstart Guide

## Prerequisites

1. **Claude Code** ([install](https://docs.anthropic.com/en/docs/claude-code))
2. **Node.js** ([install](https://nodejs.org)) — optional, only needed for the bundled Gemini
   and OpenAI-compatible MCP servers

Agent Teams is no longer required. The stage skills run in the ordinary session.

## Step 1: Install the plugin

In Claude Code:

```
/plugin marketplace add xmkevinchen/agentic-engineering
/plugin install ae@agentic-engineering
```

You should see: `Plugin "ae" installed successfully.`

## Step 2: Run a work item

```
/ae:go add rate limiting middleware to the Express API with per-IP limits
```

That is the whole interface. `/ae:go` invokes each stage in turn and reads its deliverable
off disk before going on:

```
ANALYZE → [DISCUSS] → PLAN → ← you confirm the criteria
                       WORK ⇄ REVIEW → ← you sign completion
```

Everything the run produces lives in one feature directory under
`.ae/features/active/F-NNN-<slug>/` — `analysis.md`, the plan, the log, the review.
If the conversation were lost, the next stage could proceed from those files alone.

You can also invoke a single stage directly — `/ae:plan <feature-dir>`,
`/ae:review <plan-path>` — when you are resuming or redoing one part.

### The two places it stops

**After PLAN**, you confirm the acceptance criteria. This is the thing being agreed; the step
cut is advisory and the loop may re-cut it freely afterwards.

**After REVIEW**, you sign completion. Tests green and a pass verdict are not completion —
a gate the executed party can open is not a gate.

Everything between those two points is the loop's own: re-planning, re-cutting steps,
discarding work and redoing it. Only a change to what a criterion *means* comes back to you.

### What a stage refuses

A stage may send its input back, and a refusal names the admission check that failed —
a criterion with no falsifier, a premise verdict whose citation does not hold when re-run,
a deterministic criterion whose check was never seen red. Each stage's `SKILL.md` states its
own.

## Step 3 (optional): configure the project

Copy [`plugins/ae/templates/pipeline.template.yml`](../plugins/ae/templates/pipeline.template.yml)
to `.claude/pipeline.yml` and fill in two things:

- `test.command` — what a stage runs to turn a check red;
- `cross_family` — which second-opinion seats are available.

Both are optional. Without the file, a stage asks you for the test command, and the
session-start probe reports that it found no `cross_family` table.

## Cross-family review

Three model families are reachable through MCP: Claude (the session itself), Codex via the
`codex` CLI, and Gemini or any OpenAI-compatible backend via the bundled servers. Proxy
agents (`codex-proxy`, `gemini-proxy`, `openai-compat-proxy`) front them.

| Family | How to set up |
|--------|--------------|
| Codex (OpenAI) | `npm install -g @openai/codex` |
| Gemini (Google) | Set `GEMINI_API_KEY` ([get a key](https://aistudio.google.com/apikey)) |
| Anything OpenAI-compatible | Set the endpoint and model in plugin settings, or per call |

A SessionStart hook probes every configured seat and warns about the ones that are
configured but unreachable. Nothing fails because a family is missing — you lose that
family's coverage, and the run says so.

## Troubleshooting

### "cross_family table not found"

The session-start probe looked for `.claude/pipeline.yml` relative to your working
directory and did not find one. Harmless if you are not using cross-family review;
otherwise copy the template as in Step 3.

### "Gemini MCP server unavailable"

Set `GEMINI_API_KEY`. Gemini is optional — you lose Gemini coverage, nothing else.

### A stage keeps refusing the same input

Read what the check expected against what it saw, and fix that. The same failure three
times means stop repeating: either re-cut the step, or take the criterion back to ANALYZE
as unmeetable.
