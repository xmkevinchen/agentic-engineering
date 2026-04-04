# Claude Code Plugin API Reference

Stable API reference for AE plugin development. Covers frontmatter fields, feature flags, security boundaries, and platform capabilities available to plugins.

Source: Claude Code source analysis (Discussion 021, 2026-04-04).

---

## SKILL.md Frontmatter Fields

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `name` | string | — | Skill name. AE convention: `ae:` prefix for autocomplete |
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
| `skills` | string[] | — | Skills preloaded into agent context |
| `model` | string | inherit | Model override |
| `effort` | string/int | default | Reasoning effort |
| `maxTurns` | int | unlimited | Maximum execution turns. Prevents runaway agents |
| `background` | boolean | false | Default to background execution |
| `isolation` | string | — | `worktree` (git worktree) or `remote` |
| `initialPrompt` | string | — | Prefix injected into first user turn (slash commands work) |
| `memory` | string | — | Persistent memory scope: `user`, `project`, or `local` |
| `color` | string | — | Display color in team UI |
| `omitClaudeMd` | boolean | false | Skip loading CLAUDE.md into agent context (~1000 tokens saved) |

### Fields Silently Ignored for Plugin Agents (Security Boundary)

Plugin agents **cannot** set:
- `permissionMode` — only built-in and project agents
- `hooks` — per-agent hooks restricted to built-in/project
- `mcpServers` — inline MCP server declarations restricted

These fields are stripped without error during plugin agent loading.

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

User sets values at plugin install time. Values become environment variables:
- Config key `cross_family_primary` → `CLAUDE_PLUGIN_OPTION_CROSS_FAMILY_PRIMARY`
- Accessible by hooks, MCP servers, and agent prompts at runtime

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

Example: AE's Codex MCP server → `mcp__plugin_ae_codex__codex`

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
| `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS` | Enable Agent Teams | **Required** for 10/17 AE skills |
| `CLAUDE_CODE_MAX_OUTPUT_TOKENS` | Per-API-call max tokens | High |
| `CLAUDE_CODE_SUBAGENT_MODEL` | Global subagent model override | Medium (prefer per-agent `model`) |
| `CLAUDE_CODE_DISABLE_AUTO_MEMORY` | Disable auto memory writes | High (worktree isolation) |
| `CLAUDE_CODE_DISABLE_CLAUDE_MDS` | Skip CLAUDE.md loading | Medium (worktree isolation) |
| `CLAUDE_CODE_MAX_TOOL_USE_CONCURRENCY` | Concurrent tool limit (default: 10) | Medium |
| `CLAUDE_AUTOCOMPACT_PCT_OVERRIDE` | Autocompact trigger percentage | Medium |

### GrowthBook Gates (Not User-Controllable)

| Gate | Default | Impact on AE |
|------|---------|--------------|
| `tengu_amber_flint` | true | Agent Teams kill-switch — if disabled, 10/17 AE skills fail |
| `tengu_slim_subagent_claudemd` | true | Subagents receive slimmed CLAUDE.md — AE rules may be trimmed |

## Team System

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

## Teammate-Only Tools

These tools are exclusively available to agents spawned as teammates (via TeamCreate):
`TaskCreate`, `TaskGet`, `TaskList`, `TaskUpdate`, `SendMessage`

Regular background agents cannot use these.
