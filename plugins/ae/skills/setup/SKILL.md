---
name: ae:setup
description: Initialize or update project pipeline config (.claude/pipeline.yml)
argument-hint: "[update]"
user-invocable: true
---

# /ae:setup — Pipeline Config Setup

Initialize or update the current project's `.claude/pipeline.yml`.

## Mode

### No argument: Initialize

If `.claude/pipeline.yml` does not exist:

1. Read the pipeline template from this plugin's `templates/pipeline.template.yml`
2. Auto-detect project type and fill in config:
   - `pyproject.toml` / `setup.py` → Python (pytest + ruff)
   - `package.json` → Node/TS (jest/vitest + eslint)
   - `pubspec.yaml` → Flutter (flutter test + dart analyze)
   - `go.mod` → Go (go test + golangci-lint)
   - `Cargo.toml` → Rust (cargo test + cargo clippy)
   - `Gemfile` → Ruby (rspec/minitest + rubocop)
   - `justfile` / `Makefile` → read existing test/lint commands
   - Multi-language → split backend/frontend config
3. Fill in `output` block — keep all 6 slots with default values:
   - `discussions: "docs/discussions/"`
   - `plans: "docs/plans/"`
   - `milestones: "docs/milestones/"`
   - `backlog: "docs/backlog/"`
   - `reviews: "docs/reviews/"`
   - `analyses: "docs/analyses/"`
4. Scan existing project directories — if project already has docs in non-default locations (e.g., `results/reviews/` instead of `docs/reviews/`), adjust slot values to match
5. **Auto-discover project agents**: Discover all available agents (project `.claude/agents/`, installed plugins, user global `~/.claude/agents/`). Read each agent's description to classify as developer or reviewer. Show discovered agents to user for confirmation. Do NOT write agent lists to pipeline.yml — agents are discovered at runtime.
6. **Guide test.command configuration**: If auto-detect found no test command, use AskUserQuestion to prompt user:
   ```
   No test command detected. ae:work's auto-pass gate treats empty test.command as UNVERIFIED,
   which pauses every step for confirmation. Options:
   1. Enter test command now (e.g., "npm test", "pytest", "cargo test")
   2. Skip — I'll configure later (auto-pass will pause each step)
   ```
7. Use AskUserQuestion to confirm generated config
8. Write `.claude/pipeline.yml`

If `.claude/pipeline.yml` already exists: suggest `/ae:setup update`.

### `update` argument: Update existing config

Read current `.claude/pipeline.yml`, compare with template:

1. Check for new fields in template (missing from config) — especially new `output` slots
2. Check for deprecated fields (e.g., old `output.review` → new `output.reviews`)
3. Show diff, use AskUserQuestion to confirm
4. Preserve user-customized values, only add missing slots with defaults

## Output Defaults

When `pipeline.yml` is absent or a slot is missing, skills use these defaults:

| Slot | Default | Used by |
|------|---------|---------|
| `output.discussions` | `docs/discussions/` | ae:analyze, ae:discuss |
| `output.plans` | `docs/plans/` | ae:plan |
| `output.milestones` | `docs/milestones/` | ae:work |
| `output.backlog` | `docs/backlog/` | ae:work, ae:review, ae:code-review |
| `output.reviews` | `docs/reviews/` | ae:review |
| `output.analyses` | `docs/analyses/` | ae:think |
| `test_plugin.judge` | `codex` | ae:test-plugin |

Skills MUST read from `pipeline.yml → output.<slot>` first. If the key is missing or pipeline.yml doesn't exist, fall back to the default above. This ensures zero-config works for new projects.

## Test & Lint Fallback

`test.command` and `lint.command` may be empty. Skills that use them (ae:work, ae:code-review) MUST handle empty values gracefully:

- **Has value** → run the command
- **Empty** → skip, show `"⚠️ No test/lint command configured, skipping"`

Empty does NOT block execution. Not all projects have tests, not all changes need testing.

## Agent Teams Setup

Check if Agent Teams is enabled (required for multi-agent workflows):

1. Read `~/.claude/settings.json` — look for `"CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS"` in the `env` object
2. If **not enabled** → use AskUserQuestion: "Agent Teams is not enabled. Most ae commands require it. Enable it now? (This will update ~/.claude/settings.json)"
   - **User confirms** → read `~/.claude/settings.json`, add/merge `"env": { "CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS": "1" }` into the JSON, write back. Tell user: "Agent Teams enabled."
   - **User declines** → warn: "Skipped. Commands that use Agent Teams (plan, work, review, team, analyze, think, consensus, testgen, trace) will refuse to execute."
3. If already enabled → `✅ Agent Teams: enabled`

## Cross-Family Setup

After writing pipeline.yml, check cross-family dependencies:

1. **Codex**: run `which codex` — if not found, suggest `npm install -g @openai/codex`
2. **Gemini**: check `GEMINI_API_KEY` env var — if not set, prompt user:
   ```
   To enable Gemini cross-family review, add to .claude/settings.local.json:
   {
     "env": {
       "GEMINI_API_KEY": "<your-api-key>"
     }
   }
   Get a key at https://aistudio.google.com/apikey
   ```
Cross-family is optional — the plugin works without it but loses blind spot coverage.

## Output

1. `.claude/pipeline.yml` written to project
2. Cross-family status checked and reported
3. Show final config to user
4. Prompt: "Pipeline ready. Use `/ae:plan <feature>` to start."

## Next Steps

Based on setup completion, suggest:
- If setup complete → "Pipeline ready. Start with `/ae:analyze <topic>` for research, or `/ae:plan <feature>` for direct planning"
- If cross-family not configured → "Optional: configure Codex/Gemini for cross-family review (see setup output)"
