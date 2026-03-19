---
name: setup
description: Initialize or update project pipeline config (.claude/pipeline.yml)
argument-hint: "[update]"
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
3. Auto-detect and suggest code reviewer agents
4. Use AskUserQuestion to confirm generated config
5. Write `.claude/pipeline.yml`

If `.claude/pipeline.yml` already exists: suggest `/ae:setup update`.

### `update` argument: Update existing config

Read current `.claude/pipeline.yml`, compare with template:

1. Check for new fields in template (missing from config)
2. Check for deprecated fields
3. Show diff, use AskUserQuestion to confirm

## Output

1. `.claude/pipeline.yml` written to project
2. Show final config to user
3. Prompt: "Pipeline ready. Use `/ae:plan <feature>` to start."
