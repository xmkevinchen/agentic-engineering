# Agent Governance File Format

Specification for `.claude/agent-governance.md` — the per-project file AE uses to express user-declared agent selection rules.

## Why a separate file?

Per conclusion 040 T9b: AE **never edits the user's CLAUDE.md body**. Instead:

- AE owns `.claude/agent-governance.md` entirely. Writes governance rules here as a structured YAML block.
- On first governance event, AE prompts the user ONCE to add `@.claude/agent-governance.md` to their project CLAUDE.md — a single include line is the only line AE ever writes to CLAUDE.md.
- User sees the rules in their CC context via the `@include` mechanism.

**Critical platform-decoupling** (Doodlestein-regret mitigation from plan 041 review): AE reads `.claude/agent-governance.md` directly via its Read tool when applying governance rules — AE does **not** depend on CC's `@include` semantics for functionality. The `@include` line in CLAUDE.md is for user visibility only. If CC changes `@include` behavior in a future version, AE still works; only the user-visibility surface changes.

## File structure

```markdown
# AE Agent Governance

> Auto-managed by AE (do not edit manually — use `/ae:setup agents --rule-*` commands).
> User is free to delete or modify individual rules; AE will not re-add unless the
> triggering pattern recurs.

```yaml
rules:
  - agent: rust-mcp-expert
    action: force
    context: [mcp, tool-auth, server-security]
    scope: discuss
    added_at: 2026-04-18
    added_reason: "Used in 3 consecutive MCP discussions; confirmed via pattern detection"

  - agent: engineering-security-engineer
    action: prefer
    context: [security, vulnerability, auth]
    scope: all
    added_at: 2026-04-18
    added_reason: "smart-suggest import: MCP server security profile"
```
```

The file is a markdown file containing a single YAML code block with a top-level `rules:` list. AE parses the YAML block directly when applying rules.

## Rule fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `agent` | string | yes | Filename stem (canonical spawn identifier) from `.claude/agents/`. Must exist — broken references handled per "Failure semantics" below. |
| `action` | enum | yes | `force` or `prefer`. See Action Semantics. |
| `context` | list of strings | yes | Keyword list. Rule fires when any keyword appears in current skill context (topic tags, discussion titles, review diff, etc.). Empty list `[]` means "apply unconditionally within scope" (equivalent to `context: any`). |
| `scope` | enum | yes | `discuss`, `review`, `work`, `analyze`, or `all`. Limits rule firing to specific skills. |
| `added_at` | ISO date | yes | When rule was created. Used for `--refresh` audits and future rule-sunsetting. |
| `added_reason` | string | yes | Human-readable rationale. Not machine-parsed; serves as audit trail (analogous to Dependabot PR descriptions). |

Unknown fields at the rule level are silently tolerated (AE reads known fields, ignores rest).

## Action semantics

### `action: force`

When the rule fires (context matches + scope matches), AE **short-circuits the entire agent-selection chain**: the specified agent is included in the team for that skill run, no other layers (algorithm, user-pick) can override.

Use case: "always use `rust-mcp-expert` for MCP discussions" — user has decided this agent is mandatory for the context.

### `action: prefer`

When the rule fires, AE **biases Layer 2 scoring toward the specified agent**: adds a fixed bonus to the agent's score during the 6-signal scorer aggregation (bonus magnitude: +0.20, enough to surface the agent reliably but not enough to override strong negative signals like stack mismatch).

Use case: "for security reviews, prefer `engineering-security-engineer` when available" — expresses preference without mandating inclusion.

Multiple `prefer` rules matching the same agent do NOT stack (max +0.20).

### Interaction with Layer 2

- `force`: bypasses scorer entirely for the specified agent; agent is included regardless of threshold.
- `prefer`: +0.20 score boost in Layer 2 aggregation, then scorer threshold still applies. A preferred agent with a total score still below 0.35 after the boost is suppressed per normal noise-floor rules.

## Scope values

| Scope | Skills covered |
|-------|----------------|
| `discuss` | `/ae:discuss` |
| `review` | `/ae:review`, `/ae:code-review` |
| `work` | `/ae:work` |
| `analyze` | `/ae:analyze`, `/ae:think` |
| `all` | All of the above |

