# Claude Code Plugin API Reference

Host API reference for AE plugin development: frontmatter fields, feature flags, security
boundaries, and platform capabilities available to plugins.

> **Two things to hold while reading.** First, **this describes the host, not AE.** A
> capability documented here is one Claude Code offers — not one AE uses. The sections on the
> team system and on teammate-only tools are the clearest case: AE creates no teams and calls
> none of those tools, so they are background on the platform, never a description of this
> plugin's surface. What AE actually depends on is
> [`cc-plugin-contract.md`](cc-plugin-contract.md).
>
> Second, **the host drifts.** Rows carry their own measurement dates where one was taken;
> anything undated comes from a 2026-04-04 source reading and should be re-verified before it
> is made load-bearing.

---

## SKILL.md Frontmatter Fields

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `name` | string | dir name | Bare skill segment, matching its directory. The host prepends the plugin namespace — a `ae:`-prefixed value doubles it (CC 2.1.216) |
| `description` | string | — | Short description shown in autocomplete and system reminders |
| `when_to_use` | string | — | Guidance for when the model should invoke this skill |
| `allowed-tools` | string[] | all | Tool whitelist for the skill execution context |
| `user-invocable` | boolean | true | Whether skill appears in `/` autocomplete. **Must use hyphen, not underscore** |
| `model` | string | inherit | Model override. Values: `sonnet`, `haiku`, `opus`, `inherit` |
| `effort` | string/int | default | Reasoning effort: `low`, `medium`, `high`, `max`, or integer |
| `context` | string | `inline` | `inline` (main context) or `fork` (independent context window with own token budget) |
| `agent` | string | — | Agent type to use when `context: fork` |
| `hooks` | object | — | Skill-level hooks, active only during skill execution |
| `paths` | string[] | — | Gitignore-style path patterns to scope the skill |
| `hide-from-slash-command-tool` | boolean | false | Hide from autocomplete but keep callable via `Skill()` tool |
| `${CLAUDE_SKILL_DIR}` | — | — | Runtime variable: resolves to skill directory path |
| `${CLAUDE_SESSION_ID}` | — | — | Runtime variable: resolves to session ID |

## Agent Frontmatter Fields

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `name` | string | — | Agent type name (required) |
| `description` | string | — | Description shown in agent selection (required) |
| `tools` | string[] | — | Tool whitelist. Supports `*` wildcard |
| `disallowedTools` | string[] | — | Tool denylist (applied after whitelist) |
| `skills` | string[] | — | Documented as preloading the **full skill content**, not only the description. **Measured on a plugin agent: it did not.** A spawn with `skills: [ae:discuss]` reported only the one-line description every skill gets anyway. Likely stripped for plugin agents like the fields below; untested for project/user agents. Do not rely on it here |
| `model` | string | inherit | Model override |
| `effort` | string | inherit | Effort while this subagent is active; overrides the session level. `low`, `medium`, `high`, `xhigh`, `max` — availability depends on the model. Not rendered into the agent's own context, so an agent cannot report what it was given |
| `maxTurns` | int | unlimited | Maximum execution turns. Prevents runaway agents |
| `background` | boolean | false | Default to background execution |
| `isolation` | string | — | `worktree` (git worktree) or `remote` |
| `initialPrompt` | string | — | Prefix injected into first user turn (slash commands work) |
| `memory` | string | — | Persistent memory scope: `user`, `project`, or `local` |
| `color` | string | — | Display color in team UI |

### There is no per-agent way to keep CLAUDE.md out

An agent definition cannot decline the instruction files. A subagent receives every level of the
CLAUDE.md hierarchy the main conversation loads — `~/.claude/CLAUDE.md`, project rules,
`CLAUDE.local.md`, managed policy — and **only the built-in `Explore` and `Plan` agents skip it**.
The same is true of the parent session's git snapshot, which `Explore` and `Plan` also skip and
which `includeGitInstructions: false` disables session-wide.

The only exclusion mechanism is `claudeMdExcludes` in settings, which filters by path for the whole
session rather than per agent.

**`vibe` is not a field at all.** It is a convention of an external agent collection that
arrived with a vendored definition, was classified as tolerated on import, and was then copied
onto thirteen definitions as if it were a pattern. Measured 2026-08-31 by spawning a seat and
asking it to report its own context verbatim: **no line beginning `vibe:` appears anywhere in
it.** Deleted from every definition.
`emoji`, from the same collection, went with it.

