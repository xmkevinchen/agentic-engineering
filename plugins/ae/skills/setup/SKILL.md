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
5. **Auto-discover project agents**: Scan `.claude/agents/*.md`, installed plugin agents, and `~/.claude/agents/*.md`. For each discovered agent, read `description` to infer role per the [Agent Contract Specification](../../../docs/decisions/037-agent-contract.md): reviewer (review/audit/security keywords), developer (implement/build keywords), or domain-expert (expert/specialist keywords). Show discovered agents with inferred roles to user for confirmation. Do NOT write agent lists to pipeline.yml — agents are discovered at runtime. The `project_agents:` section in pipeline.yml is for explicit role overrides only (agents outside `.claude/agents/` or when inference is wrong).
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

### `agents` argument: Library-to-project agent curation (BL-005)

`/ae:setup agents [subcommand]` curates third-party or hand-written agents into `.claude/agents/`. The flat `.claude/agents/` namespace is mandatory — CC resolves `subagent_type` by filename stem (see `docs/references/agent-contract.md`).

Phase 1 CLI surface (full list; Steps 3/4/6 of plan 041 add import/suggest/governance subcommands — this section documents the baseline scaffolding + browse/remove/phase subflags):

```
/ae:setup agents --library <path>                     # declare library (multi-library supported)
/ae:setup agents --list [--category <cat>]            # browse configured libraries
/ae:setup agents --add <name|library:name>            # import (Step 3 adds import mechanism)
/ae:setup agents --remove <name>                      # delete + cleanup
/ae:setup agents --sync [--diff]                      # upstream drift detection (Step 3)
/ae:setup agents --detach <name>                      # break upstream link (Step 3)
/ae:setup agents --suggest [--phase <enum>] [--why]   # smart selection (Step 4)
/ae:setup agents --refresh                            # advisory audit (Step 4)
```

Library reference is persistent — set once via `--library`, reused across subsequent `--suggest` / `--add` runs.

#### `--library <path>`

Declare an external agent library for curation. Multi-library supported.

Behavior:

1. **Validate path**: resolve `<path>` relative to project root (or accept absolute). If path does not exist → refuse with `[ae:setup] path not found: <path>`.
2. **Scan library structure**: list immediate subdirectories — these become `category` values. If no subdirectories (flat library), record `categories: []` and treat all agents as a single uncategorized bucket.
3. **Prompt for library name**: use `AskUserQuestion` asking for a short identifier (default: derive from last path segment, e.g., `agency-agents` from `../agency-agents`). Name must be unique across `agent_libraries:` in pipeline.yml.
4. **Append to pipeline.yml**: add new entry under `agent_libraries:` array with `name`, `source`, `categories` (if detected), `checked_at: <today>`. If `agent_libraries:` section doesn't exist, create it.
5. **Name collision**: if user-supplied name matches an existing library entry → refuse with `[ae:setup] library name '<name>' already declared. Remove existing entry first or pick a different name.`
6. **Low-signal-library warning** (one-shot at `--library` time, not on every `--suggest`): scan corpus after adding — if >50% of agent descriptions are <50 chars OR >70% lack any role-inference keyword (`review|audit|implement|build|expert|specialist`) → emit `[ae:setup] library '<name>' has thin metadata: N/M agents have <50-char descriptions, K/M lack role keywords. --suggest results may be limited; consider --list + manual browsing`.

Example output:
```
$ /ae:setup agents --library ../agency-agents
Detected 20 categories (engineering, product, design, testing, ...)
Library name [agency-agents]: <Enter>
[ae:setup] Added library 'agency-agents' (source: ../agency-agents, 226 agents across 20 categories)
[ae:setup] library 'agency-agents' has thin metadata: 158/226 agents have <50-char descriptions, 82/226 lack role keywords. --suggest results may be limited; consider --list + manual browsing
```

#### `--list [--category <cat>]`

Browse configured libraries. Presents a table (library, category, name, first-line-description).

Behavior:

