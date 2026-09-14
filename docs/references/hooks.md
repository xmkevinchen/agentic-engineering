# Hooks — measured enforcement and official semantics

> **Status: current.** The one place hook knowledge lives. Two layers, in
> order of trust: what we **measured** (`empirical`), and what the vendors
> **document** (`documented` — verify before making one load-bearing).
> Sources: code.claude.com/docs/en/hooks · learn.chatgpt.com/docs/hooks ·
> the probe scripts and evidence under `.ae/research/2026-08-28-plugin-boundaries/`
> (process artifact, commands re-runnable).

## Hook enforcement semantics

Dependencies #2 and #3 in [`cc-plugin-contract.md`](cc-plugin-contract.md)
establish that plugin-level hooks *register and fire*. This section is the
separate question of **how much a firing hook can refuse**.

**Measured 2026-08-28 against CC 2.1.247**, non-interactive mode, foreground
subagents, plugin-level command hooks. Each row is one isolated scenario checked
against what actually happened — whether the file was written, what the task read
back, what the next model request received — not against a model's report of
success.

| Mechanism | Enforcement | What was observed |
|---|---|---|
| `PreToolUse` exit 2 | **refuses** | The tool call did not run; the file was not created |
| `PreToolUse` exit 1 | **fail-open** | Same hook, error exit: the file was created anyway |
| `PreToolUse` timeout | **fail-open** | Hook slept 10 s against a 1 s configured timeout; `PostToolUse` was reached ≈ 1,032 ms in and the file existed |
| `PreToolUse`, internal error caught and converted to exit 2 | **refuses** | Catchable errors are recoverable this way — it does not establish safety against a killed process or an outer timeout |
| `PostToolUse` `decision: block` | **feedback only** | The reason reached the next model request; the file remained. A follow-on step then proceeded and created a second file |
| `TaskCompleted` exit 2 | **refuses** | `TaskUpdate` returned `success: false` and `TaskGet` read back `pending`; the control scenario read back `completed` |
| `SubagentStop` exit 2 | **retries the same worker** | One agent ID, two `SubagentStop` firings; the calling session received only the second result |
| `SubagentStop` structural check | **usable** | A first plain-text deliverable was refused programmatically; a second conforming to the required shape was captured before the calling session saw it |

### Classification and re-verification

`empirical` — the same class as #5 and #6, and for the same reason: this is
observed host behavior at one version, not a contractual commitment. The
`PreToolUse` timeout and `PostToolUse` semantics agree with the published hooks
reference, which states that a plugin command hook's timeout does not produce a
refusal and that a `PostToolUse` block appends a reason for the model. Do not
transfer Agent SDK callback timeout behavior, which the same documentation
defines separately, onto plugin command hooks.

**Re-verify on each CC major version bump.**

**Not covered.** Interactive mode, background subagents, Agent Teams, compaction
and resume, cross-session recovery, concurrent writers, and interaction between
multiple plugins' hooks. None of these was exercised; no claim is made about them.

## Hook design surface — official semantics, cross-checked (2026-08-28)

The enforcement table above records what we **measured**. This section records
what the official hooks reference **documents** (fetched 2026-08-28,
code.claude.com/docs/en/hooks), cross-checked against those measurements, plus
capabilities the measurements did not cover.
Classification: `empirical` = probed here; `documented` = official semantics not
yet probed — verify before making one load-bearing.

### Cross-check: every measurement matches the documented contract

| Measured (above) | Official semantics | Verdict |
|---|---|---|
| `PreToolUse` exit 2 refuses | "Always blocks on events that support blocking" | match |
| `PreToolUse` exit 1 fail-open | "Other exit codes: non-blocking error (action proceeds)" | match |
| `PreToolUse` timeout fail-open | "canceled, output discarded… doesn't block; call proceeds through normal permission flow" | match |
| `PostToolUse` feedback-only | "Can block: No (tool already ran)"; exit 2 merely "shows stderr to Claude" | match |
| `TaskCompleted` exit 2 refuses | "rolls back/prevents task state change" | match |
| `SubagentStop` exit 2 retries same worker | "prevents subagent from stopping" — continuation, not routing | match |

### Capabilities the probes did not cover (`documented`, unprobed)

| Capability | What it is |
|---|---|
| **Skill-frontmatter hooks** | A skill's YAML can register hooks, active from invocation for the rest of the session; `once: true` self-removes |
| **Subagent-frontmatter hooks** | Hooks active only while that subagent runs; its `Stop` becomes `SubagentStop` |
| **`type: "agent"` hooks** (experimental) | The hook IS a subagent with Read/Grep/Glob, returning a JSON decision |
| **`type: "prompt"` hooks** | Single-turn model evaluation of the hook input, JSON decision out |
| **`Stop` deny** | Exit 2 / deny on `Stop` prevents the turn from ending; input carries `last_assistant_message` + `tool_use_count` |
| **`PostToolBatch` deny** | Blocks the agentic loop before the next model call |
| **`updatedInput`** (PreToolUse) | Hook rewrites the tool input before execution |
| **`FileChanged`** | Watch literal filenames; fires on disk change with content |
| **`if` permission-rule filter** | Per-hook rule like `Bash(git *)`, `Edit(*.ts)`; leading assignments stripped, `$()` and compound commands checked, best-effort |
| **`UserPromptExpansion`** | Fires when a typed command expands, can block; matcher = command name |
| **`TeammateIdle` deny** | Prevents a teammate going idle |
| **`CLAUDE_PLUGIN_DATA`** | Per-plugin persistent data directory, exported to hooks |

### Codex convergence (`documented` 2026-08-28, learn.chatgpt.com/docs/hooks)

Codex CLI ships a hooks system (enabled by default; `[features] hooks = false`
to disable) that has **converged on the same contract**: JSON on stdin, exit 2
+ stderr blocks, the same `hookSpecificOutput.permissionDecision` JSON, the
same matcher-group config shape, fail-open on timeout/error, `updatedInput` on
`PreToolUse`, and `mcp_tool` handlers. Shared events: `SessionStart/End`,
`PreToolUse`, `PostToolUse`, `PermissionRequest`, `UserPromptSubmit`,
`Pre/PostCompact`, `SubagentStart/Stop`, `Stop`.

| Capability | Claude Code | Codex |
|---|---|---|
| Stop blocking | `Stop` deny / exit 2 | `Stop` with `continue: false` / exit 2 |
| PreToolUse deny + rewrite | yes | yes (`updatedInput` too) |
| Skill-scoped registration | frontmatter, `once` | **absent** (user/project/managed scopes only) |
| `FileChanged` watch | yes | **absent** |
| `prompt` / `agent` handler types | yes | **absent** (command + mcp_tool) |
| Trust model | settings/frontmatter trust rules | explicit `/hooks` review-and-trust for non-managed hooks |
