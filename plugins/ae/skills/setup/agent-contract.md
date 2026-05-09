# Agent Contract

Canonical specification for AE-compatible agent files. This document supersedes the frontmatter-contract section of `docs/decisions/037-agent-contract.md`.

## Discovery & Spawn Identifier

CC resolves `subagent_type` by **two different mechanisms** depending on where the agent file lives. This is a hard platform constraint, observed empirically (F-011 dogfood gate, 2026-05-08).

### Case A — Project-local & global agents (filename-stem mechanism)

For agents in `.claude/agents/<stem>.md` (project) or `~/.claude/agents/<stem>.md` (global):

- **Spawn identifier** = filename stem (no extension). Example: `code-reviewer.md` → `subagent_type: "code-reviewer"`.
- **`name:` frontmatter field** = display label shown in the CC agent panel. **Not used for resolution.**
- **AE never normalizes `name:` on import**. Third-party library agents commonly have mismatched pairs (filename `engineering-code-reviewer.md`, `name: Code Reviewer`). This mismatch is functionally harmless for spawning — only cosmetic for display.

### Case B — Plugin built-in agents (frontmatter-name mechanism, namespaced)

For agents bundled into a plugin at `plugins/<plugin>/agents/<subdir>/<file>.md`:

- **Spawn identifier** = `<plugin>:<subdir>:<frontmatter-name-value>` namespace string. Example: file `plugins/ae/agents/engineering/minimal-change-engineer.md` with `name: minimal-change-engineer` → `subagent_type: "ae:engineering:minimal-change-engineer"`.
- **`name:` frontmatter field IS used for resolution** in this case (the third namespace component). The filename stem is NOT consulted.
- **Convention**: keep `name:` field in **kebab-case matching the filename stem** so the namespace identifier reads consistently with other plugin agents (e.g., `ae:workflow:codex-proxy`, `ae:research:archaeologist`). Vendoring third-party agents (which often have Title-Case `name:` like `Minimal Change Engineer`) requires adapting the `name:` field to kebab-case during vendor — this is the single permitted modification under VERBATIM vendor policy (see `plugins/ae/NOTICE.md` for an example).
- **CC plugin loader behavior**: agents in new subdirs (e.g., creating `plugins/ae/agents/engineering/` for the first time) require `/reload-plugins` for CC to pick up the new namespace. Cache is built at session start; not dynamically re-scanned.

### Discovery order (first match wins per Rule 4)

1. **Project agents** (Case A): `.claude/agents/*.md` in the project root.
2. **Plugin agents** (Case B): installed plugin agent directories at `plugins/<plugin>/agents/<subdir>/`.
3. **Global agents** (Case A): `~/.claude/agents/*.md`.

### Two-format coexistence (Case B vs Case A within plugin SKILL.md)

Plugin SKILL.md files reference both formats depending on context:

- **Bare-stem format** (e.g., `subagent_type: "doodlestein-strategic"` in `plan/SKILL.md`): used when spawning a plugin's own built-in agent **from within the same plugin** — TL implicitly resolves within the plugin's namespace context.
- **Fully-qualified format** (e.g., `subagent_type: "ae:engineering:minimal-change-engineer"` in `discuss/SKILL.md`): used when the spawn site needs explicit namespace disambiguation, OR when the agent lives in a non-default subdir requiring the namespace prefix to be matched against CC's plugin-loader index.

In practice, AE prefers fully-qualified Case B format for all plugin built-in spawns — it makes the spawn site self-documenting (reader knows exactly which agent is invoked without needing to know the surrounding plugin context).

### Vendor verification step (mandatory for new vendor work)

When vendoring a third-party agent into a plugin (e.g., `plugins/ae/agents/<new-subdir>/<file>.md`), include a **dogfood gate** between fixture creation and project-local cleanup:

1. Reload the plugin (`/reload-plugins` slash command, or restart CC session).
2. Spawn the new agent with a minimal echo prompt (`Agent(subagent_type: "<plugin>:<subdir>:<name>", ...)`) and verify success.
3. Only after dogfood pass: proceed with cleanup of any pre-vendor project-local agent file (otherwise removing the project-local strands the discuss/work skill if the namespace fails to resolve).

This gate caught a real bug in F-011 implementation: the original plan assumed CC plugin loader would resolve via filename stem (Case A logic incorrectly applied to Case B). Dogfood revealed the frontmatter-`name:` mechanism, requiring a fixup of the `name:` field. Without the gate, Step 4 cleanup would have removed the project-local fallback before discovering the namespace bug.

## Frontmatter Tiers

AE reads agent frontmatter in three tiers. Missing REQUIRED = skip with warning. RECOMMENDED drives smart selection. TOLERATED pass through untouched.

### Required

Absence of either field: AE skips the agent with a warning (`[ae:setup] skip <filename>: missing required field 'name'|'description'`).

- `name` — display label (string). Must be a valid YAML string. Should match filename stem for consistency but AE does not enforce or rewrite it.
- `description` — one-line purpose (string). Used by role-inference heuristic.

### Recommended

Absence triggers fallback behavior (documented per field). AE does not warn about missing RECOMMENDED fields.