1. **Read `agent_libraries:` from pipeline.yml**. Absent → print `[ae:setup] No library configured. Run /ae:setup agents --library <path> first.` and exit.
2. **Traverse each library**: for each library source, list `.md` files under configured categories (or all if flat). Read frontmatter `name`, `description`. Skip files with malformed YAML (warn once per library: `[ae:setup] <library>: M/N agents have malformed YAML, skipped`).
3. **Library-path-missing tolerance**: if a library's `source:` path no longer exists → warn `[ae:setup] library '<name>' path missing: <source>. Skipping.` and continue with remaining libraries (do not abort).
4. **Filter by `--category <cat>`** (optional): show only agents whose category matches. Case-insensitive match on directory name. If no agents match → print `No agents in category '<cat>'`.
5. **Output format**: pretty table with columns `library-qualified-id | category | role-hint | description`. `library-qualified-id` = `<library>:<filename-stem>`. Role hint is inferred per `docs/references/agent-contract.md` role-inference heuristic.

Example:
```
$ /ae:setup agents --list --category engineering
library-qualified-id                                  category     role          description
agency-agents:engineering-code-reviewer               engineering  reviewer      Expert code reviewer who provides constructive feedback...
agency-agents:engineering-software-architect          engineering  domain-expert System design, DDD, architectural patterns expert...
agency-agents:engineering-security-engineer           engineering  reviewer      Security vulnerabilities, auth bypass, injection vectors...
(23 agents in category engineering)
```

#### `--remove <name>`

Remove an imported agent and clean up references.

Behavior:

1. **Resolve target**: `<name>` is the filename stem (e.g., `engineering-code-reviewer`). Also accept library-qualified form (`agency-agents:engineering-code-reviewer`) — both resolve to the same filename.
2. **Delete agent file**: `rm .claude/agents/<name>.md`. If file doesn't exist → refuse with `[ae:setup] agent not found: .claude/agents/<name>.md`.
3. **Remove pipeline.yml entry**: delete matching `project_agents[]` entry by `name:` field.
4. **Governance rule cleanup**: if `.claude/agent-governance.md` exists, scan for `rules[].agent: <name>` entries. For each match, prompt user: `Rule references removed agent '<name>' (context: [X, Y], scope: <s>). Delete rule? [Y/n]`. On Y, remove rule from file.
5. **Summary output**: report file deleted, pipeline.yml entry removed, N governance rules cleaned.

#### `--add <name | library:name>`

Import a library agent into `.claude/agents/` with upstream tracking.

Behavior (ordered protocol):

1. **Resolve target**. Accept plain filename stem (e.g., `engineering-code-reviewer`) OR library-qualified form (`agency-agents:engineering-code-reviewer`). If plain form AND multiple libraries contain the same stem → refuse with `[ae:setup] name '<stem>' ambiguous — present in libraries: <A>, <B>. Use library-qualified form: <A>:<stem>`.
2. **Read library file**. Open `<library.source>/<category>/<name>.md` (or flat path if library has no categories).
3. **Parse YAML frontmatter**. If malformed → skip this agent with warning `[ae:setup] skip <name>: malformed YAML (line N)`. Do NOT abort. (Relevant in batch contexts — single `--add` refuses, `--suggest` batch-apply continues.)
4. **Compute source SHA**.
   - If library is a git repo: `git -C <library.source> hash-object <relative-file-path>` → record as `source_sha`.
   - Else: compute `sha256` of file content → record as `source_sha`.
   - If BOTH fail (e.g., file read error): skip this agent with warning `[ae:setup] skip <name>: cannot compute content hash`. Do NOT proceed with partial import.
