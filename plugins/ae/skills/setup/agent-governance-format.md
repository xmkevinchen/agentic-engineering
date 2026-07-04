# Agent Governance File Format

Specification for `.claude/agent-governance.md` — the per-project file AE uses to express user-declared agent selection rules.

## Why a separate file?

Per conclusion 040 T9b: AE **never edits the user's CLAUDE.md body**. Instead:

- AE owns `.claude/agent-governance.md` entirely. Writes governance rules here as a structured YAML block.
- On first governance event, AE prompts the user ONCE to add `@.claude/agent-governance.md` to their project CLAUDE.md — a single include line is the only line AE ever writes to CLAUDE.md.
- User sees the rules in their CC context via the `@include` mechanism.

**Decoupling from CC's `@include` mechanism specifically** (plan 041 review mitigation): AE reads `.claude/agent-governance.md` directly via its Read tool when applying governance rules — AE does **not** depend on CC's `@include` semantics for governance functionality. The `@include` line in CLAUDE.md is for user visibility only. If CC changes `@include` behavior in a future version, AE's governance still works; only the user-visibility surface changes.

Scope note: this decoupling is narrow. AE still depends on CC runtime for tool availability (`Read`, `Agent`, `Task*`), agent-context management, and file-path resolution. The claim is: governance semantics don't depend on `@include` specifically — NOT that AE is broadly platform-independent.

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
| `action` | enum | yes | `force`, `exclude`, or `prefer`. See Action Semantics. |
| `context` | list of strings | yes | Keyword list. Rule fires when any keyword appears in current skill context (topic tags, discussion titles, review diff, etc.). Empty list `[]` means "apply unconditionally within scope" (equivalent to `context: any`). |
| `scope` | enum | yes | `discuss`, `review`, `work`, `analyze`, or `all`. Limits rule firing to specific skills. |
| `added_at` | ISO date | yes | When rule was created. Used for `--refresh` audits and future rule-sunsetting. |
| `added_reason` | string | yes | Human-readable rationale. Not machine-parsed; serves as audit trail (analogous to Dependabot PR descriptions). |

Unknown fields at the rule level are silently tolerated (AE reads known fields, ignores rest).

## Action semantics

### `action: force`

When the rule fires (context matches + scope matches), AE **short-circuits the entire agent-selection chain**: the specified agent is included in the team for that skill run, no other layers (algorithm, user-pick) can override.

Use case: "always use `rust-mcp-expert` for MCP discussions" — user has decided this agent is mandatory for the context.

### `action: exclude`

When the rule fires (context + scope match), AE **removes the specified agent from the candidate pool** before Claude sees it. Hard negative constraint.

Use case: "never use `engineering-rapid-prototyper` for security reviews" — user has decided an agent is banned for a context.

### `action: prefer`

When the rule fires, AE **surfaces the preferred agent as context to Claude's Layer 2 judgment**: the rule's rationale is included in Claude's selection prompt. Claude weighs the preference alongside task fit, stack compatibility, and role coverage — it is not a mechanical bonus.

Use case: "for security reviews, prefer `engineering-security-engineer` when available" — expresses preference without mandating inclusion.

`prefer` does not override hard constraints (stack mismatch, `exclude` rules).

### Interaction with Layer 2

- `force`: bypasses Layer 2 entirely for the specified agent; agent is included regardless of Claude's judgment. **Does not bypass `exclude`** — see precedence below.
- `exclude`: applied before Layer 2; Claude never sees the excluded agent.
- `prefer`: presented to Claude as a hint during Layer 2 selection. Claude may surface the preferred agent above other candidates when task context matches, but may also choose a better-fit candidate. When Claude chooses against a prefer hint, the deviation is recorded in the team-lead synthesis narrative (and in `--agent-debug` output if enabled) — the user can trace which prefer rules fired and whether Claude honored or overrode each.

### Precedence (conflicting rules on the same agent)

When multiple rules fire for the same agent in the same context+scope, precedence is:

