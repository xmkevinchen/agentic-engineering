---
name: agent-selection
description: "Reference: agent selection reference — context-based team composition and cross-family role assignment. Used by skills that create Agent Teams."
user-invocable: true
---

# Agent Selection Reference

Every skill that builds an Agent Team references this table.

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

### Negative / disambiguation signals (soft-add calibration — BL-180)

The table above lists **positive** triggers. Adding a specialist lens requires *positive evidence for that lens's actual concern in the diff*, never a surface keyword match. Common false-positive disambiguations:

- A tight **game/render/update loop is NOT** by itself a `performance` signal — `performance` needs an actual hot-path, query, allocation, or scaling concern. A fixed-size in-memory game core is not a performance surface. **Positive counter-example (the disqualifier is "by itself", not the loop shape)**: a game/render loop that DOES allocate per-frame, runs an O(n²) scan, or issues a query *inside* the loop IS a `performance` concern → still ADD the lens. Withhold on loop-shape alone, never on a loop with a real hot-path.
- A **config / constant / copy** change is NOT a `security` signal unless it touches auth / tokens / secrets / permissions.
- A **large or multi-file diff** is NOT by itself an `architecture` signal — architecture needs a module-boundary / dependency-direction / contract change, not mere line count.

These are calibration examples, not exhaustive: the rule is **positive evidence** for the lens's real concern, never a keyword. (The soft-add trace records the selection; it does not prove the judgment — see review/SKILL.md §0.)

## Rules