5. **Ensure `.claude/agents/` exists**. Equivalent to `mkdir -p .claude/agents/`. Safe if already exists.
6. **Filename collision check**: if `.claude/agents/<name>.md` already exists → present options (see "Filename collision handling" below). Do NOT overwrite silently.
7. **Built-in spawn-identifier shadowing check**: if `<name>` matches an AE built-in agent filename stem (see "Built-in shadowing" below), warn and prompt before proceeding.
8. **Copy file as-is**. Write original library file bytes to `.claude/agents/<name>.md`. Do NOT modify `name:` field or any other frontmatter (conclusion 040 T1 — CC resolves by filename stem, `name:` is display-only).
9. **Append project_agents entry**:
   ```yaml
   project_agents:
     - name: <filename-stem>
       role: <inferred>                # per docs/references/agent-contract.md role-inference fallback
       source: "<library-name>:<category>/<filename>.md"
       source_sha: <sha>
       display_name: "<original name: field>"
       imported_at: <YYYY-MM-DD>
       modified: false
       # Optional fields populated if frontmatter provides them:
       tech_stack: <from library frontmatter or []>
       specialty: <from library frontmatter or "">
       priority: 50                    # Phase 1 default
       required: false
   ```
10. **Summary output**: `[ae:setup] Imported <library>:<name> → .claude/agents/<name>.md (role: <role>, sha: <sha>)`.

##### Filename collision handling

If `.claude/agents/<filename-stem>.md` already exists when `--add` attempts to write:

```
[ae:setup] Collision: .claude/agents/<name>.md already exists.

Options:
1. Overwrite — replace existing file with library version (existing pipeline.yml entry updated)
2. Rename copy — provide a new filename stem; library agent lands at .claude/agents/<new-stem>.md
3. Abort — no changes

Choose [1/2/3]:
```

- Option 1: overwrite. Read existing file's sha first; if it differs from the stored `source_sha` in the current pipeline.yml entry (i.e., user has local edits), require explicit confirmation: "Existing file has local modifications. Overwrite anyway? [y/N]". Default N.
- Option 2: rename. User provides new stem (validate: kebab-case, no path separators, not matching another built-in or project agent). New stem becomes the filename; `name:` field in the copied file is NOT rewritten (canonical spawn identifier = filename stem per contract).
- Option 3: abort. No file written, no pipeline.yml change.

##### Built-in shadowing

Before writing to `.claude/agents/<name>.md`, check if `<name>` matches an AE built-in agent filename stem. Built-ins are enumerated at runtime from:

- `plugins/ae/agents/workflow/*.md` (e.g., `architect`, `qa`, `challenger`, `codex-proxy`, `gemini-proxy`, `team-lead`, `test-lead`, `doodlestein-strategic`, `doodlestein-adversarial`, `doodlestein-regret`)
- `plugins/ae/agents/review/*.md` (e.g., `code-reviewer`, `architecture-reviewer`, `performance-reviewer`, `security-reviewer`)
- `plugins/ae/agents/research/*.md` (e.g., `archaeologist`, `dependency-analyst`, `standards-expert`)

If `<name>` matches any built-in stem:

```
[ae:setup] Warning: '<name>' shadows AE built-in agent.

Project agents take precedence over built-ins in agent-selection Rule 4 Layer 2.
Importing this agent will cause it to be preferred over the built-in of the same name.

Options:
1. Accept shadow — import as '<name>' (built-in will be preferred)
2. Rename copy — import under a different stem (both will coexist)
3. Abort

Choose [1/2/3]:
```

Shadow acceptance is legitimate when user intentionally replaces a built-in (e.g., their own stricter `code-reviewer`). Rename is preferred when the user wants both perspectives.

##### Batch error reporting

When `--add` receives multiple targets (comma-separated, or invoked by `--suggest` batch-apply flow), emit a single summary at the end:

```
[ae:setup] Import summary:
  ✅ Imported: 4 agents
  ⚠️ Skipped: 2 agents
     - engineering-filament-expert: malformed YAML (line 3)
     - design-obscure-agent: cannot compute content hash
```

A single-file `--add` invocation still benefits from the summary format (1-line success) to keep output consistent.

#### `--detach <name>`

Break upstream link for an imported agent without deleting the file.

Behavior:

1. **Locate project_agents entry** matching `<name>`. If no entry or the entry has no `source:` field → refuse with `[ae:setup] <name> is not a library-sourced agent (no upstream to detach)`.
2. **Remove upstream-tracking fields** from the entry: `source`, `source_sha`, `imported_at`, `modified`. Keep: `name`, `role`, `display_name` (promoted to optional — user can remove manually), `priority`, `required`, `tech_stack`, `specialty`.
3. **Retain file**: `.claude/agents/<name>.md` stays as-is. `--sync` will no longer process this agent.

Detach is a one-way operation. To re-link, run `--remove` then `--add` again (this will recompute `source_sha` from current library head).

#### `--sync [--diff]`

Drift detection against library upstream.

Behavior:

1. **Scan project_agents with `source:`**. Skip entries without `source:` (hand-written agents; `--detach`ed agents).
2. **Per-agent sync check**:
   - Re-locate library file by `source:` field. If library path missing → warn `[ae:setup] <name>: library '<library-name>' path missing. Skipping.` and continue.
   - Compute current library-file SHA (git hash-object or sha256 per same protocol as `--add` step 4).
   - Compute current `.claude/agents/<name>.md` SHA.
   - **Case 1**: library SHA == stored `source_sha` AND local SHA == stored `source_sha` → no drift. No action.
   - **Case 2**: library SHA != stored `source_sha` AND local SHA == stored `source_sha` → upstream update available. Mark agent `modified: false` (unchanged), emit `[ae:setup] <name>: upstream updated (from <old_sha> to <new_sha>). Run --sync --diff to preview, --add --force-update to apply.`
   - **Case 3**: library SHA == stored `source_sha` AND local SHA != stored `source_sha` → user has local edits. Set `modified: true` in pipeline.yml entry. Emit `[ae:setup] <name>: local modifications detected (sha drift from <source_sha>).`
   - **Case 4**: both differ (library updated AND user edited) → set `modified: true`, emit `[ae:setup] <name>: both upstream and local have diverged. Manual merge required. Run --sync --diff to preview differences.`
3. **With `--diff` flag**: for each non-clean case, show `diff` output between three pairs as applicable: stored (source_sha content not cached locally — use library history if available) vs current library vs current local file. If stored content can't be retrieved, show only `local vs library` diff.
4. **No automatic overwrite**. `--sync` never writes to `.claude/agents/` files. Separate `--add --force-update <name>` (out of scope for Phase 1; user can manually `--remove` + `--add` to refresh) is the path to accept upstream updates.

Summary output at end: counts of clean / upstream-updated / locally-modified / both-diverged / library-missing agents.

#### `--phase <early | build | scale | maintenance>`

Closed enum flag for `--suggest`. When provided, biases smart-selection scoring toward phase-appropriate agents. When absent, no phase bias.

Phase-appropriate agents (heuristic, used by scorer — full bias rules in `docs/references/agent-selection-scorer.md`, written in Step 4):

| Phase | Favored roles / specialties |
|-------|----------------------------|
| `early` | architect, minimal-change-engineer, rapid-prototyper |
| `build` | reviewer, security-engineer, technical-writer, developer |
| `scale` | performance-engineer, devops-automator, sre, incident-response |
| `maintenance` | bug-hunter, refactorer, deprecation-specialist |

**Phase 1 manual-only**: no auto-inference from roadmap/LOC/commit density. Conclusion 040 T7: auto-inference deferred to Phase 4 because no industry framework auto-adjusts toolset by phase (npm/cargo/asdf/nvm all static).

Invalid phase value → refuse with `[ae:setup] invalid phase '<value>'. Valid: early | build | scale | maintenance`.

#### `--suggest [--phase <enum>] [--why]`

Smart-recommend library agents based on current project profile.

**Algorithm**: see `docs/references/agent-selection-scorer.md` for signal definitions, weights, noise-floor rules, threshold, and `--why` output format. Briefly: 6-signal deterministic scorer (keyword_overlap / description_match / role_gap_bonus / category_match / library_source_boost / stack_mismatch), threshold 0.35, output cap 8, no-confident-match path suggests writing a custom agent.

