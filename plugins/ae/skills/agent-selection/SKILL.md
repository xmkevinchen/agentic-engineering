---
name: ae:agent-selection
description: "Reference: agent selection reference — context-based team composition and cross-family role assignment. Used by skills that create Agent Teams."
user-invocable: true
---

# Agent Selection Reference

所有需要组建 Agent Team 的 skill 引用此表。

## Selection Table

| Context Signal | Core Agents | Typical Lead |
|---------------|-------------|--------------|
| DB / SQL / migration / schema | performance-reviewer, architect | architect |
| Auth / token / session / secrets | security-reviewer, architecture-reviewer | security-reviewer |
| UI / CSS / layout / frontend | code-reviewer, architect | code-reviewer |
| API / endpoint / contract / protocol | architecture-reviewer, standards-expert | architecture-reviewer |
| New feature (cross-module) | architect, dependency-analyst, code-reviewer | architect |
| Refactor / delete / simplify | archaeologist, code-reviewer | archaeologist |
| Performance / latency / scaling | performance-reviewer, architect, dependency-analyst | performance-reviewer |
| Bug / debug / trace | archaeologist, dependency-analyst, qa | archaeologist |
| Design / architecture decision | architect, challenger | architect |
| Research / analysis | archaeologist, standards-expert, dependency-analyst | archaeologist |
| Plan review | architect, dependency-analyst | architect |

## Rules

1. **Pick 2-4 core agents** from the table. Multiple rows can match — combine.
2. **Always add challenger** to any team with 3+ agents.
3. **Cross-family** (codex-proxy / gemini-proxy): external experts brought in for specific review angles.
   - Read `cross_family` from pipeline.yml to determine which proxies are enabled (none, codex only, gemini only, or both).
   - TL picks **angles first**, then assigns to available proxies. Angles are about coverage, not about which proxy does it.
   - Give a **specialized prompt with clear focus** — not generic "review this".
   - **One proxy enabled** → assign one angle. **Both enabled** → prefer different angles; same-angle only when there is genuinely no second valuable blind spot.
   - Example: if Claude has security-reviewer and architecture-reviewer, cross-family angles could be performance + data integrity. If only one proxy is enabled, it gets performance.