1. **Pick 2-4 core agents** from the table. Multiple rows can match — combine.
2. **Always add challenger** to any team with 3+ agents.
3. **Cross-family**: external experts brought in for specific review angles.
   - Read the `cross_family` **family-instance table** from pipeline.yml. Each entry's key is
     an instance label; `seat` names the definition that reaches it
     (`agents/workflow/<seat>-proxy.md`), `family` is the weight lineage, `host` is where the
     weights run. Presence means enabled; `enabled: false` switches an entry off.
   - **Seats are not families.** `codex-proxy` and `gemini-proxy` front one backend each;
     `openai-compat-proxy` is the generic seat and fronts **any number** of entries, taking
     `endpoint`, `model` and `family` per call. So the roster is the table's enabled entries,
     not the set of proxy definition files — and adding a family on the generic seat adds no
     file and touches no skill.
   - When spawning an entry on the generic seat, pass its `endpoint`, `model`, `family` and
     `api_key_env` through to the proxy; that seat cannot reach a backend without them. A
     keyed backend needs the last one for the same reason it needs the first: without it the
     bridge falls back to the one process-wide key, which is the shape `api_key_env` exists
     to replace (`BL-214`, `BL-219`).
   - **Coverage counts distinct `family`, never distinct label.** Two entries of one lineage —
     say a hosted DeepSeek and a local DeepSeek build — are one independent opinion, not two.
     Counting them separately inflates cross-family coverage with correlated failure modes
     (`BL-208`). Prefer angles across *different* lineages before adding a second entry of one.
   - A bare `codex: true` / `gemini: true` map is the legacy form and is still read, treated as
     `{seat: <label>, family: <label>}`. It cannot express endpoint, host or lineage, so a
     project on the legacy form can only ever have one entry per seat.
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

   **Precedence (Rule 4 core)**: pipeline.yml explicit `role:` overrides frontmatter-inferred role for role-slot mapping. Project agents do NOT auto-prioritize over built-ins by virtue of source — see [Project-agent precedence](#project-agent-precedence) for the single canonical rule. Full precedence ladder is under "Phase 1 precedence semantics" below.

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

   ### Governance file schema versioning

   **Placement — top-level YAML field inside the governance YAML code block** (NOT markdown `---` frontmatter): the governance file (`.claude/agent-governance.md`) is a markdown file with a YAML code block (\`\`\`yaml ... \`\`\`); `schema_version:` is a top-level field inside that YAML block, sibling to `rules:`. It is NOT inside an individual rule entry, and NOT a markdown `---` frontmatter field at the head of the file.

   Concrete placement:

   ```yaml
   schema_version: 2 # ← top-level, sibling to `rules:`
   rules:
     - action: force
       agent: php-test-reviewer
       stack_check: enforce # ← per-rule field, only valid under schema_version: 2
   ```

   Missing top-level `schema_version:` defaults to `1` (legacy). Recognized values:

   - **`schema_version: 1` (legacy)** — preserves the pre-F-009 behavior: `action: force` rules short-circuit Layers 2+3 AND bypass the stack-mismatch filter unconditionally (the user is presumed to have explicitly overridden fit judgment by writing the force rule). On every invocation of a skill that loads a `schema_version=1` (or missing) governance file, emit trace warning (no across-invocation persistence — LLM prompt has no session-level memory; the warning is per-invocation, not literally once-per-file-lifetime):
     ```
     [layer1] governance schema_version=1 (legacy); add `schema_version: 2` to opt into safer force-vs-stack handling. See CHANGELOG entry for F-009 Step 2 migration.
     ```
   - **`schema_version: 2` (current)** — the force agent goes through the stack-mismatch filter by default. To preserve the legacy bypass on a specific rule, declare it explicitly with a new per-rule field:
     - `stack_check: enforce` (default when omitted from a rule under `schema_version: 2`) — stack-mismatch on this force agent triggers `AskUserQuestion` (accept incompatible force / drop this force / abort skill). User disposition is recorded in trace.
     - `stack_check: skip` — silently bypass the stack-mismatch filter for this rule, matching legacy schema_version=1 behavior; trace records the bypass for audit.

   Unknown top-level `schema_version:` value (anything outside `{1, 2}`) → emit trace warning `[layer1] governance unknown schema_version=<value>; treating as schema_version=1` and follow the v1 legacy branch (preserve current behavior rather than apply unknown semantics).

   <a name="project-agent-precedence"></a>

   ### Project-agent precedence — single canonical rule

   `project_agents[]` does NOT receive a priority bonus over built-ins. The only paths by which `project_agents[]` entries reach a slot ahead of an equally-fitting built-in are:

   - (a) `required: true` — always-spawn override (deterministic; bypasses Layer 2 selection for that slot).
   - (b) `priority: <int>` — Layer 2 **context hint** for Claude's pick (NOT a mechanical weighting bonus; Claude weighs it alongside task fit).
   - (c) `role` / `specialty` metadata — helps Claude judge fit during Layer 2; ties are NOT broken in `project_agents[]`'s favor by virtue of source.

   "Project agents are preferred over built-ins" is an **incorrect framing**. The Layer 2 rubric (task fit → stack compatibility → role coverage → specialty specificity) treats project, user, plugin built-in, and library sources as a single pool once they reach Claude — source is metadata, not priority. All other passages in this document that mention `project_agents` precedence cross-reference back to this section.

   ### Layer 2 — LLM-based selection (two-tier)

   Layer 2 uses a **two-tier pool** to balance signal quality vs context budget. Claude picks per slot, starting from the primary pool; only falls back to the library when the primary pool has no fit.

   **Primary pool** (always in scope — Claude picks purely on task fit, source is not a priority order):
   - Project agents (`.claude/agents/*.md`) — hand-written or imported via `--add`
   - User agents (`~/.claude/agents/*.md`)
   - AE built-in agents (`plugins/ae/agents/{workflow,review,research}/*.md`)
   - `pipeline.yml project_agents[]` provides metadata overlay (role/priority/specialty/required) on the files in `.claude/agents/` — these hints help Claude judge fit, but do NOT auto-prioritize these agents over equally-fitting built-ins. See [Project-agent precedence](#project-agent-precedence) for the single canonical rule.

   **Library fallback** (scanned only on primary-pool miss):
   - Each entry in `pipeline.yml` `agent_libraries[]` → enumerate `<source>/**/*.md`
   - Apply hard constraints (stack mismatch, `action: exclude`) before presenting to Claude
   - Claude picks an ad-hoc candidate or returns "no fit in library either"

   **Flow per slot** (strict order; Claude only sees what survives Layer 1):
   1. **Force apply**: `action: force` governance rules pre-select the named agent into the team for this slot. **Stack-mismatch interaction is gated by the governance file `schema_version:` field** (see "Governance file schema versioning" above):
      - **schema_version=1 (or missing)**: `force` agents bypass the stack-mismatch filter unconditionally (legacy behavior — preserved for backward compatibility). No per-invocation bypass-event trace line is emitted (only the schema_version=1 deprecation warning fires).
      - **schema_version=unknown** (any value outside `{1, 2}`): emit trace warning `[layer1] governance unknown schema_version=<value>; treating as schema_version=1` and fall through to the v1 branch above.
      - **schema_version=2** with rule `stack_check: enforce` (default when omitted from a rule under v2): if the force agent's `tech_stack` is disjoint from the project's, AE emits `[layer1] force-apply: <agent> stack-mismatch detected; user disposition required` and surfaces `AskUserQuestion` (accept incompatible force / drop this force / abort skill). User disposition is recorded in trace.
      - **schema_version=2** with rule `stack_check: skip`: silently bypass the stack-mismatch filter for this rule, mirroring schema_version=1 behavior; AE emits `[layer1] force-apply: <agent> stack-mismatch SKIPPED via stack_check: skip` for audit.
      - Either way, an `action: exclude` rule on the same agent wins (exclude is the hardest signal).
      - **Trace event supersession**: when a force agent triggers the stack-mismatch path under `schema_version=2` (detected or SKIPPED), the legacy `[layer1] hard-constraint: stack-mismatch filter REMOVED <agent>` event from step 2 below is **suppressed for that agent** — the new force-apply line is the single authoritative record. Under `schema_version=1` legacy bypass, neither line fires for the force agent (silent bypass is the documented v1 behavior). Hard-constraint stack-mismatch events continue to fire for non-force agents in the normal flow regardless of schema_version.
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

     Example sequence — `schema_version: 2`, force-rule on stack-mismatched agent, `stack_check: enforce` explicit:
     ```
     [layer1] force-apply: phpstan-expert stack-mismatch detected; user disposition required (agent tech_stack [php, laravel] ⊄ project tech_stack [rust, mcp])
     [layer1] force-apply: phpstan-expert user disposition: accept (or: drop / abort)
     [layer1] claude-input: pool = [phpstan-expert, ...] (force-accepted) | [...] (force-dropped) | <skill aborts>
     ```
     Note the absence of the legacy `[layer1] hard-constraint: stack-mismatch filter REMOVED phpstan-expert` line — the force-apply event supersedes it for force agents under v2 (see Flow per slot, step 1).

     Example sequence — `schema_version: 2`, force-rule on stack-mismatched agent, `stack_check` field **omitted** (default-enforce path):
     ```
     [layer1] force-apply: phpstan-expert stack-mismatch detected; user disposition required (agent tech_stack [php, laravel] ⊄ project tech_stack [rust, mcp]); stack_check field omitted, defaulted to enforce
     [layer1] force-apply: phpstan-expert user disposition: accept (or: drop / abort)
     ```
     The default-enforce path is functionally identical to explicit `stack_check: enforce`; the trace appends `; stack_check field omitted, defaulted to enforce` so audit can distinguish explicit-enforce from default-enforce when investigating a governance file.

     Example sequence — `schema_version: 2`, force-rule on stack-mismatched agent, `stack_check: skip` (explicit opt-out preserving legacy bypass):
     ```
     [layer1] force-apply: phpstan-expert stack-mismatch SKIPPED via stack_check: skip
     [layer1] claude-input: pool = [phpstan-expert, ...]
     ```

     Example sequence — `schema_version: 1` (legacy, or missing field) — silent unconditional bypass; only the deprecation warning fires:
     ```
     [layer1] governance schema_version=1 (legacy); add `schema_version: 2` to opt into safer force-vs-stack handling. See CHANGELOG entry for F-009 Step 2 migration.
     [layer1] claude-input: pool = [phpstan-expert, ...]
     ```
     Note: NO `[layer1] force-apply: ... stack-mismatch ...` event in this path — v1 legacy bypass is unconditional and silent on the force-rule side. The deprecation warning is the only schema_version=1-specific trace line.

     Example sequence — `schema_version: 99` (unknown value) — falls through to v1:
     ```
     [layer1] governance unknown schema_version=99; treating as schema_version=1
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

   For role-slot filling (see [Project-agent precedence](#project-agent-precedence) for the canonical rule that frames this ladder — items 1 and 3 here are precisely the (a) and (b) clauses there):

   1. `project_agents[].required: true` agents (always spawn) — clause (a) of the canonical rule
   2. Layer 1 `force` matches (always spawn)
   3. Remaining candidates picked by Claude per Layer 2 rubric, with Layer 1 `prefer` rules and `project_agents[].priority: <int>` as context hints (NOT mechanical weighting) — clause (b) of the canonical rule
   4. Cap at N=3 per role slot (Phase 1 hardcoded default)

   **Spawning**: use agent filename stem as `subagent_type` — CC resolves `.claude/agents/<stem>.md` automatically.

   ### Debug flag (legacy)

   `--agent-debug` on any skill is documented in `ae:setup/agent-governance-format.md:177` as the historical entry point for surfacing the 3-layer decision tree. As of BL-058 (v0.9.4), the trace is **default-ON** at both stdout and synthesis-report surfaces — the flag is now a no-op alias preserved for backward compatibility. Future `--quiet` flag MAY suppress emission; not currently scoped.
5. **Show selected team** to user before launching. User can adjust.

## Cross-family Prompt Reference

TL decides from which angle the external expert should review based on context. Common angles with example prompt phrasing:

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

### Proxy spawn precondition (check BEFORE spawning)

**Do not spawn a cross-family proxy whose backend MCP tool is absent from the TL's tool list.** Treat the family as `unavailable` and run the TL fallback logic below, exactly as if the proxy had reported it.

The TL's tool list is the check: a plugin MCP server that failed to launch registers no tools, so `mcp__plugin_ae_gemini__*` / `mcp__plugin_ae_codex__*` simply are not present. That fact sits in the TL's context at spawn-decision time — before any agent runs, and before any verdict exists to evaluate.

**"Absent" means absent after deferred-tool resolution.** A configured, working MCP tool may not appear in the immediately-callable list until `ToolSearch` surfaces it — deferred tools are listed by name and are resolvable, not missing. Resolve first, conclude absence second. Skipping that step turns a reachable backend into a false `unavailable`, which is the same class of error in the opposite direction.

**Entering the fallback state machine is required, not optional.** "TL fallback logic" below fires `On proxy "unavailable" message` — and a proxy that was never spawned sends no message. A precondition skip MUST therefore enter that logic directly, at step 1, as if the message had arrived.

**The TL writes the failure record itself on a precondition skip.** The WAL's `cross-family-proxy-failure` record is normally written by the proxy at its own failure boundary (see "Proxy prompt suffix") — but a proxy that was never spawned cannot write it. Without a TL-side write, a skip that ends in genuine degradation produces *neither* a failure record nor a covered record: not the "unmatched failure" the WAL is built to detect, but total absence, invisible to any reader. So the TL runs the same script the proxy would have:

```
mkdir -p "$HOME/.ae/traces" || true; bash "${CLAUDE_PLUGIN_ROOT:-}/scripts/append-cross-family-trace.sh" failure "<skill>" "<feature_id>" "<angle>" "<family>" connection 2>>"$HOME/.ae/traces/append-cross-family.log" || true
```

`connection` is the correct reason value: the MCP connection was never established (a server that fails to launch is exactly the exit-127 / handshake-`-32000` case). The TL knows all five arguments at skip time. The leading `mkdir` is load-bearing for the same reason it is on the sibling calls — the shell opens the `2>>` redirect before the script runs, so on a fresh `~/.ae/traces/` the open fails, `|| true` swallows it, and the record vanishes silently. A precondition skip is a likely *first* cross-family event of a session, so this path hits that case more often than the others.

Then follow "TL fallback logic" from step 1 as normal — including its step 4 rule that **Claude-family coverage IS the degraded state**: re-covering the angle with a Claude agent still sets `cross_family_degraded`, and still writes NO `covered` record (`covered` is reserved for non-Claude resolution; the unmatched failure record is the durable degraded signal).

**Boundary — what this does NOT cover.** State it here once; do not repeat it at echo sites.

- **Credentials that are present but dead.** The Gemini server's `initAuth` checks only that `GEMINI_API_KEY` is non-empty and makes no network call, so an expired, revoked, or quota-exhausted key launches the server, registers the tools, and passes this precondition. The first real call is what fails.
- **Mid-session backend death.** A backend reachable at spawn can exhaust quota or time out later in the run. This check fires once, at spawn.
- **A proxy that has its tool and does not call it.** Presence of a tool is not evidence of its use.
- **A backend that is slow rather than absent.** Absence of a call artifact at a point in time proves only that no call had completed by then. Distinguishing "not yet" from "never" needs a terminal marker — an explicit `unavailable` report or end-of-turn — not a snapshot.

This precondition closes the backend-absent-at-spawn window only — the window that had no mechanism at all. It is not a provenance guarantee, and reporting it as one would overstate what a tool-list check can establish.

### Proxy prompt suffix (add to every codex-proxy / gemini-proxy prompt)
```
If MCP connection fails, times out (120s), is rate-limited, or quota is exhausted:
SendMessage to team-lead: "unavailable: [reason]" (reason = timeout | connection | rate_limit | quota_exhausted).
Then write the durable-failure record (one line), then exit immediately. Do not retry:
mkdir -p "$HOME/.ae/traces" || true; bash "${CLAUDE_PLUGIN_ROOT:-}/scripts/append-cross-family-trace.sh" failure "<skill>" "<feature_id>" "<angle>" "<family>" "[reason]" 2>>"$HOME/.ae/traces/append-cross-family.log" || true
```

**Spawn-time literal inlining (F-031).** The TL spawning the proxy MUST substitute `<skill>`, `<feature_id>`, `<angle>`, `<family>` as **literals** in the suffix above at spawn time — the TL knows all four (it is choosing the skill, feature, angle, and family). The proxy fills only `[reason]` (the same token it already picks for its `unavailable:` message). This keeps the WAL join key populated by construction rather than asking a haiku proxy to derive values from its Cast block. `<feature_id>` may be empty — pass `""`. The `${CLAUDE_PLUGIN_ROOT:-}` guard + `|| true` make an unset plugin-root (e.g. dev-from-source) a graceful no-op; stderr appends to a log (NOT `/dev/null`) so a missing-record diagnosis stays possible. The leading `mkdir -p "$HOME/.ae/traces"` is load-bearing: the shell opens the `2>>…/append-cross-family.log` redirect target BEFORE the script runs, so on a fresh `~/.ae/traces/` (first write of a session, before any `write-trace.sh` call created the dir) the open fails, `|| true` swallows it, and the record vanishes silently — exactly the durability case the WAL exists for. Do not remove the `mkdir`. This is the durable half of the cross-family WAL: it survives a detached/compacted TL because the **proxy**, not the TL, writes it. See `docs/references/trace-schema.md` rows 4+5.

### TL fallback logic (TL executes this, not subagent leads)
```
On proxy "unavailable" message:
1. Identify the failed proxy's review angle.
2. Is that angle already covered by another active agent (proxy or Claude)?
   → Drop the failed proxy. No replacement needed.
3. Angle NOT covered → try other proxy family first:
   a. Other family enabled and not also failed?
      → Spawn replacement proxy from other family with that angle.
        On success (angle now covered by a NON-Claude family), write the resolution
        half of the cross-family WAL (F-031):
        mkdir -p "$HOME/.ae/traces" || true; bash "${CLAUDE_PLUGIN_ROOT:-}/scripts/append-cross-family-trace.sh" covered "<skill>" "<feature_id>" "<angle>" "<resolution_family>" 2>>"$HOME/.ae/traces/append-cross-family.log" || true
   b. Other family also failed or not enabled?
      → Spawn a Claude agent (model by task complexity: opus/sonnet/haiku) with that angle.
4. All proxies failed?
   → Spawn Claude agent(s) for uncovered angles, or mark cross_family_degraded if
     all angles are already covered by Claude agents.
   → Claude-family coverage IS the degraded state, so do NOT write a `covered`
     resolution record here (F-031). The proxy's unmatched `cross-family-proxy-failure`
     record is the durable degraded signal; `covered` is reserved for NON-Claude
     fallback (step 3a) only.
TL must actually spawn and prompt the replacement, not just announce it.
TL tracks proxy availability within the current Agent Team — do not re-spawn
a proxy that already reported unavailable in this team.
```

**F-031 cross-family WAL.** The two `append-cross-family-trace.sh` calls above form a paired tombstone-via-omission record. A `cross-family-proxy-failure` (written by the proxy, see "Proxy prompt suffix") with a matching `cross-family-angle-covered` (written here by the TL on non-Claude fallback) = routine fallback, angle covered, NOT degraded. A failure record with NO matching covered record = genuine degradation (uncovered angle, OR the TL never reached this fallback because it was detached/compacted). Consumers join on `(skill, feature_id, angle)` — the failure record names the angle `angle_lost` and the covered record names it `angle`, so normalize `failure.angle_lost == covered.angle` at join time (full reader contract: `docs/references/trace-schema.md` consumer obligation 6). The TL inlines `<skill>`/`<feature_id>`/`<angle>`/`<resolution_family>` as literals (it knows all four). "Tier" (advisory vs gating) is a property of the *consumer* that reads these records, not of the emitter — today the only gating consumer is `ae:work` autopass. See `docs/references/trace-schema.md` rows 4+5.

### Acceptance rule — a verdict without its receipt does not count

**State it as absence-detection, never as presence-verification.** A verdict arriving *without* its receipt is **inadmissible for aggregation: it MUST NOT influence any downstream decision** — quorum, coverage and approval are today's consumers, named as examples and not as an exhaustive list, so a future consumer is not a silent hole.

Receipt **absence** proves the proxy did not report running its backend. Receipt **presence** proves nothing: the receipt is agent-authored, and an agent that would skip the call would equally emit the receipt. A correlator does not authenticate a verdict either — it only removes one way of failing to disqualify one. Nothing in this rule establishes that a call happened; it establishes when a verdict may not be relied upon.

**Admissibility is a filtering step, not a principle.** Consumers MUST partition verdicts into admissible and inadmissible *before* running their own rules, and inadmissible verdicts must be invisible to every subsequent count, threshold and coverage test. A rule stated beside an aggregation state machine rather than wired into it does not fire — see `discuss/SKILL.md` §1.5.3 Rule 0 for the worked wiring.

**Current coverage — do not read the MUST above as already satisfied everywhere.** Only `ae:discuss` implements the filter today. `ae:review`, `ae:plan-review` and `ae:consensus` aggregate cross-family verdicts without it, deliberately: whether their "approval" surfaces collapse into coverage once this lands is unverified, and extending the filter on an unverified assumption is how a rule ends up stated in more places than it works. The MUST is the contract for a consumer that adopts it, not a claim about present reach.

**Escape hatch — load-bearing, not optional.** A round may still close in the absence of a receipt-backed verdict, by either:
- another reviewer whose verdict is admissible, or
- an explicit user-accepted degraded-coverage decision — **explicit** meaning the user was shown which coverage is missing and chose to proceed anyway. An orchestrator deciding on the user's behalf that degraded coverage is acceptable is not this escape hatch; it is the failure the rule exists to prevent, wearing the hatch's name.

Without this, the rule collapses quorum wherever proxies are a counted share of it, and the practical effect is to disable the very cross-family reviewers it is meant to protect.

**Producer inventory — do not imply parity.** Today `codex-proxy` has a receipt mechanism (`[EFFORT-CONFIRM]`, `codex-proxy.md`) and `gemini-proxy` has none at all. State the consequence at full strength: a Gemini verdict carries no receipt, is therefore inadmissible under this rule, and **does not count toward quorum at all** — not merely "cannot close a round alone". Until Gemini gains a receipt mechanism, enabling it buys no admissible coverage, and any wording that softens this understates what the rule does to the family it names. That asymmetry is a capability gap, not a ranking, and it is the current state rather than a target state.

**The receipt MUST carry a correlator** — the backend call's own identifier (for Codex, the thread id. A receipt without one cannot be *disqualified* by anything: there is no artifact to contradict it, so it can only be taken on faith. With one, a mismatch against the agent-unwritten artifact is detectable — which is strictly weaker than proof that the call happened. Correlating by timestamp instead works only when a single call is in flight, and silently stops working the moment two proxies run concurrently.

**Recognising the unavailable state.** Two forms are currently documented and BOTH count: `[QUOTA] <Family> unavailable — <reason>` (the agent definitions) and `unavailable: <reason>` (the prompt suffix at `:294`). Accept either. This is tolerance of a known inconsistency, not endorsement — see BL-202.

**A missing artifact is not a failed call.** Absence of a call artifact at a point in time proves only that no call had completed *by then*. Distinguishing "not yet" from "never" requires a terminal marker — an explicit unavailable report, or end-of-turn — never a snapshot of a directory or a tool list. Treating a slow backend as a failed one produces false degradation.

### Lead/challenger prompt suffix (when proxies are in team)
```
If a proxy has not responded within 120s, notify TL that proxy is unresponsive. TL handles fallback.
```

Skills reference this protocol instead of defining their own timeout or fallback logic.
