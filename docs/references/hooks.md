# Hooks — measured enforcement, official semantics, and what AE builds on them

> **Status: current.** The one place hook knowledge lives. Three layers, in
> order of trust: what we **measured** (`empirical`), what the vendors
> **document** (`documented` — verify before making one load-bearing), and what
> AE **designs** on top (unprobed until its own red→green probe).
> Sources: code.claude.com/docs/en/hooks · learn.chatgpt.com/docs/hooks ·
> the probe scripts and evidence under `.ae/research/2026-08-28-plugin-boundaries/`
> (process artifact, commands re-runnable).

## Hook enforcement semantics

Dependencies #5 and #6 above establish that plugin-level hooks *register and
fire*. This section is the separate question of **how much a firing hook can
refuse** — the property AE must know before placing any control on one.

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

### What this means for AE

- **Only `PreToolUse` exit 2 and `TaskCompleted` exit 2 refuse anything.** A
  validator that errors or exceeds its timeout permits the call, so a hook is a
  detector, not a gate. Anything that must fail closed belongs in the Kernel,
  which recomputes from durable records.
- **`PostToolUse` is not a rollback.** The side effect has already happened and
  the following turn may ignore the reason.
- **`SubagentStop` gives an interception point, not a router.** A refusal makes
  the same worker try again; the choice between rework, a different reviewer, and
  a changed approach never reaches whoever should make it. Never hold a worker at
  its exit waiting for something only the caller can arrange.
- **A firing hook is not a state transition.** The `TaskCompleted` scenario fired
  `PostToolUse` on an update that returned a business failure. Parse the return
  value and read the state back.
- **Process exit status carries no business meaning.** All eight scenarios ended
  with the process reporting success, including both that refused a call.

### Classification and re-verification

`empirical` — the same class as #5 and #6, and for the same reason: this is
observed host behavior at one version, not a contractual commitment. The
`PreToolUse` timeout and `PostToolUse` semantics agree with the published hooks
reference, which states that a plugin command hook's timeout does not produce a
refusal and that a `PostToolUse` block appends a reason for the model. Do not
transfer Agent SDK callback timeout behavior, which the same documentation
defines separately, onto plugin command hooks.

**Re-verify on each CC major version bump**, and before any change that would
place an AE control on a hook.

**Not covered.** Interactive mode, background subagents, Agent Teams, compaction
and resume, cross-session recovery, concurrent writers, and interaction between
multiple plugins' hooks. None of these was exercised; no claim is made about them.

## Hook design surface — official semantics, cross-checked (2026-08-28)

The enforcement table above records what we **measured**. This section records
what the official hooks reference **documents** (fetched 2026-08-28,
code.claude.com/docs/en/hooks), cross-checked against those measurements, plus
the capabilities relevant to the rewrite that the measurements did not cover.
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

| Capability | What it is | Why it matters to the rewrite |
|---|---|---|
| **Skill-frontmatter hooks** | A skill's YAML can register hooks, active from invocation for the rest of the session; `once: true` self-removes | **The unified entry can carry its own enforcement, scoped** — no plugin-global hooks, nothing runs for users who never invoke it |
| **Subagent-frontmatter hooks** | Hooks active only while that subagent runs; its `Stop` becomes `SubagentStop` | A reviewer seat can bring its own verification hooks and take them away when it exits |
| **`type: "agent"` hooks** (experimental) | The hook IS a subagent with Read/Grep/Glob, returning a JSON decision | A native mechanism for the checker-seat idea — a condition verified by an agent that can actually look, at a hook point |
| **`type: "prompt"` hooks** | Single-turn model evaluation of the hook input, JSON decision out | Cheap semantic checks where a regex is dishonest |
| **`Stop` deny** | Exit 2 / deny on `Stop` prevents the turn from ending; input carries `last_assistant_message` + `tool_use_count` | **The done-leash**: "you do not stop before the deliverable exists on disk" becomes checkable at the moment of claiming done. Fail-open on timeout, so an accelerator — but the strongest one available |
| **`PostToolBatch` deny** | Blocks the agentic loop before the next model call | A parent-level halt point the morning probes never found — coarser than routing, stronger than PostToolUse feedback |
| **`updatedInput`** (PreToolUse) | Hook rewrites the tool input before execution | Enforcement by correction rather than refusal — e.g. normalizing a path, adding a flag |
| **`FileChanged`** | Watch literal filenames; fires on disk change with content | **Tamper-visibility for frozen artifacts at ~1% of a ledger's cost**: watch the confirmed-criteria file, surface any post-freeze edit. Partially services the archived Kernel's first reopening event (tampering/staleness **observed**, not feared) |
| **`if` permission-rule filter** | Per-hook rule like `Bash(git *)`, `Edit(*.ts)`; leading assignments stripped, `$()` and compound commands checked, best-effort | Precision without a matcher regex — but "best-effort; use the permission system for hard enforcement" is the doc's own words |
| **`UserPromptExpansion`** | Fires when a typed command expands, can block; matcher = command name | Inspect/refuse a skill invocation before the model sees it |
| **`TeammateIdle` deny** | Prevents a teammate going idle | The only documented control over team-member lifecycle |
| **`CLAUDE_PLUGIN_DATA`** | Per-plugin persistent data directory, exported to hooks | A sanctioned home for plugin state that is neither repo nor `~/.claude` hand-wiring |