1. **`exclude` wins over `force`**. If governance has both `force` and `exclude` for agent X, X is removed. Rationale: hard negative constraint takes precedence over intent; no agent can be force-included if governance has explicitly banned it.
2. **`exclude` wins over stack-mismatch** (trivially — both remove the agent).
3. **`force` and stack-mismatch interaction is governed by `schema_version:`** (F-009 Step 2 introduced this versioning — see [Governance file schema versioning](../agent-selection/SKILL.md#governance-file-schema-versioning-f-009-step-2) in `agent-selection/SKILL.md` for the canonical spec):
   - **`schema_version: 1`** (default when the top-level `schema_version:` field is absent): `force` bypasses stack-mismatch unconditionally and silently. Legacy behavior, preserved for backward compatibility.
   - **`schema_version: 2`** with rule `stack_check: enforce` (the per-rule default when omitted under v2): stack-mismatch on a `force` agent triggers `AskUserQuestion` (accept / drop / abort) — the silent bypass is replaced with an explicit user disposition.
   - **`schema_version: 2`** with rule `stack_check: skip`: explicit per-rule preservation of the v1 silent-bypass behavior; trace records the bypass for audit.
   - The Layer 1 trace records the event for v2 (`[layer1] force-apply: <agent> stack-mismatch detected|SKIPPED ...`); v1 emits only a deprecation warning, not a per-event line.
4. **`prefer` never overrides** hard constraints (`exclude`, stack-mismatch on non-force agents). If a prefer-matched agent is filtered by either, the prefer rule is a no-op (Layer 1 trace records the no-op).

For implementation in trace output and the per-version trace examples, see the Layer 1 Trace Format and Governance file schema versioning sections in `plugins/ae/skills/agent-selection/SKILL.md`.

### `schema_version:` field placement

Top-level field inside the governance YAML code block (sibling to `rules:`), NOT inside an individual rule entry, NOT a markdown `---` frontmatter field at the head of the file:

```yaml
schema_version: 2
rules:
  - action: force
    agent: php-test-reviewer
    stack_check: enforce
```

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

- `/ae:discuss`: topic tags + topic titles + topic Key Questions (read by Claude, not tokenized).
- `/ae:review`: diff-file-path tokens + commit message tokens.
- `/ae:work`: plan step title + AC text tokens.
- `/ae:analyze`, `/ae:think`: user's query text + any referenced discussion tags.

A rule fires when **any** keyword in its `context:` list matches (case-insensitive substring match against the tokenized context) AND its `scope` matches the active skill.

Example: rule with `context: [mcp, tool-auth]`, `scope: discuss` fires when the active `/ae:discuss` topic has "mcp" in tags OR any topic title contains "tool-auth".

## Failure semantics

### Broken rule (agent missing)

When a rule references an agent that doesn't exist in `.claude/agents/<name>.md`:

- **`action: prefer`** → warn + fall-through to Layer 2; the prefer hint is dropped for this run:
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
4. Claude's Layer 2 judgment per [agent-selection-rubric.md](./agent-selection-rubric.md), with `prefer` rules and `priority` passed as context
5. Default cap N=3 per role slot (configurable via `work.max_agents_per_role` in future; Phase 1 hardcoded)

## Debug flag

`--agent-debug` on any skill (`/ae:discuss --agent-debug`, `/ae:review --agent-debug`, etc.) shows the full decision tree:

```
[ae:governance] Layer 1 check — rules evaluated:
  rule #1 (force rust-mcp-expert in [mcp, tool-auth], scope: discuss): MATCH → forcing include
  rule #2 (prefer engineering-security-engineer in [security, vulnerability, auth], scope: all): no context match → skipped

[ae:governance] Layer 2 — Claude selects from remaining candidates per rubric:
  ... [per-agent rationale: what fits, what doesn't, 1-line per candidate] ...

[ae:governance] Layer 3 — user-pick triggered: NO (Claude had a confident match)

[ae:governance] Final team: [rust-mcp-expert (forced), code-reviewer (Claude's pick: reviewer role, MCP context fit), ...]
```

Rationale: when governance produces surprising selections, debug output makes the reasoning inspectable without re-running with extra flags.

## Change history

- 2026-04-18 — Initial Phase 1 spec (plan 041 Step 5). Rule schema, action semantics (force + prefer), scope enum, failure semantics (warn+fall-through for prefer; escalate for force).
