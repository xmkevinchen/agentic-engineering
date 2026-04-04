---
id: "021"
title: "Claude Code Source Analysis — AE Plugin Capability Uplift — Conclusion"
concluded: 2026-04-04
plan: ".ae/plans/024-cc-uplift-master.md"
---

# Claude Code Source Analysis — Conclusion

## Decision Summary (Converged)

| # | Topic | Decision | Rationale | Reversibility |
|---|-------|----------|-----------|---------------|
| 1 | Low-Hanging Fruits | Execute P0 in 3 batches (A→B→C) by risk level | All items independent; batching by risk allows fastest safe delivery | high |
| 2 | Experimental Dependencies | 3-phase execution (config → validated experiments → architecture) | Most P1 items parallel; only context:fork is validation-gated | high |
| 3 | Docs Consolidation | 2 docs: references/ API spec + decisions/ conclusion. English, corrected findings only | Follows repo conventions; separates stable reference from changing backlog | high |

## Execution Phases

### P0 — Zero Risk (completed)

| Change | Scope | Status |
|--------|-------|--------|
| Agent `color` by role group | All 17 agents | Done (7ad4a62) |
| Agent `effort` tiering | All 17 agents | Done (60be9b4) |
| Agent `omitClaudeMd: true` | 8 safe agents | Done (60be9b4) |
| Agent `maxTurns` | All 17 agents | Done (86c5999) |
| Skill `user-invocable` audit | All 17 skills | Done (7ad4a62) |
| Proxy `model: haiku` validation | codex-proxy, gemini-proxy | Done (5f7d2bc, 620acaa) |

### P1 — Config, Docs, Agents (in progress)

| ID | Feature | Branch | Status |
|----|---------|--------|--------|
| BL-CC-005 | Plugin `userConfig` (3 keys) | feature/cc-uplift-p1-config | Pending |
| BL-CC-029 | OutputStyles (.md files + plugin.json) | feature/cc-uplift-p1-config | Pending |
| BL-CC-028 | MCP tools `alwaysLoad` | feature/cc-uplift-p1-config | Pending |
| BL-CC-033 | Gemini model externalization via userConfig | feature/cc-uplift-p1-config | Pending |
| BL-CC-009 | Agent `skills` preloading | feature/cc-uplift-p1-agents | Pending |
| BL-CC-036 | MCP tool name centralization | feature/cc-uplift-p1-agents | Pending |
| BL-CC-030 | Worktree auto-memory disable | feature/cc-uplift-p1-agents | Pending |

### P2 — Validated Experiments (deferred)

| ID | Feature | Validation Needed |
|----|---------|-------------------|
| BL-CC-032 | `tengu_slim_subagent_claudemd` impact | Assess what agents actually receive |
| BL-CC-031 | Skill content front-loading | Measure skill sizes vs 5K post-compact budget |
| BL-CC-007 | Skill-level hooks | Evaluate command-type hook value |

### P3 — Architecture (deferred)

| ID | Feature | Blocker |
|----|---------|---------|
| BL-CC-006 | `context: fork` for heavy skills | Validate fork+TeamCreate feasibility |
| BL-CC-011 | Memory system integration | Architecture design needed |
| BL-CC-034 | Agent Teams degradation path | User decision pending |
| BL-CC-037 | ae:plan/ae:review thin wrapper | Strategic decision pending CC feature evolution |

## Risk Register

| Risk | Probability | Impact | Mitigation |
|------|------------|--------|------------|
| Agent Teams flag disabled (`tengu_amber_flint`) | Medium | Fatal (10/17 skills) | BL-CC-034 (P3 — degradation path) |
| Gemini model name deprecation (`gemini-2.5-*`) | High | Cross-family degraded | BL-CC-033 (P1 — externalize via userConfig) |
| Built-in feature competition (UltraPlan, UltraReview) | High | Partial replacement | Moat definition (see below) |
| MCP naming convention change | Low | 9+ files to update | BL-CC-036 (P1 — centralization) |
| Plugin schema strictness increase | Medium | Install failure | P0 field name fixes (done) |

## AE Moat Definition

### Irreplaceable (CC will not build these)

1. **Cross-family by default** — Codex/Gemini provide independent perspectives from different AI families. CC will not embed competitor models.
2. **Structured decision records** — `docs/decisions/` lifecycle with topic convergence, Doodlestein review, and conclusion format. CC's autoDream is unstructured.
3. **Plugin behavioral testing** — ae:test-plugin blind protocol (prompts/assertions split, LLM-as-judge). No CC equivalent.
4. **Pipeline continuity** — discuss→plan→work→review cross-session state management with auto-pass gate.

### At Risk of CC Replacement

- ae:plan → UltraPlan exists (keyword-triggered, CCR remote session)
- ae:review → UltraReview exists
- ae:think → Extended thinking built-in
- ae:team → Coordinator mode exists (different architecture but overlapping use case)

### Strategic Position

AE's value is **structural independence**, not capability compensation. Extended thinking cannot replace "fresh eyes that haven't seen the code" or "independent judgment from a different AI family". The moat is in structure, not ability.

## Agent Override Mechanism

Projects can override any AE plugin agent by placing a same-named `.md` file in `.claude/agents/`. The override priority (ascending):

1. built-in → 2. plugin → 3. userSettings → 4. projectSettings → 5. flagSettings → 6. policySettings

A project-level agent with the same `name` as an AE agent fully replaces it. This allows teams to customize AE behavior (e.g., a stricter security-reviewer or domain-specific architect) without forking the plugin.

## Security Boundaries

Plugin agents are sandboxed:
- Cannot set `permissionMode`, per-agent `hooks`, or `mcpServers` (silently stripped)
- Cannot declare inline MCP servers
- Can set: `tools`, `disallowedTools`, `skills`, `model`, `effort`, `maxTurns`, `background`, `isolation`, `initialPrompt`, `memory`, `color`, `omitClaudeMd`

Plugin-level hooks and MCP servers (in plugin.json) are not restricted.

## Doodlestein Review

| Agent | Challenge | Resolution |
|-------|-----------|------------|
| Strategic | Proxy `effort: low` wrongly in Batch B | Accepted: moved to Batch A |
| Adversarial | security/performance-reviewer need CLAUDE.md | Accepted: omitClaudeMd safe list reduced to 8 |
| Adversarial | Haiku single execution insufficient | Accepted: minimum 2 executions required |
| Regret | maxTurns values most likely to reverse | Accepted: all values bumped ~1.5x conservative-high |

## Team Composition

| Agent | Role | Backend | Joined |
|-------|------|---------|--------|
| TL | Moderator | Claude | Start |
| architect | Execution plan design | Claude (Sonnet) | Round 1 |
| dependency-analyst | Dependency validation | Claude (Sonnet) | Round 1 |
| codex-proxy | Frontmatter validation | Codex (OpenAI) | Round 1 |
| gemini-proxy | Docs structure | Gemini (Google) | Round 1 |
| doodlestein-strategic | Smart improvement | Claude | Doodlestein |
| doodlestein-adversarial | Blind spot check | Claude | Doodlestein |
| doodlestein-regret | Reversal prediction | Claude | Doodlestein |

## Process Metadata

- Discussion rounds: 2 (independent research → disagreement resolution)
- Topics: 3 total (3 converged)
- Autonomous decisions: 3 (all by TL with team evidence)
- User escalations: 0
- Doodlestein challenges: 6 raised, 4 accepted, 2 noted