**`omitClaudeMd` is not effective for plugin agents, and is not in the published field list.**
It was listed in this table and was once set in seven agent definitions here; all seven were
cleaned up, and a suite check now asserts that no definition sets it. What is established: the
key exists in the Claude Code binary, so the code knows the name; it appears in no published list
of supported frontmatter fields; and a plugin agent that sets it still received the whole CLAUDE.md
hierarchy, verified by spawning one and asking what it had been given.

What is **not** established: whether it works for project or user agents. This repository's agents
are all plugin agents, and plugin agents already have fields stripped silently — see the section
below. That is the likeliest explanation and it is untested. Removed from the table above because
setting it here does nothing; do not re-add it without a spawn that demonstrates an effect.

Source: `https://code.claude.com/docs/en/sub-agents.md`, "What loads at startup" and the
frontmatter table; `https://code.claude.com/docs/en/memory.md` for `claudeMdExcludes`.

### Fields Silently Ignored for Plugin Agents (Security Boundary)

Plugin agents **cannot** set:
- `permissionMode` — only built-in and project agents
- `hooks` — per-agent hooks restricted to built-in/project
- `mcpServers` — inline MCP server declarations restricted
- `skills` — **measured, not documented**: a plugin agent setting `skills` received only the
  one-line description every skill gets regardless. Whether it is stripped here specifically, or
  simply does not do what its description says, was not separable by that probe

These fields are stripped without error during plugin agent loading. **That silence is the hazard**
— a field that does nothing looks identical to a field that works, which is how `omitClaudeMd`
survived in seven definitions and in this table. Measure a field on a spawn before trusting it.

## plugin.json Fields

| Field | Type | Description |
|-------|------|-------------|
| `name` | string | Plugin identifier |
| `version` | string | Semver version |
| `description` | string | Plugin description |
| `commands` | object[] | CLI commands |
| `skills` | object[] | Skill declarations |
| `agents` | object[] | Agent declarations |
| `mcpServers` | object[] | MCP server configurations |
| `hooks` | object | Plugin-level hooks |
| `lspServers` | object[] | LSP server configurations |
| `userConfig` | object | User-configurable options (→ `CLAUDE_PLUGIN_OPTION_<KEY>` env vars) |
| `channels` | object[] | Communication channels |
| `outputStyles` | object[] | Custom output styles (selectable via `/output-style`) |
| `dependencies` | string[] | Other plugins this depends on |

### userConfig Mechanism

User sets values at plugin install time. Values are *documented* to become environment
variables:
- Config key `gemini_flash_model` → `CLAUDE_PLUGIN_OPTION_GEMINI_FLASH_MODEL`
- Documented as accessible to hooks, MCP servers, and agent prompts at runtime

**Measured 2026-08-16, and it does not hold for a default.** An option the user never
configured exports nothing, even though `plugin.json` declares a default for it; both
bundled servers therefore read the option in-process with their own fallback. Whether a
*configured* option materialises is untested. Do not build on the declared default, and
never reference a `${CLAUDE_PLUGIN_OPTION_*}` from a manifest `env` block — those are
validated at install time and an unresolved one rejects the whole server. See
[`cc-plugin-contract.md`](cc-plugin-contract.md) dependency #4.

## Hook System

### Hook Events (27 total)

| Category | Events |
|----------|--------|
| Tool lifecycle | `PreToolUse`, `PostToolUse`, `PostToolUseFailure` |
| Session | `SessionStart`, `SessionEnd`, `Stop`, `StopFailure` |
| Agent | `SubagentStart`, `SubagentStop` |
| Team | `TeammateIdle`, `TaskCreated`, `TaskCompleted` |
| Context | `PreCompact`, `PostCompact`, `InstructionsLoaded`, `CwdChanged`, `FileChanged` |
| Permission | `PermissionRequest`, `PermissionDenied` |
| User | `UserPromptSubmit`, `Notification`, `Elicitation`, `ElicitationResult` |
| Config | `ConfigChange` |
| Worktree | `WorktreeCreate`, `WorktreeRemove` |
| Setup | `Setup` |

### Hook Types

| Type | Description | Plugin-available |
|------|-------------|-----------------|
| `command` | Shell command, exit code controls flow | Yes |
| `prompt` | LLM evaluation (no tool access, low cost) | Yes |
| `agent` | Agentic verifier with tools | **No** (built-in/project only) |
| `http` | POST webhook to URL | Yes |