### Codex convergence (`documented` 2026-08-28, learn.chatgpt.com/docs/hooks)

Codex CLI ships a hooks system (enabled by default; `[features] hooks = false`
to disable) that has **converged on the same contract**: JSON on stdin, exit 2
+ stderr blocks, the same `hookSpecificOutput.permissionDecision` JSON, the
same matcher-group config shape, fail-open on timeout/error, `updatedInput` on
`PreToolUse`, and `mcp_tool` handlers. Shared events: `SessionStart/End`,
`PreToolUse`, `PostToolUse`, `PermissionRequest`, `UserPromptSubmit`,
`Pre/PostCompact`, `SubagentStart/Stop`, `Stop`.

| Capability | Claude Code | Codex | Portability consequence |
|---|---|---|---|
| Stop blocking | `Stop` deny / exit 2 | `Stop` with `continue: false` / exit 2 | **The done-leash ports almost verbatim** — one small output shim |
| PreToolUse deny + rewrite | yes | yes (`updatedInput` too) | identical scripts |
| Skill-scoped registration | frontmatter, `once` | **absent** (user/project/managed scopes only) | on Codex: project `.codex/hooks.json` + a marker-file guard in the script (instant no-op exit when no run is active) reproduces the zero-cost-when-idle property |
| `FileChanged` watch | yes | **absent** | freeze-watch is CC-only; the fallback is the pull model the workflow prefers anyway — review re-verifies digests at consumption |
| `prompt` / `agent` handler types | yes | **absent** (command + mcp_tool) | semantic checks stay in the workflow's own review stage, not in hooks |
| Trust model | settings/frontmatter trust rules | explicit `/hooks` review-and-trust for non-managed hooks | a ported hook set must plan for the trust prompt |

The convergence upgrades design rule 3: a Codex port loses **less** than
"all hooks" — it keeps the portable core (Stop-leash, PreToolUse guards) and
loses only the CC-specific accelerators (freeze-watch, skill-scoped
registration, prompt/agent handlers).

### Design rules the two sources jointly force

1. **A hook is an accelerator, never the sole carrier of a rule.** Timeout and
   error are fail-open on nearly every event (`WorktreeCreate` is the lone
   fail-closed exception). Anything that must hold, holds in the artifact
   contract and the human gates; hooks make violations *visible sooner*.
2. **Scope hooks to the skill, not the plugin.** Frontmatter registration means
   the workflow's enforcement travels with the workflow. Plugin-global hooks
   stay for genuinely global concerns only (today: cross-family env check).
3. **Portability bound**: hooks are Claude Code surface. Any other host (e.g. a
   Codex port) gets the same workflow with zero hooks and must lose nothing but
   earliness of detection. If a rule breaks without its hook, rule 1 was
   violated.
4. **Anything from the `documented` table becomes load-bearing only after its
   own probe** — the same discipline that produced the enforcement table above.

### AE's minimal hook set (designed 2026-08-28, `unprobed`)

Two hooks, chosen against the deletion-first baseline — every additional hook
must earn its place the way every surviving line does.

**H1 — the done-leash (`Stop`; portable to Codex).** A ~20-line script: no
in-flight run marker under the workflow's deliverable dir → instant exit 0;
marker present but the declared stage's deliverable is missing on disk → exit 2
with one sentence naming the missing file. This mechanizes the ground rule
"deliverables are files on disk" at the exact moment completion is claimed.
Fail-open by contract, so it is an accelerator; the rule itself lives in the
workflow's gates. On Codex the same script ships with a three-line output shim
(`continue: false`).

**H2 — the freeze-watch (`FileChanged`; Claude Code only).** Matcher on the
conventional deliverable filenames; fires when a file under a run dir whose
state says *criteria frozen* is edited. Cannot block by design — it is
visibility, servicing the archived Kernel's first reopening event (tampering /
staleness observed, not feared). The Codex fallback is the pull model the
workflow prefers anyway: review re-verifies digests at consumption.

**Registration.** Claude Code: the unified entry skill's frontmatter — active
only for sessions that invoke it, `once`-capable. Codex: project
`.codex/hooks.json` plus the marker-file guard, which reproduces
zero-cost-when-idle by script instead of scope; non-managed hooks there require
a one-time `/hooks` trust review, which a port must document.

**Deliberately absent**: `prompt`/`agent` handler types (semantic checks stay
in the review stage's own spawns — the path four benchmark runs validated),
`PreToolUse` guards (no current need), `PostToolBatch`. Listed so their absence
is a decision; adding one later means writing its probe first.

**Probe-first.** H1's probe is the first action of the entry-skill work: plant
the defect (delete the stage deliverable, claim done) → the Stop hook must
refuse; remove the marker → zero interference; let it time out → the turn ends
anyway and the log says so. Same fixture method that produced the enforcement
table. H2 likewise before registration.