- `role` — canonical role enum: `reviewer | developer | domain-expert`. Absent → AE infers from `description` keywords (see Role Inference Fallback below).
- `tools` — array of tool names. Absent → all tools available (CC default).
- `model` — model override: `opus | sonnet | haiku`. Absent → inherits from parent skill context.
- `tech_stack` — array of stack keywords (e.g., `[rust, mcp]`). Used by smart-selection stack-mismatch signal. Absent → AE falls back to filename-prefix extraction then description keyword scan.
- `specialty` — free-form tag for finer-grained discrimination within a role (e.g., `architecture`, `security`, `performance`, `observability`). Used by smart-selection role-gap scoring. Example: two `domain-expert` agents with `specialty: architecture` vs `specialty: security` cover different slots.

### Tolerated

AE reads and ignores. Never a parse error. Never stripped on import.

- `color` — display color (any string). Passed through.
- `emoji` — display emoji. Passed through.
- `vibe` — agency-agents convention for agent persona tagline. Passed through.
- `author`, `public`, `effort`, `maxTurns`, `skills` — miscellaneous fields used by CC or other tooling. AE does not interpret.
- Any unknown field — silently tolerated.

### Parse Errors

- Malformed YAML → AE skips the agent with warning `[ae:setup] skip <filename>: malformed YAML (line N)`. The overall batch (e.g., `--add` of multiple agents) continues.
- `name` absent → skip with warning (REQUIRED violation).
- `description` absent → skip with warning (REQUIRED violation).
- `name` present but does not match filename stem → warn once (`[ae:setup] <filename>: name '<value>' does not match filename stem '<stem>'. Spawn uses filename stem.`). AE proceeds — does not rewrite.

## Role Enum

Three canonical roles; a closed enum in Phase 1.

| Role | Team slot | Consumer skills |
|------|-----------|-----------------|
| `reviewer` | Review slot | `ae:review`, `ae:code-review` |
| `developer` | Work slot | `ae:work` |
| `domain-expert` | Analysis slot | `ae:analyze`, `ae:discuss`, `ae:team` |

**`architect` and `qa` are NOT first-class roles in Phase 1.** They remain name-spawned built-in agents (`ae:plan` hard-spawns `architect`; `ae:work` hard-spawns `qa`). Project agents that would logically be architects should use `role: domain-expert` with `specialty: architecture` — this preserves role-gap detection in smart selection without requiring the `ae:plan`/`ae:work` spawn-path refactor (tracked as Phase 4 work, post-v1.0).

### Role Inference Fallback

When `role:` is absent, AE falls back in order:

1. **`pipeline.yml project_agents[].role` override** — if the agent appears in `project_agents` with an explicit `role:`, use it. This is the authoritative override.
2. **Description keyword heuristic**:
   - `reviewer` keywords: "review", "audit", "check", "validate", "security", "quality"
   - `developer` keywords: "implement", "build", "develop", "write", "create"
   - `domain-expert` keywords: "expert", "specialist", "knowledge", "domain", "advise"
   - Multiple matches → prefer `reviewer > developer > domain-expert`.
3. **Conservative default**: `domain-expert` (puts the agent in the analysis slot, least disruptive to existing workflows).

Example: `Software Architect` agent with description "specializing in system design, domain-driven design, architectural patterns" — keyword heuristic matches "specializing" (loose) but not a strong role keyword; falls through to `domain-expert` default. User can override via `pipeline.yml` with `role: domain-expert, specialty: architecture`.

## Specialty Tag

Optional free-form tag under any role. Used by smart selection for finer discrimination.

Example values (non-exhaustive): `architecture`, `security`, `performance`, `observability`, `accessibility`, `testing`, `documentation`, `refactoring`, `migration`, `compliance`.

Specialty is not an enum — users declare what makes sense for their project. Smart selection treats specialty as an extra keyword source during the role-gap scoring signal (conclusion 040 T2).

## Minimum Viable Agent

A 3-line file in `.claude/agents/security-auditor.md`:

```markdown
---
name: security-auditor
description: "Reviews code for security vulnerabilities and auth bypass"
---

You are a security specialist. Focus on OWASP Top 10, authentication flows, and injection vectors. Cite specific file:line evidence for all findings.
```

AE discovers it, infers `role: reviewer` (description matches "reviews" + "security"), and includes it in review teams.

## Imported Agents (from Library)

When an agent is imported via `/ae:setup agents --add <library:name>`, AE records provenance in `pipeline.yml project_agents[]`:

```yaml
project_agents:
  - name: engineering-code-reviewer          # filename stem (canonical spawn identifier)
    role: reviewer                            # inferred or explicit
    source: "agency-agents:engineering/engineering-code-reviewer.md"
    source_sha: abc1234                       # git SHA from library; sha256 fallback if library is not a git repo
    display_name: "Code Reviewer"             # from original name: field — for --list output only
    imported_at: 2026-04-18
    modified: false                           # auto-updated by --sync when local edits detected
    tech_stack: []                            # optional — populated by --add if library file declares tech_stack
    specialty: ""                             # optional — populated if library file declares specialty
    priority: 50                              # optional — used by Rule 4 best-N selection (Phase 1 default: 50)
    required: false                           # optional — when true, always spawn; bypasses best-N cap
```

Fields are additive. Hand-written project agents (not imported) can declare any subset; `source`-less entries are treated as user-authored and skip sync/drift behavior.

## Superseded Sections

This document replaces the frontmatter-contract content of `docs/decisions/037-agent-contract.md`. See `037-agent-contract.md` for the original role inference rationale and pre-v0.8.0 decision history.