4. **Project agents** — 3-layer short-circuit chain (BL-005 Phase 1; see [Agent Contract](../setup/agent-contract.md), [Governance Format](../setup/agent-governance-format.md), [Selection Rubric](../setup/agent-selection-rubric.md)):

   **Discovery**: scan `.claude/agents/*.md` (project), installed plugin agents, `~/.claude/agents/*.md` (global). Also read `project_agents` from pipeline.yml. CC resolves agents by filename stem — spawn identifier = filename (without `.md`), NOT the `name:` frontmatter field.

   **Role inference fallback**: `pipeline.yml project_agents[].role` override → frontmatter `role:` field → description keyword heuristic (review/audit → reviewer; implement/build → developer; expert/specialist → domain-expert) → `domain-expert` as conservative default.

   **Slot mapping** (role maps to skill slot):
   - `reviewer` role maps to review slot (ae:review, ae:code-review)
   - `developer` role maps to work slot (ae:work)
   - `domain-expert` role maps to analysis slot (ae:analyze, ae:discuss, ae:team)

   `architect`/`qa` remain name-spawned built-ins in Phase 1 — project agents needing architect focus use `role: domain-expert` + `specialty: architecture`.

   **Precedence (Rule 4 core)**: project agent preferred over built-in when role matches. Pipeline.yml explicit `role:` overrides frontmatter-inferred role. Full precedence ladder is under "Phase 1 precedence semantics" below.

   ### Layer 1 — CLAUDE.md governance rules

   AE reads `.claude/agent-governance.md` directly via its Read tool (**not** via CC's `@include` mechanism — see [Governance Format](../setup/agent-governance-format.md) for the platform-decoupling rationale).

   Parse YAML `rules:` block. For each rule whose `scope` matches the active skill AND whose `context:` keywords match current skill context:

   - `action: force` → include the agent in the team; short-circuit Layers 2+3 for that slot. **Stack-mismatch interaction depends on governance file `schema_version`** — see "Governance file schema versioning" below; in `schema_version: 2` the rule may set `stack_check: enforce|skip` to control mismatch handling.
   - `action: exclude` → remove the agent from the candidate pool before Claude sees it (hard negative constraint).
   - `action: prefer` → surface the preferred agent as context hint to Claude's Layer 2 judgment (not a mechanical bonus); Claude weighs it alongside task fit.

   **Broken rule (agent missing)**:
   - `prefer` → warn + fall-through to Layer 2; the hint is dropped.
   - `exclude` → warn + fall-through to Layer 2; no agent is filtered (rule had nothing to remove).
   - `force` → ESCALATE via AskUserQuestion (continue with Layer 2 fallback vs. cancel vs. remove rule).

   Malformed YAML → warn + skip all rules for this run (fall-through to Layer 2 for every slot).

   ### Governance file schema versioning (F-009 Step 2)

   The governance file (`.claude/agent-governance.md`) carries a top-level `schema_version:` field in its YAML frontmatter. Missing field defaults to `1` (legacy). Recognized values:

   - **`schema_version: 1` (legacy)** — preserves the pre-F-009 behavior: `action: force` rules short-circuit Layers 2+3 AND bypass the stack-mismatch filter unconditionally (the user is presumed to have explicitly overridden fit judgment by writing the force rule). On first load of a schema_version=1 (or missing) file, emit one-time trace warning:
     ```
     [layer1] governance schema_version=1 (legacy); add `schema_version: 2` to opt into safer force-vs-stack handling. See CHANGELOG entry for F-009 Step 2 migration.
     ```
   - **`schema_version: 2` (current)** — the force agent goes through the stack-mismatch filter by default. To preserve the legacy bypass on a specific rule, declare it explicitly with a new per-rule field:
     - `stack_check: enforce` (default when omitted) — stack-mismatch on this force agent triggers `AskUserQuestion` (accept incompatible force / drop this force / abort skill). User disposition is recorded in trace.
     - `stack_check: skip` — silently bypass the stack-mismatch filter for this rule, matching legacy schema_version=1 behavior; trace records the bypass for audit.

   Unknown `schema_version:` value (anything outside `{1, 2}`) → warn + treat as `1` for safety (preserve legacy behavior rather than apply unknown semantics).

   ### Layer 2 — LLM-based selection (two-tier)

   Layer 2 uses a **two-tier pool** to balance signal quality vs context budget. Claude picks per slot, starting from the primary pool; only falls back to the library when the primary pool has no fit.

   **Primary pool** (always in scope — Claude picks purely on task fit, source is not a priority order):
   - Project agents (`.claude/agents/*.md`) — hand-written or imported via `--add`
   - User agents (`~/.claude/agents/*.md`)
   - AE built-in agents (`plugins/ae/agents/{workflow,review,research}/*.md`)
   - `pipeline.yml project_agents[]` provides metadata overlay (role/priority/specialty/required) on the files in `.claude/agents/` — these hints help Claude judge fit, but do NOT auto-prioritize these agents over equally-fitting built-ins.

   **Library fallback** (scanned only on primary-pool miss):
   - Each entry in `pipeline.yml` `agent_libraries[]` → enumerate `<source>/**/*.md`
   - Apply hard constraints (stack mismatch, `action: exclude`) before presenting to Claude
   - Claude picks an ad-hoc candidate or returns "no fit in library either"

   **Flow per slot** (strict order; Claude only sees what survives Layer 1):
   1. **Force apply**: `action: force` governance rules pre-select the named agent into the team for this slot. **Stack-mismatch interaction is gated by the governance file `schema_version:` field** (see "Governance file schema versioning" above):
      - **schema_version=1 (or missing)**: `force` agents bypass the stack-mismatch filter unconditionally (legacy behavior — preserved for backward compatibility).
      - **schema_version=2** with rule `stack_check: enforce` (default when omitted): if the force agent's `tech_stack` is disjoint from the project's, AE emits `[layer1] force-apply: <agent> stack-mismatch detected; user disposition required` and surfaces `AskUserQuestion` (accept incompatible force / drop this force / abort skill). User disposition is recorded in trace.
      - **schema_version=2** with rule `stack_check: skip`: silently bypass the stack-mismatch filter for this rule, mirroring schema_version=1 behavior; AE emits `[layer1] force-apply: <agent> stack-mismatch SKIPPED via stack_check: skip` for audit.
      - Either way, an `action: exclude` rule on the same agent wins (exclude is the hardest signal).
      - **Trace event supersession** (F-009 Step 2): when a force agent triggers the stack-mismatch path (detected or SKIPPED), the legacy `[layer1] hard-constraint: stack-mismatch filter REMOVED <agent>` event from step 2 below is **suppressed for that agent** — the new force-apply line is the single authoritative record. Hard-constraint stack-mismatch events continue to fire for non-force agents in the normal flow.
   2. **Hard-constraint filter** (mechanical, BEFORE Claude):
      - `action: exclude` governance rules remove the named agent from the candidate pool.
      - Stack-mismatch: agent declares `tech_stack: [X, Y, ...]` in its frontmatter or `pipeline.yml project_agents[]` entry; project declares `tech_stack` at the top level of `pipeline.yml` (source of truth — no file-extension auto-detection). Disjoint sets → filtered out. (For force agents, see step 1 — the supersession rule routes the event through force-apply instead.)
   3. **Prefer annotate**: `action: prefer` rules that fire on this context annotate matching **surviving** agents with the rule's `added_reason` as a context hint. (If a prefer-matched agent was already filtered in step 2, the prefer rule has nothing to annotate — AE records this in the Layer 1 trace as "prefer fired on X but X was filtered".)
   4. **Claude picks**: Claude reads the filtered-and-annotated primary pool + current task context + project CLAUDE.md → picks best fit per [Agent Selection Rubric](../setup/agent-selection-rubric.md).
   5. **Library fallback**: if primary pool has no confident match, Claude scans library fallback (enumerated from `pipeline.yml agent_libraries[]` sources) — same hard-constraint filter applied before Claude sees candidates.
   6. If neither pool has a fit → return "no match; fall through to built-in default for this slot, or prompt user to author a custom agent".

   **Fallback cost discipline**: library scan only triggers on primary miss. For common role slots (reviewer, developer, domain-expert), the primary pool should almost always have a fit — library scan is reserved for genuinely novel task shapes where existing agents don't cover.

   **Layer 1 trace format**: every rule firing and filter action is recorded in a structured trace. Two surfaces, **both default-emit** (no flag required — per `ae:agent-teams` Base Protocol § Selection Trace Emission, BL-058 ship 2026-05-05):

   - **Console stdout** (default-ON): trace is printed before Claude is invoked, one line per event, format: `[layer1] <step>: <rule/filter> <agent-name> → <outcome> (<reason>)`. Example sequence for the prefer+stack-kill test case (no force rule firing on the mismatched agent):
     ```
     [layer1] force-apply: no rules firing in context
     [layer1] hard-constraint: stack-mismatch filter REMOVED phpstan-expert (agent tech_stack [php, laravel] ⊄ project tech_stack [rust, mcp])
     [layer1] prefer-annotate: rule-4 FIRED for phpstan-expert on context [security, audit] → NO-OP (target already filtered)
     [layer1] claude-input: pool = [rust-mcp-expert, ...] (phpstan-expert absent)
     ```

     Example sequence when the mismatched agent IS the target of a `force` rule (governance `schema_version: 2`, `stack_check: enforce`):
     ```
     [layer1] force-apply: phpstan-expert stack-mismatch detected; user disposition required (agent tech_stack [php, laravel] ⊄ project tech_stack [rust, mcp])
     [layer1] force-apply: phpstan-expert user disposition: accept (or: drop / abort)
     [layer1] claude-input: pool = [phpstan-expert, ...] (force-accepted) | [...] (force-dropped) | <skill aborts>
     ```
     Note the absence of the legacy `[layer1] hard-constraint: stack-mismatch filter REMOVED phpstan-expert` line — the force-apply event supersedes it for force agents (see Flow per slot, step 1).

     Example sequence with `schema_version: 1` (legacy) or `schema_version: 2 + stack_check: skip` — silent bypass preserved:
     ```
     [layer1] governance schema_version=1 (legacy); add `schema_version: 2` to opt into safer force-vs-stack handling. See CHANGELOG entry for F-009 Step 2 migration.
     [layer1] force-apply: phpstan-expert stack-mismatch SKIPPED via stack_check: skip (or: schema_version=1 legacy bypass)
     [layer1] claude-input: pool = [phpstan-expert, ...]
     ```
   - **Team-lead synthesis report** (default-ON, end of skill run): a `## Agent Selection Trace` section in the report summarizes the Layer 1 events for this invocation. Same structured format as the stdout surface but embedded in the skill's final written output, so it persists beyond the console session.

   This is the audit path for "did the prefer hint reach Claude, or was it filtered first?" — the trace shows every Layer 1 event with explicit outcome, so the user can verify AE enforced the governance contract before Claude's pick.

   **Layer 2 trace format** (symmetric to Layer 1; permanent observability feature, not validation scaffolding): every Claude pick is recorded with its candidate pool and source. Format:

   ```
   [layer2] considered: [<agent-1>, <agent-2>, ...] from <pool: primary|library>
   [layer2] selected: <agent-name> from <source: project|user|builtin|library>
   [layer2] rationale: <one-line task-fit reason; names rejected candidates by name>
   [layer2] library-fallback: <fired|not-fired>
   ```

   - `considered:` lists the agent names Claude evaluated (post Layer-1 filtering). The pool field disambiguates whether this was the primary pool or a library-fallback scan.
   - `selected:` names the winning agent and its source pool. `source: project` = `.claude/agents/`; `source: user` = `~/.claude/agents/`; `source: builtin` = `plugins/ae/agents/`; `source: library` = enumerated from `agent_libraries[]`.
   - `rationale:` explains the pick in one line. When primary candidates were rejected, it names them by name (so the audit shows what was considered, not just what won).
   - `library-fallback:` records whether the library scan fired (`fired` = primary pool had no fit, library was scanned; `not-fired` = primary pool had a confident match).

   Both surfaces (stdout AND Team-lead synthesis report) are default-ON and emit Layer 1 AND Layer 2 events. The synthesis report's `## Agent Selection Trace` section includes both layers. Enforcement and mechanical verification rules live in `ae:agent-teams` Base Protocol § Selection Trace Emission.

   **Canonical placeholder for `subagent_type:` fields**: consumer skills that delegate agent selection to this dispatcher MUST use the literal string `<per agent-selection>` as the `subagent_type:` value in their team-spawn templates (e.g., `Agent(subagent_type: "<per agent-selection>", name: "<role-name>", ...)`). When a consumer skill uses this placeholder, the team-lead resolves the actual agent via the Layer 1/2/3 chain at spawn time. Hardcoded values (e.g., `subagent_type: "qa"`) are reserved for **structurally fixed roles** that are not content-driven (qa as dev-counterpart, challenger as pure-opposition) — these MUST carry an inline annotation comment explaining the intentional hardcoding.

   - No numerical scores, no thresholds — Claude either has a confident match (primary or fallback) or returns no match.
   - Task fit → stack compatibility → role coverage → specialty specificity is the rubric priority order.

   ### Layer 3 — User one-pick (lightweight disambiguation)

   Triggered when Layer 2 returns multiple viable candidates and Claude's judgment is not confident (e.g., 2-3 candidates look similarly plausible for the task). AE surfaces a 3-option numbered menu via AskUserQuestion with 1-line rationale per option. Max 3 candidates shown.

   Layer 3 is intentionally lightweight — NOT a full `ae:consensus` Debate Mode. User picks and the skill continues. Respects user attention budget.

   Skipped in `ae:discuss` multi-instance contexts (discuss spawns multiple of same role by design; no disambiguation needed).

   ### Phase 1 precedence semantics (best-N + priority)

   For role-slot filling:

   1. `project_agents[].required: true` agents (always spawn)
   2. Layer 1 `force` matches (always spawn)
   3. Remaining candidates picked by Claude per Layer 2 rubric, with Layer 1 `prefer` rules and `project_agents[].priority: <int>` as context hints
   4. Cap at N=3 per role slot (Phase 1 hardcoded default)

   **Spawning**: use agent filename stem as `subagent_type` — CC resolves `.claude/agents/<stem>.md` automatically.

   ### Debug flag (legacy)

   `--agent-debug` on any skill is documented in `ae:setup/agent-governance-format.md:177` as the historical entry point for surfacing the 3-layer decision tree. As of BL-058 (v0.9.4), the trace is **default-ON** at both stdout and synthesis-report surfaces — the flag is now a no-op alias preserved for backward compatibility. Future `--quiet` flag MAY suppress emission; not currently scoped.
5. **Show selected team** to user before launching. User can adjust.

## Cross-family Prompt Reference

TL 根据 context 决定外部专家从什么角度审查。以下是常见角度的 prompt 示例：

| Review Angle | Specialized Prompt Focus |
|-------------|------------------------|
| Data integrity | "Review for data integrity, index strategy, rollback safety, zero-downtime migration" |
| Security | "Review for authentication bypass, token lifecycle, injection vectors, secrets exposure" |
| API contract | "Review for backwards compatibility, error handling, versioning, contract violations" |
| Performance | "Review for query efficiency, N+1 patterns, caching strategy, memory allocation" |
| Architecture | "Review for module boundaries, dependency direction, separation of concerns" |
| Scope & risks | "Review for hidden dependencies, scope completeness, edge cases, integration risks" |
| Plan quality | "Review for step decomposition quality, dependency accuracy, AC verifiability" |

Default to different angles for each proxy. Same-angle is acceptable only when there is genuinely no second valuable blind spot to cover.

## Proxy Timeout Protocol

All skills that launch proxy agents MUST include timeout protection and fallback to prevent hangs and preserve cross-family signal.

### Proxy prompt suffix (add to every codex-proxy / gemini-proxy prompt)
```
If MCP connection fails, times out (120s), is rate-limited, or quota is exhausted:
SendMessage to team-lead: "unavailable: [reason]" (reason = timeout | connection | rate_limit | quota_exhausted).
Then exit immediately. Do not retry.
```

### TL fallback logic (TL executes this, not subagent leads)
```
On proxy "unavailable" message:
1. Identify the failed proxy's review angle.
2. Is that angle already covered by another active agent (proxy or Claude)?
   → Drop the failed proxy. No replacement needed.
3. Angle NOT covered → try other proxy family first:
   a. Other family enabled and not also failed?
      → Spawn replacement proxy from other family with that angle.
   b. Other family also failed or not enabled?
      → Spawn a Claude agent (model by task complexity: opus/sonnet/haiku) with that angle.
4. All proxies failed?
   → Spawn Claude agent(s) for uncovered angles, or mark cross_family_degraded if
     all angles are already covered by Claude agents.
TL must actually spawn and prompt the replacement, not just announce it.
TL tracks proxy availability within the current Agent Team — do not re-spawn
a proxy that already reported unavailable in this team.
```

### Lead/challenger prompt suffix (when proxies are in team)
```
If a proxy has not responded within 120s, notify TL that proxy is unresponsive. TL handles fallback.
```

Skills reference this protocol instead of defining their own timeout or fallback logic.