Unknown scope value → rule is silently skipped (do not apply, do not warn). Reasoning: forward-compatibility with future scopes.

## Context matching

AE collects "current context keywords" at rule-evaluation time from sources relevant to the active skill:

- `/ae:discuss`: topic tags + topic titles + topic Key Questions (tokenized per scorer spec).
- `/ae:review`: diff-file-path tokens + commit message tokens.
- `/ae:work`: plan step title + AC text tokens.
- `/ae:analyze`, `/ae:think`: user's query text + any referenced discussion tags.

A rule fires when **any** keyword in its `context:` list matches (case-insensitive substring match against the tokenized context) AND its `scope` matches the active skill.

Example: rule with `context: [mcp, tool-auth]`, `scope: discuss` fires when the active `/ae:discuss` topic has "mcp" in tags OR any topic title contains "tool-auth".

## Failure semantics

### Broken rule (agent missing)

When a rule references an agent that doesn't exist in `.claude/agents/<name>.md`:

- **`action: prefer`** → warn + fall-through to Layer 2 without applying the boost:
  ```
  [ae:governance] WARNING: Rule references missing agent 'rust-mcp-expert'
    (file not found: .claude/agents/rust-mcp-expert.md)
    Rule skipped — falling through to Layer 2 algorithm.
    Run `/ae:setup agents --add rust-mcp-expert` to restore, or
        `/ae:setup agents --rule-cleanup` to remove stale rules.
  ```
  Warning is persistent (shown every skill run until rule cleaned up or agent restored).

- **`action: force`** → ESCALATE via AskUserQuestion:
  ```
  [ae:governance] Rule 'use rust-mcp-expert for mcp/tool-auth (force)' references missing agent.
  
  Options:
  1. Continue with Layer 2 fallback (this run only; rule stays intact)
  2. Remove the broken rule
  3. Cancel — no team spawned
  ```
  `force` is a stronger user intent signal than `prefer`; silent fall-through would violate user expectations.

### Malformed YAML

If the `rules:` block fails to parse:

```
[ae:governance] WARNING: .claude/agent-governance.md has malformed YAML (line N).
  All rules skipped for this run. Fix the YAML block and re-run.
```

All rules are skipped — AE falls through to Layer 2 for every agent slot. Warning persists until YAML is fixed.

### Unknown action value

Rule skipped silently; forward-compat with future actions. No warning (would nag on every future-version file read).

## Phase 1 precedence semantics (Rule 4 alignment)

For role-slot filling, AE reads `project_agents[]` + built-in list; ranks by:

1. `required: true` agents first (spawn regardless of cap)
2. Governance `force` rules that match current context (spawn regardless of cap)
3. Declared `priority: <int>` descending
4. Algorithm score from `docs/references/agent-selection-scorer.md`
5. Default cap N=3 per role slot (configurable via `work.max_agents_per_role` in future; Phase 1 hardcoded)

**Phase 2 Layer-2 test gates finalization** — per conclusion 040 T5 deferred resolution, the actual runtime behavior of Rule 4 has never been verified by a Layer-2 behavioral test. Phase 2 will add that test; the precedence semantics above may be adjusted based on runtime truth.

## Debug flag

`--agent-debug` on any skill (`/ae:discuss --agent-debug`, `/ae:review --agent-debug`, etc.) shows the full decision tree:

```
[ae:governance] Layer 1 check — rules evaluated:
  rule #1 (force rust-mcp-expert in [mcp, tool-auth], scope: discuss): MATCH → forcing include
  rule #2 (prefer engineering-security-engineer in [security, vulnerability, auth], scope: all): no context match → skipped

[ae:governance] Layer 2 — 6-signal scorer applied to remaining slots:
  ... [per-agent scoring per scorer --why format] ...

[ae:governance] Layer 3 — user-pick triggered: NO (score delta > 0.10 between top-2)

[ae:governance] Final team: [rust-mcp-expert (forced), code-reviewer (score 0.52), ...]
```

Rationale: when governance produces surprising selections, debug output makes the reasoning inspectable without re-running with extra flags.

## Change history

- 2026-04-18 — Initial Phase 1 spec (plan 041 Step 5). Rule schema, action semantics (force + prefer), scope enum, failure semantics (warn+fall-through for prefer; escalate for force).
