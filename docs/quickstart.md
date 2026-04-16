# Quickstart Guide

Get from zero to a working ae pipeline in 10 minutes.

## Prerequisites

1. **Claude Code** v1.0.33+ ([install](https://docs.anthropic.com/en/docs/claude-code))
2. **Node.js** ([install](https://nodejs.org)) — required for the Gemini MCP server
3. **Agent Teams** enabled — add to `~/.claude/settings.json`:
   ```json
   {
     "env": {
       "CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS": "1"
     }
   }
   ```
   Then restart Claude Code.

## Step 1: Install the Plugin

In Claude Code:

```
/plugin marketplace add xmkevinchen/agentic-engineering
/plugin install ae@xmkevinchen-agentic-engineering
```

You should see: `Plugin "ae" installed successfully.`

## Step 2: Set Up Your Project

Navigate to your project and run:

```
/ae:setup
```

ae auto-detects your test and lint commands. It creates `.claude/pipeline.yml` — the config file that all ae commands read.

**Expected output:**
```
Detected: Node.js project
  test.command: "npm test"
  lint.command: "npm run lint"

Output directories configured:
  discussions: docs/discussions/
  plans: docs/plans/
  ...

Cross-family status:
  Codex: available ✓
  Gemini: available ✓

Pipeline config written to .claude/pipeline.yml
```

If your project doesn't have a test command, ae will ask. You can skip — but `/ae:work` will pause at every step for manual confirmation instead of auto-passing.

## Step 3: Create a Plan

Let's say you want to add rate limiting to an Express API:

```
/ae:plan add rate limiting middleware to the Express API with per-IP limits
```

ae researches your codebase, writes a step-by-step plan with acceptance criteria, then runs a multi-agent review (architect + dependency analyst + cross-family proxies).

**Expected output:**
```
## Feature: Rate Limiting Middleware

### Step 1: Add rate-limiter-flexible dependency (AC1)
- [ ] Install rate-limiter-flexible
- [ ] Configure per-IP limits in config
Expected files: package.json, package-lock.json, src/config/rate-limit.ts

### Step 2: Implement middleware (AC1, AC2)
- [ ] Create rate limiting middleware
- [ ] Wire into Express app
Expected files: src/middleware/rate-limiter.ts, src/app.ts

### Step 3: Add tests (AC3)
- [ ] Unit tests for rate limiter
- [ ] Integration test for rate-limited endpoint
Expected files: tests/middleware/rate-limiter.test.ts

## Acceptance Criteria
### AC1: Rate Limit Enforced
Requests exceeding 100/min per IP receive 429 status...
```

## Step 4: Execute the Plan

```
/ae:work
```

ae picks up the most recent reviewed plan and executes it step by step:

1. **Write test** — based on the step's acceptance criteria
2. **Confirm red** — test fails (it should — nothing's implemented yet)
3. **Implement** — minimum code to make the test pass
4. **Confirm green** — all tests pass
5. **Code review** — Claude + Codex + Gemini review the diff
6. **Commit** — one step = one commit

Each step auto-continues if tests pass and no P1 issues are found.

**Expected output per step:**
```
Pre-checks:
✅ Plan exists: docs/plans/001-rate-limiting.md
✅ Current step: Step 1 (0 done)
✅ Agent Teams: enabled

[Step 1: Add rate-limiter-flexible dependency]
  📝 Writing test...
  🔴 Test fails (expected)
  🔨 Implementing...
  🟢 Tests pass
  📋 Code review: no P1, no drift
  ✅ Committed: a1b2c3d

✅ Auto-pass: continuing to Step 2...
```

## Step 5: Review the Feature

After all steps complete:

```
/ae:review
```

ae assembles a full review panel — code reviewer, architecture reviewer, security reviewer, performance reviewer, plus cross-family agents. They evaluate the entire feature against the plan's acceptance criteria.

**Expected output:**
```
Review: Rate Limiting Middleware
  Verdict: pass ✅

Findings:
  P2 (style): consider extracting config to env vars [auto-skipped]
  P3 (minor): typo in error message [auto-skipped]

Feature complete. Ready for merge.
```

## What's Next?

- **`/ae:dashboard`** — see all your features and where they stand
- **`/ae:next`** — get a suggestion for what to do next
- **`/ae:discuss`** — start a design discussion before planning a complex feature
- **`/ae:team`** — spin up an ad-hoc agent team for any task

## Troubleshooting

### "Agent Teams is required"
You haven't enabled Agent Teams. Add the env var to `~/.claude/settings.json` and restart Claude Code. See [Prerequisites](#prerequisites).

### "Gemini MCP server unavailable"
Set your `GEMINI_API_KEY` environment variable. Get a key at [aistudio.google.com/apikey](https://aistudio.google.com/apikey). Gemini is optional — ae works without it, you just lose cross-family Gemini coverage.

### "No test command configured"
ae's auto-pass gate treats empty `test.command` as UNVERIFIED, which pauses every step. Run `/ae:setup update` to add your test command, or edit `.claude/pipeline.yml` directly.

### Steps keep pausing for confirmation
Check `pipeline.yml → work.auto_pass`. If set to `false`, every step pauses. Set to `true` for automatic continuation when tests pass and no P1 issues found.
