---
name: ae:setup
description: Initialize or update project pipeline config (.claude/pipeline.yml)
argument-hint: "[update]"
user-invocable: true
---

# /ae:setup — Pipeline Config Setup

Initialize or update the current project's `.claude/pipeline.yml`.

## Non-interactive mode

For Layer 2 automated test runs (and other non-interactive contexts), set the env var `AE_SETUP_NONINTERACTIVE=1` (exact string match). When set, `/ae:setup` skips all `AskUserQuestion` prompts in the base initialize/update flow and uses conservative defaults documented at each call site.

**Exact-match semantics** — only the literal string `1` enables non-interactive mode. All other values fall back to interactive mode (default behavior):

| `AE_SETUP_NONINTERACTIVE` value | Mode |
|---|---|
| `1` | Non-interactive (skip prompts, use defaults) |
| unset / missing | Interactive |
| empty string | Interactive |
| `0` | Interactive |
| `true` / `false` / anything else | Interactive |

**Scope**: base initialize/update flow only. The `/ae:setup agents` subcommand and the governance-event bootstrap (first-rule writes) are NOT guarded by this env var — their L2 testability is a separate concern (out of scope for BL-021).

**Conservative defaults per call-site** (when `AE_SETUP_NONINTERACTIVE=1`):

| Call site | Default used | Rationale |
|---|---|---|
| test.command configuration | `test.command: ""` (empty) | Fail-safe — ae:work's auto-pass gate treats empty as UNVERIFIED → will pause per step, never silently assume tests pass |
| init config confirmation | accept generated config as-is | The config was auto-detected from project files; non-interactive accepts that auto-detection verbatim |
| update diff confirmation | accept diff but skip adding `output.*` slots that match canonical `.ae/<slot>/` defaults; apply only genuinely missing non-output fields | Plan 050+ GTD-first behavior — canonical defaults are implicit (reader fallback), so re-adding them is noise. Existing user values are still preserved by the "preserve user-customized values" rule (Step 6). |
| Agent Teams enable | do NOT auto-enable; emit `[WARN]`-prefixed log and skip | Fail-safe — auto-enabling would modify `~/.claude/settings.json` without user consent, violating the MUST_NOT in `setup-agent-teams-check-settings.md` |