Inputs used:
- Latest `.ae/analyses/*.md` by mtime (project profile)
- Latest active discussion's tags + topic titles + Key Questions
- `project_agents` + built-in agents roster (for role-gap detection)
- Detected project tech stack (per scorer spec stack-detection section)

Behavior:

1. **Prerequisites check**: require `agent_libraries:` configured. If absent → `[ae:setup] No library configured. Run /ae:setup agents --library <path> first.`
2. **Run scorer** per `docs/references/agent-selection-scorer.md`.
3. **Output**: ranked proposal (max 8, or fewer if threshold filters more, or "no confident match" with uncovered-roles list).
4. **Present for batch apply**: after ranked list, prompt:
   ```
   Apply all? [Y / select subset (e.g., 1,3,5) / n]:
   ```
   On `Y`: invoke `--add` for each via the batch flow (unified summary at end). On `select`: parse indices, invoke `--add` for the chosen subset. On `n`: exit with no changes.
5. **`--why` flag**: include per-agent signal breakdown (included AND suppressed agents) per the scorer spec's `--why` output template.
6. **`--phase <enum>` flag**: when provided, biases role-gap + category scoring toward phase-appropriate agents per the scorer spec. Absent → no phase bias.

**Never silently populates project_agents**. User action (Y / select / n) is required before any file is copied — proposal-only UX, per conclusion 040 T8.

#### `--refresh`

Advisory audit of current `project_agents` roster against the current project state.

**Algorithm**: see `docs/references/agent-selection-scorer.md` → "`--refresh` Advisory Behavior" section. Briefly: emits three lists (unused imports based on recent-team-run telemetry; new candidates scoring higher than current imports in the same role; stale mismatches from project stack evolution). Advisory only — never removes or adds anything automatically.

End output: `Run /ae:setup agents --suggest to review` suggestion.

#### `--why`

Not a standalone command — a flag for `--suggest`. See scorer spec's `--why Flag Output Template` section for format.

Reserved for future standalone use (`/ae:setup agents --why <library:name>` to show why a specific agent would or would not be included) — not in Phase 1 scope.

#### Cross-flag error semantics

- Flags that mutate pipeline.yml (`--library`, `--add`, `--remove`, `--sync`, `--detach`): require write access to project `.claude/pipeline.yml`. On ENOENT/EACCES → refuse with clear message.
- Flags that need `agent_libraries:` configured (`--list`, `--add`, `--suggest`, `--refresh`, `--sync`): if absent → prompt user to run `--library <path>` first; do not silently no-op.
- Batch operations (`--add a,b,c` or `--suggest` batch-apply Y) emit a summary at end listing successes + skipped agents with reasons.

### `update` argument: Update existing config

Read current `.claude/pipeline.yml`, compare with template:

1. Check for new fields in template (missing from config) — especially new `output` slots and `project_agents` section
2. Check for deprecated fields (e.g., old `output.review` → new `output.reviews`)
3. **Discover new project agents**: scan `.claude/agents/*.md` for agent files not present when pipeline.yml was last generated. Show newly discovered agents with inferred roles. This is net-new behavior — not all agents may have existed at initial setup.
4. Show diff, use AskUserQuestion to confirm
5. Preserve user-customized values, only add missing slots with defaults

## Output Defaults

When `pipeline.yml` is absent or a slot is missing, skills use these defaults:

| Slot | Default | Used by |
|------|---------|---------|
| `output.discussions` | `docs/discussions/` | ae:analyze, ae:discuss |
| `output.plans` | `docs/plans/` | ae:plan |
| `output.milestones` | `docs/milestones/` | ae:work |
| `output.backlog` | `docs/backlog/` | ae:work, ae:review, ae:code-review (new BL items land in `unscheduled/` subdir; `/ae:roadmap plan` promotes to `v<X>/`) |
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