### Hook Capabilities

- `if` — Permission-rule-syntax filter (e.g., `"Bash(git *)"`)
- `asyncRewake` — Exit code 2 wakes model asynchronously
- `once` — One-time execution, auto-removed after
- `updatedInput` — PreToolUse hooks can modify tool input
- `additionalContext` — PostToolUse hooks can inject system context
- `updatedMCPToolOutput` — PostToolUse hooks can modify MCP tool output

## MCP Integration

### Tool Naming Convention

Format: `mcp__<normalizedServerName>__<normalizedToolName>`

Example: AE's Gemini MCP server → `mcp__plugin_ae_gemini__chat`

### Tool Metadata

- `_meta['anthropic/alwaysLoad']` = `true` — Tool is never deferred, always available in context
- `searchHint` — Keywords to improve ToolSearch discovery (weight: 4)

### Transport Types

stdio, sse, http, ws, sdk, sse-ide, ws-ide, claudeai-proxy. Plugin MCP servers typically use stdio.

## Agent Override Priority

Lower overrides higher (ascending priority):

1. **built-in** — CC's default agents
2. **plugin** — Plugin-declared agents (AE lives here)
3. **userSettings** — User's `~/.claude/agents/`
4. **projectSettings** — Project's `.claude/agents/`
5. **flagSettings** — Feature-flag-controlled
6. **policySettings** — Organization policy

Same-name `agentType` at higher priority fully replaces the lower. Projects can override any AE agent by placing a same-named `.md` in `.claude/agents/`.

## Feature Flags & Environment Variables

### User-Controllable (env var / settings.json)

| Variable | Description | AE Relevance |
|----------|-------------|--------------|
| `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS` | Enable Agent Teams | **None.** AE creates no teams: the stage skills spawn ordinary subagents and synthesize in the session. It was once required by ten skills, all since removed |
| `CLAUDE_CODE_MAX_OUTPUT_TOKENS` | Per-API-call max tokens | High |
| `CLAUDE_CODE_SUBAGENT_MODEL` | Global subagent model override | Medium (prefer per-agent `model`) |
| `CLAUDE_CODE_DISABLE_AUTO_MEMORY` | Disable auto memory writes | High (worktree isolation) |
| `CLAUDE_CODE_DISABLE_CLAUDE_MDS` | Skip CLAUDE.md loading | Medium (worktree isolation) |
| `CLAUDE_CODE_MAX_TOOL_USE_CONCURRENCY` | Concurrent tool limit (default: 10) | Medium |
| `CLAUDE_AUTOCOMPACT_PCT_OVERRIDE` | Autocompact trigger percentage | Medium |

### GrowthBook Gates (Not User-Controllable)

| Gate | Default | Impact on AE |
|------|---------|--------------|
| `tengu_amber_flint` | true | Agent Teams kill-switch — no longer reaches AE, which creates no teams |
| `tengu_slim_subagent_claudemd` | true | Subagents receive slimmed CLAUDE.md — AE rules may be trimmed |

## Team System *(host capability — AE creates no teams and uses none of this)*

- Team config: `~/.claude/teams/{team_name}/config.json`
- Mailbox: `~/.claude/teams/{team_name}/inboxes/{agent_name}.json` (file-backed + lockfile)
- `TeamDelete` blocks if any member has `isActive !== false`
- `SendMessage` to stopped agent triggers auto-resume from transcript
- `to: "*"` broadcasts to all teammates (text messages only)
- `teamAllowedPaths` — shared paths writable by all team members

## Post-Compact Reinjection Budget

| Content | Budget | Per-item limit |
|---------|--------|----------------|
| Files | 50K tokens | 5K tokens/file, max 5 files |
| Skills | 25K tokens | 5K tokens/skill |

Skills exceeding 5K tokens are truncated after compaction. Critical instructions should be in the first 5K.

## Tool Result Limits

| Scope | Limit |
|-------|-------|
| Single tool result | 50K chars |
| All tool results per message | 200K chars |

Exceeding → content persisted to disk, model sees first 2000 bytes as preview.

## Teammate-Only Tools *(host capability — AE spawns no teammates)*

These tools are exclusively available to agents spawned as teammates (via TeamCreate):
`TaskCreate`, `TaskGet`, `TaskList`, `TaskUpdate`, `SendMessage`

Regular background agents cannot use these.