All skip events are emitted with a structured `[WARN]` or `[ae:setup]` prefix so Layer 2 test assertions can match them deterministically.

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
3. **Skip writing `output:` block on fresh init** (Plan 050+ GTD-first canonical). New projects rely on reader skills' default fallbacks (`.ae/<slot>/` per the Output Defaults table below). Only write a slot when Step 4's directory scan finds a non-default existing directory for that slot — see Step 4 below.
4. **Slot-by-slot directory scan** — gate for whether to write each `output.*` slot. For each of the 6 slots (`discussions`, `plans`, `milestones`, `backlog`, `reviews`, `analyses`):
   - Scan for legacy directory `docs/<slot>/` AND any other plausible non-default location (e.g., `results/<slot>/`, `<slot>/` at project root, etc.) that contains content (≥ 1 `.md` file).
   - **Found content in a non-default dir** → write `output.<slot>: "<detected-path>"` to `pipeline.yml`. Do NOT write the slot if only `.ae/<slot>/` (the canonical default) exists with content — defaults handle that case.
   - **No content anywhere** → skip writing this slot. Reader skills fall through to `.ae/<slot>/`.
   - **Precedence (when both `docs/<slot>/` AND `.ae/<slot>/` exist with content)**: `docs/<slot>/` wins — this is the migration signal that the project brings a legacy layout. Write `output.<slot>: "docs/<slot>/"`. Do NOT write `.ae/<slot>/` as a slot value (it's already the implicit default).
5. **Auto-discover project agents**: Scan `.claude/agents/*.md`, installed plugin agents, and `~/.claude/agents/*.md`. For each discovered agent, read `description` to infer role per [agent-contract.md](./agent-contract.md): reviewer (review/audit/security keywords), developer (implement/build keywords), or domain-expert (expert/specialist keywords). Show discovered agents with inferred roles to user for confirmation. Do NOT write agent lists to pipeline.yml — agents are discovered at runtime. The `project_agents:` section in pipeline.yml is for explicit role overrides only (agents outside `.claude/agents/` or when inference is wrong).
6. **Guide test.command configuration**: If auto-detect found no test command:
   - **Non-interactive mode** (`AE_SETUP_NONINTERACTIVE=1`): skip prompt, set `test.command: ""` (empty — ae:work auto-pass gate will treat as UNVERIFIED on every step)
   - **Interactive mode** (default): use AskUserQuestion to prompt user:
     ```
     No test command detected. ae:work's auto-pass gate treats empty test.command as UNVERIFIED,
     which pauses every step for confirmation. Options:
     1. Enter test command now (e.g., "npm test", "pytest", "cargo test")
     2. Skip — I'll configure later (auto-pass will pause each step)
     ```
7. Confirm generated config:
   - **Non-interactive mode**: skip AskUserQuestion, accept generated config as-is (proceed to step 8)
   - **Interactive mode**: use AskUserQuestion to confirm generated config
8. Write `.claude/pipeline.yml`

If `.claude/pipeline.yml` already exists: suggest `/ae:setup update`.

### `agents` argument: Library-to-project agent curation (BL-005)

`/ae:setup agents [subcommand]` curates third-party or hand-written agents into `.claude/agents/`. The flat `.claude/agents/` namespace is mandatory — CC resolves `subagent_type` by filename stem (see `./agent-contract.md`).

Phase 1 CLI surface (all subcommands below are implemented and documented in subsections further down):

```
/ae:setup agents --library <path> # declare library (multi-library supported)
/ae:setup agents --list [--category <cat>] # browse configured libraries
/ae:setup agents --add <name|library:name> [--reason <text>] # import with upstream tracking
/ae:setup agents --remove <name> # delete + cleanup (incl. governance rules)
/ae:setup agents --sync [--diff] # upstream drift detection
/ae:setup agents --detach <name> # break upstream link (keep file)
/ae:setup agents --suggest [--phase <enum>] [--why] # LLM-based recommendation
/ae:setup agents --refresh # advisory audit (unused / new / stale)
/ae:setup agents --rule-cleanup # governance stale-rule cleanup
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
3. **Library-path-missing tolerance**: if a library's `source:` path no longer exists → warn `[ae:setup] library '<name>' source path '<source>' does not exist on disk. Cross-machine fresh checkout? See README "Cross-machine setup". Skipping this library and continuing with remaining libraries.` and continue with remaining libraries (do not abort).
4. **Filter by `--category <cat>`** (optional): show only agents whose category matches. Case-insensitive match on directory name. If no agents match → print `No agents in category '<cat>'`.
5. **Output format**: pretty table with columns `library-qualified-id | category | role-hint | description`. `library-qualified-id` = `<library>:<filename-stem>`. Role hint is inferred per `./agent-contract.md` role-inference heuristic.

Example:
```
$ /ae:setup agents --list --category engineering
library-qualified-id category role description
agency-agents:engineering-code-reviewer engineering reviewer Expert code reviewer who provides constructive feedback...
agency-agents:engineering-software-architect engineering domain-expert System design, DDD, architectural patterns expert...
agency-agents:engineering-security-engineer engineering reviewer Security vulnerabilities, auth bypass, injection vectors...
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

#### `--add <name | library:name> [--reason "<text>"]`

Import a library agent into `.claude/agents/` with upstream tracking.

Optional `--reason "<text>"` captures the user's rationale for importing this agent. Used by the governance pattern-detection Trigger A (see "Governance file bootstrap" below) to propose a `prefer` rule grounded in the user's stated reason. When `--reason` is absent AND this is an interactive invocation (not batch), AE prompts: `Reason for importing <name>? (optional; press Enter to skip — no governance rule will be proposed)`. Batch invocations (from `--suggest --apply-all` etc.) do NOT prompt.

Behavior (ordered protocol):

1. **Resolve target**. Accept plain filename stem (e.g., `engineering-code-reviewer`) OR library-qualified form (`agency-agents:engineering-code-reviewer`). If plain form AND multiple libraries contain the same stem → refuse with `[ae:setup] name '<stem>' ambiguous — present in libraries: <A>, <B>. Use library-qualified form: <A>:<stem>`.
2. **Library-directory-missing guard**: run `test -d "<library.source>"` via Bash. If the library directory does not exist → refuse with `[ae:setup] library '<library-name>' source path '<source>' does not exist on disk. Cannot --add agent from missing library — --add modifies agent state, refusing prevents partial installs from an unavailable library. See README "Cross-machine setup".` Refuse the operation; do NOT proceed to step 3. This is dir-level missing — distinct from step 5's "cannot compute content hash" fallback which is agent-FILE-level (fires when the directory exists but the specific agent file fails to read or hash).
3. **Read library file**. Open `<library.source>/<category>/<name>.md` (or flat path if library has no categories).
4. **Parse YAML frontmatter**. If malformed → skip this agent with warning `[ae:setup] skip <name>: malformed YAML (line N)`. Do NOT abort. (Relevant in batch contexts — single `--add` refuses, `--suggest` batch-apply continues.)
5. **Compute source SHA**.
   - If library is a git repo: `git -C <library.source> hash-object <relative-file-path>` → record as `source_sha`.
   - Else: compute `sha256` of file content → record as `source_sha`.
   - If BOTH fail (e.g., file read error): skip this agent with warning `[ae:setup] skip <name>: cannot compute content hash`. Do NOT proceed with partial import.
6. **Ensure `.claude/agents/` exists**. Equivalent to `mkdir -p .claude/agents/`. Safe if already exists.
7. **Filename collision check**: if `.claude/agents/<name>.md` already exists → present options (see "Filename collision handling" below). Do NOT overwrite silently.
8. **Built-in spawn-identifier shadowing check**: if `<name>` matches an AE built-in agent filename stem (see "Built-in shadowing" below), warn and prompt before proceeding.
9. **Copy file as-is**. Write original library file bytes to `.claude/agents/<name>.md`. Do NOT modify `name:` field or any other frontmatter (conclusion 040 T1 — CC resolves by filename stem, `name:` is display-only).
10. **Append project_agents entry**:
   ```yaml
   project_agents:
     - name: <filename-stem>
       role: <inferred> # per ./agent-contract.md role-inference fallback
       source: "<library-name>:<category>/<filename>.md"
       source_sha: <sha>
       display_name: "<original name: field>"
       imported_at: <YYYY-MM-DD>
       modified: false
       # Optional fields populated if frontmatter provides them:
       tech_stack: <from library frontmatter or []>
       specialty: <from library frontmatter or "">
       priority: 50 # Phase 1 default
       required: false
   ```
11. **Summary output**: `[ae:setup] Imported <library>:<name> → .claude/agents/<name>.md (role: <role>, sha: <sha>)`.

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
   - Re-locate library file by `source:` field. If library path missing → warn `[ae:setup] <name>: library '<library-name>' source path missing on disk. Cross-machine fresh checkout? See README "Cross-machine setup". Cannot verify drift; skipping this agent.` and continue.
   - Compute current library-file SHA (git hash-object or sha256 per same protocol as `--add` step 5).
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

Phase-appropriate agents (hints passed to Claude's judgment — see `./agent-selection-rubric.md` for the rubric):

| Phase | Favored roles / specialties |
|-------|----------------------------|
| `early` | architect, minimal-change-engineer, rapid-prototyper |
| `build` | reviewer, security-engineer, technical-writer, developer |
| `scale` | performance-engineer, devops-automator, sre, incident-response |
| `maintenance` | bug-hunter, refactorer, deprecation-specialist |

**Phase 1 manual-only**: no auto-inference from roadmap/LOC/commit density. Conclusion 040 T7: auto-inference deferred to Phase 4 because no industry framework auto-adjusts toolset by phase (npm/cargo/asdf/nvm all static).

Invalid phase value → refuse with `[ae:setup] invalid phase '<value>'. Valid: early | build | scale | maintenance`.

#### `--suggest [--phase <enum>] [--why]`

LLM-based recommendation: Claude reads project context + library agents, proposes a curated subset to import into `.claude/agents/`.

See `./agent-selection-rubric.md` for the scoring rubric (signals-as-hints, not math) and the `--why` output template.

Inputs (read directly, no tokenization preprocessing):
- Project `CLAUDE.md` (tech stack, architecture, current focus)
- Latest `.ae/analyses/*.md` by mtime — if present
- Latest active discussion's `index.md` — if present
- `project_agents` + built-in AE agents roster (for role-coverage awareness)
- Each library agent's `name` + `description` + category path (read body first ~20 lines only if description is thin)
- Active `force` / `prefer` rules from `.claude/agent-governance.md` (if any)

Behavior:

1. **Prerequisites check**: require `agent_libraries:` configured. If absent → `[ae:setup] No library configured. Run /ae:setup agents --library <path> first.`
2. **Source-path mechanical validation** (BL-059, v0.9.5): for each `agent_libraries[]` entry, run `test -d "<resolved-source-path>"` via Bash. Path resolution: `source: "../foo"` resolves relative to project root (per `--library` write-time rule, see this SKILL.md `--library` Behavior); absolute paths used as-is.
   - **Missing path** → emit `[ae:setup] library '<name>' source path '<source>' does not exist on disk. Skipping this library from the candidate pool.` Continue with remaining libraries.
   - **All libraries missing** → emit `[ae:setup] All configured agent_libraries[] sources are missing on disk. Cannot proceed with --suggest. Either restore the source directories or update agent_libraries[] in pipeline.yml.` and **exit before invoking Claude**.
   - This is a mechanical pre-check, not LLM-judged. Closes the falsification gap F-003 closure shipped with (BL-059): a stubbed `source: "/nonexistent"` now fails loudly here, never reaching the rubric where hallucinated agent names could surface.
3. **Governance hard rules applied first** (mechanical, not LLM): `action: force` → agent pre-selected; `action: exclude` → agent removed from candidate pool.
4. **Claude reviews remaining candidates** against project context per `./agent-selection-rubric.md`. Targets 3-8 recommendations — prefers fewer-but-confident over padding the list.
5. **Output**: ranked proposal with one-line rationale each. If nothing fits → `No library agents fit this project well. Consider writing a custom agent in .claude/agents/ or browsing --list manually.`
6. **Present for batch apply**:
   ```
   Apply all? [Y / select subset (e.g., 1,3,5) / n]:
   ```
   On `Y`: invoke `--add` for each via batch flow. On `select`: parse indices, invoke `--add` for subset. On `n`: exit with no changes.
7. **`--why` flag**: Claude's per-agent rationale is more detailed (2-3 sentences each, cites project evidence).
8. **`--phase <enum>` flag**: passed to Claude as context hint ("this is an `early`-phase project — bias toward setup/scaffolding agents"). No mechanical weight adjustments.

**Never silently populates project_agents**. User action (Y / select / n) is required before any file is copied — proposal-only UX.

**Why LLM, not mechanical scoring**: semantic matching between ~200-token agent descriptions and project context is exactly what LLMs do well. Mechanical Jaccard/keyword-overlap scoring requires per-project tuning of weights/thresholds/stopwords that never converges (see BL-005 Phase 2 pivot note in `./agent-selection-rubric.md`).

#### `--refresh`

Advisory audit of current `project_agents` roster against the current project state.

**Algorithm**: see `./agent-selection-rubric.md` → "`--refresh` Advisory Behavior" section. Briefly: emits three advisory lists (unused imports; new candidates that would now fit better; stale mismatches from project stack evolution). Advisory only — never removes or adds anything automatically.

End output: `Run /ae:setup agents --suggest to review` suggestion.

#### `--why`

Not a standalone command — a flag for `--suggest`. See `./agent-selection-rubric.md` → `--why Output Template` section for format.

Reserved for future standalone use (`/ae:setup agents --why <library:name>` to show why a specific agent would or would not be included) — not in Phase 1 scope.

#### Governance file bootstrap

AE writes agent-selection governance rules to `.claude/agent-governance.md` (see [agent-governance-format.md](./agent-governance-format.md) for the YAML schema). AE **never edits CLAUDE.md body** — the only line AE writes to CLAUDE.md is an `@include` reference, and only once after user confirmation.

##### First-governance-event flow

Triggered when AE is about to write the first rule to `.claude/agent-governance.md` (via `--add` with user-supplied rationale, or via automatic pattern detection — see below).

1. **Detect existing @include**: check the project root `CLAUDE.md` for any line containing `@.claude/agent-governance.md` or `@agent-governance.md` (case-sensitive; tolerant of surrounding whitespace).
2. **If already present**: skip bootstrap. AE writes to `.claude/agent-governance.md` and the user's existing include line surfaces the rules in their CC context.
3. **If absent**: use `AskUserQuestion` once:
   ```
   AE is about to write its first governance rule for this project. Governance rules
   live in `.claude/agent-governance.md` — a separate file AE owns entirely.
   
   To make these rules visible in your CC context, add `@.claude/agent-governance.md`
   to CLAUDE.md now? (AE will append a single line to the bottom of CLAUDE.md.
   This is the only line AE ever writes to CLAUDE.md.)
   
   Options:
   1. Yes — append the @include line now
   2. No — write to agent-governance.md anyway; I'll add the include line manually later
   3. Later — defer the decision; ask again next time
   ```
4. **On Y**: append `\n@.claude/agent-governance.md\n` to the END of CLAUDE.md (preserve trailing newlines). Do NOT insert into existing sections or reorder content.
5. **On n**: proceed to write `.claude/agent-governance.md` anyway. Emit warning: `[ae:governance] Governance rules written to .claude/agent-governance.md but @include not added to CLAUDE.md. Rules will not surface in your CC context until you add '@.claude/agent-governance.md' to CLAUDE.md manually.` — warning is persistent (shown every governance-file write until include is added).
6. **On later**: defer the ask; repeat at next governance event. No write to either file this turn (the rule proposal is abandoned — user sees "governance rule proposal cancelled").

##### Migration from hand-written `## Agent Governance` section

If AE detects an existing `## Agent Governance` section in CLAUDE.md (heading match, case-insensitive) on the first-governance-event:

1. Read the section body. Attempt to interpret common patterns:
   - Lines like `always use <agent> for <context>` → candidate `force` rule
   - Lines like `prefer <agent> for <context>` → candidate `prefer` rule
   - Tables with agent/context columns → parse per row
2. Present parsed rules via `AskUserQuestion`:
   ```
   Detected existing `## Agent Governance` section in CLAUDE.md with N rules:
   
   1. force rust-mcp-expert for [mcp, auth]
   2. prefer security-engineer for [vulnerability, security]
   
   Migrate to `.claude/agent-governance.md` and replace the section with @include? [Y/n]
   ```
3. **On Y**: write parsed rules to `.claude/agent-governance.md`. Delete the `## Agent Governance` section from CLAUDE.md (section only, including its heading; do not touch surrounding content). Append `@.claude/agent-governance.md` at the section's former location (preserves read order).
4. **On n**: leave CLAUDE.md untouched; emit warning that AE-managed governance and hand-written governance will coexist (AE reads only `.claude/agent-governance.md`).

If AE cannot parse any rules from the section (freeform prose with no recognizable pattern) → do NOT migrate automatically; warn once:
```
[ae:governance] CLAUDE.md has a hand-written ## Agent Governance section that AE cannot parse.
Your governance will coexist with AE's rules in .claude/agent-governance.md.
Consider manually migrating by running `/ae:setup agents --rule-add <agent> ...`.
```

##### Pattern-detection triggers

AE proposes new governance rules at specific trigger points. Phase 1 implements one trigger (A). Automatic-pattern detection (B) is deferred to Phase 3 pending AE-owned telemetry infrastructure.

**Trigger A: `--add` with user-supplied rationale**

When `/ae:setup agents --add <name>` is invoked with an explicit rationale string (passed via `--reason "<text>"` flag or interactively prompted for during import):

1. Extract top 3-5 content-bearing terms from the rationale (Claude's judgment; no mechanical tokenization required).
2. Extract top 3-5 tokens by relevance (non-stopwords, with at least one that appears in the agent's description).
3. Propose a `prefer` rule:
   ```
   [ae:governance] Propose rule: prefer engineering-security-engineer for contexts [security, mcp, auth]?
     Derived from import rationale: "MCP server security profile"
     Action: prefer Scope: all Confidence: medium
   
   Options:
   1. Accept — add rule to .claude/agent-governance.md
   2. Modify — change action/context/scope before adding
   3. Skip — import without creating governance rule
   ```

**Automatic pattern detection (3-consecutive-spawn) — deferred to Phase 3**

Automatic auto-propose based on "`/ae:discuss` or `/ae:review` spawning same project agent 3+ consecutive times" is deferred to Phase 3. Discussion 041 topic-03 verified that the current detection sources (`~/.claude/teams/*/config.json` + `.ae/milestones/*/step-summaries.md`) are structurally incapable of providing the required skill-invocation context + ordered timestamps — team configs have no skill-invocation context and no history after TeamDelete; step-summaries are free-form prose with zero structured spawn logs.

If user workflow reveals a real 3-consecutive-spawn pattern, open a Phase 3 discussion for AE-owned telemetry design (e.g., `.ae/telemetry/spawns.jsonl` with structured `{ts, skill, agent, session_id}` schema written by `/ae:discuss`, `/ae:review`, `/ae:work`, `/ae:team` at TeamCreate time). Until then, Trigger A covers explicit governance bootstrap cleanly and without new infrastructure.

**`/ae:next` periodic audit** — NOT implemented in Phase 1 or Phase 2. Tracked as Phase 3+ alongside telemetry-based auto-detection.

##### `--rule-cleanup`

Scan `.claude/agent-governance.md` for rules referencing agents no longer in `project_agents[]` or `.claude/agents/`. Present each stale rule for user confirmation:

```
[ae:governance] Stale rule detected:
  Rule: force rust-mcp-expert for [mcp, tool-auth] (scope: discuss)
  Issue: Agent 'rust-mcp-expert' not found in project_agents or .claude/agents/
  Added: 2026-04-18 (reason: "pattern detection: 3 consecutive discussions")
  
  Options:
  1. Delete — remove this rule from .claude/agent-governance.md
  2. Keep — retain rule (perhaps agent will be re-imported)
  3. Skip — decide later
```

Batch summary at end: `N stale rules found, M deleted, K kept, L skipped`.

Automatic invocation: `/ae:setup agents --remove <name>` (Step 2 spec) calls this flow scoped to the removed agent only — offers to clean any rules referencing just that agent.

##### Integration read-through (Step 6 protocol)

After writing the governance-bootstrap subsection, read the full `plugins/ae/skills/setup/SKILL.md` top-to-bottom and verify cross-references are coherent:

- `--add` Behavior section preamble + Step 1 flow capture `--reason "<text>"` flag (post F-005 step renumbering — was Step 3 pre-F-005; now lives in the Behavior section's prose paragraph above the numbered steps + Step 1's extended description) → captured here for pattern-detection Trigger A
- `--remove` Step 2 spec references governance rule cleanup → implemented here via `--rule-cleanup` scoped invocation
- `--suggest` Step 4 batch-apply never writes governance rules (proposal-only; user triggers rule writes separately)
- No flag conflicts (e.g., `--phase` is scoped to `--suggest`, not a global flag)

Inconsistencies found → fix within this step before committing. This is a one-time audit to seal the multi-step setup/SKILL.md edits into a coherent document.

#### Cross-flag error semantics

- Flags that mutate pipeline.yml (`--library`, `--add`, `--remove`, `--sync`, `--detach`): require write access to project `.claude/pipeline.yml`. On ENOENT/EACCES → refuse with clear message.
- Flags that need `agent_libraries:` configured (`--list`, `--add`, `--suggest`, `--refresh`, `--sync`): if absent → prompt user to run `--library <path>` first; do not silently no-op.
- Batch operations (`--add a,b,c` or `--suggest` batch-apply Y) emit a summary at end listing successes + skipped agents with reasons.

### `update` argument: Update existing config

Read current `.claude/pipeline.yml`, compare with template:

1. Check for new fields in template (missing from config) — especially new `project_agents` section
2. Check for deprecated fields (e.g., old `output.review` → new `output.reviews`)
3. **Discover new project agents**: scan `.claude/agents/*.md` for agent files not present when pipeline.yml was last generated. Show newly discovered agents with inferred roles. This is net-new behavior — not all agents may have existed at initial setup.
4. **Default-output-slot cleanup** (Plan 050+ GTD-first canonical): if existing `pipeline.yml` has `output.*` slots that all match the new canonical defaults (`.ae/<slot>/`), offer to remove them since they're now implicit. **Heuristic caveat**: this signal cannot distinguish "AE-generated boilerplate" from "user wrote canonical values explicitly for documentation/clarity" — both look identical. Phrase the prompt as a question, not a recommendation:
   - **Interactive mode**: use AskUserQuestion: "Existing pipeline.yml has 6 `output.*` slots all matching canonical `.ae/<slot>/` defaults. Remove the (now-redundant) block? Note: if you wrote these values intentionally for explicitness, keep them — runtime semantics are identical either way; only difference is file noise."
   - **Non-interactive mode** (`AE_SETUP_NONINTERACTIVE=1`): preserve as-is (no automatic cleanup — user's explicit values are kept; the heuristic-ambiguity above is exactly why non-interactive defaults to preserve).
5. Show diff, then confirm:
   - **Non-interactive mode**: skip AskUserQuestion, accept diff
   - **Interactive mode**: use AskUserQuestion to confirm
6. Preserve user-customized values; do NOT add `output.*` slots that match canonical defaults (rely on reader fallback instead).

## Output Defaults

When `pipeline.yml` is absent or a slot is missing, skills use these defaults:

| Slot | Default | Used by |
|------|---------|---------|
| `output.discussions` | `.ae/discussions/` | ae:analyze, ae:discuss |
| `output.plans` | `.ae/plans/` | ae:plan |
| `output.milestones` | `.ae/milestones/` | ae:work |
| `output.backlog` | `.ae/backlog/` | ae:work, ae:review, ae:code-review (new BL items land in `unscheduled/` subdir; `/ae:roadmap plan` promotes to `v<X>/`) |
| `output.reviews` | `.ae/reviews/` | ae:review |
| `output.analyses` | `.ae/analyses/` | ae:think |
| `test_plugin.judge` | `codex` | ae:test-plugin |

Defaults are GTD-first canonical. External projects with `docs/*` legacy layouts override via `output.*` slots — `/ae:setup` auto-detects existing `docs/<slot>/` directories with content and writes only those slots, leaving the rest to fall through to these defaults.

Skills MUST read from `pipeline.yml → output.<slot>` first. If the key is missing or pipeline.yml doesn't exist, fall back to the default above. This ensures zero-config works for new projects.

## Test & Lint Fallback

`test.command` and `lint.command` may be empty. Skills that use them (ae:work, ae:code-review) MUST handle empty values gracefully:

- **Has value** → run the command
- **Empty** → skip, show `"⚠️ No test/lint command configured, skipping"`

Empty does NOT block execution. Not all projects have tests, not all changes need testing.

## Agent Teams Setup

Check if Agent Teams is enabled (required for multi-agent workflows). See [`docs/agent-teams-policy.md`](../../../../docs/agent-teams-policy.md) for why each skill behaves differently when the env var is unset.

1. Read `~/.claude/settings.json` — look for `"CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS"` in the `env` object
2. If **not enabled**:
   - **Non-interactive mode** (`AE_SETUP_NONINTERACTIVE=1`): skip AskUserQuestion, do NOT auto-enable. Warn: `[ae:setup] Agent Teams not enabled and non-interactive mode is on — skipping prompt. Most ae commands will refuse to execute until AE_SETUP_NONINTERACTIVE is unset and Agent Teams is enabled.`
   - **Interactive mode**: use AskUserQuestion: "Agent Teams is not enabled. Most ae commands require it. Enable it now? (This will update ~/.claude/settings.json)"
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
