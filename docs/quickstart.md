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
ANALYZE → [DISCUSS] → ← you confirm the criteria
              PLAN → WORK ⇄ REVIEW → ← you sign completion
```

Everything the run produces lives in one feature directory under
`.ae/features/active/F-NNN-<slug>/` — `analysis.md`, the plan, the log, the review.
If the conversation were lost, the next stage could proceed from those files alone.

You can also invoke a single stage directly — `/ae:plan <feature-dir>`,
`/ae:review <plan-path>` — when you are resuming or redoing one part.

### The two places it stops

**Before PLAN**, once ANALYZE and any DISCUSS have stopped moving the criteria, you confirm
them. That is the thing being agreed, and planning does not start without it.

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

- `cross_family` — which second-opinion seats are available. **This is the one key anything
  reads**: the session-start probe walks it and warns about seats that are configured but
  unreachable.
- `test.command` — a convention, not a hook. It is where you write down what this project's
  check is called; nothing runs it for you.

Both are optional. Without the file, the session-start probe reports that it found no
`cross_family` table, and a stage asks you for a command when it needs one.

## Cross-family review

Three model families are reachable: Claude (the session itself), Codex as a `codex exec`
subprocess, and Gemini or any OpenAI-compatible backend through the bundled MCP servers. Proxy
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

### A seat's probe failed at session start

The warning names the entry, its family and its seat — `gemini (google via gemini): probe
failed`. Fix that seat's prerequisite (for Gemini, set `GEMINI_API_KEY`; for Codex, put the
`codex` CLI on `PATH`) or switch the entry off with `enabled: false`. Nothing fails because a
family is unreachable — you lose that family's coverage, and the run says so.

### A stage keeps refusing the same input

Read what the check expected against what it saw, and fix that. The same failure three
times means stop repeating: either re-cut the step, or take the criterion back to ANALYZE
as unmeetable.
