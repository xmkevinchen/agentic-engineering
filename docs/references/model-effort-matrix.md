# Model & Effort Matrix

Current model and effort assignments for all AE skills and agents.

**CC model baseline (2026-06):** `opus` resolves to **Opus 4.8** — the current Claude Code default, whose **default effort is high**. The effort ladder is `minimal | low | medium | high | xhigh`; **`xhigh`** (`/effort xhigh`) is reserved for the single **hardest verify/judge stage** (`ae:review`, the verdict gate). Fast mode (~2× cost for ~2.5× speed) is opt-in per run, not a default here. `inherit` = use the session/parent model + effort.

## Skills (TL model + effort)

Read from each `SKILL.md` frontmatter. A blank cell means the field is not declared, so the
session's own model or effort is used.

| Skill | Model | Effort | Role |
|-------|-------|--------|------|
| ae:go | — | — | The entry: runs the work item through the five stages |
| ae:analyze | — | high | Problem named, done defined, evidence behind both |
| ae:discuss | opus | high | Structured decision record for a contested call |
| ae:plan | opus | high | Step cut against the frozen criteria |
| ae:work | — | high | Plan execution (check red first, then commit) |
| ae:review | opus | xhigh | Completion gate — the hardest verify/judge stage |

## Agents (subagent model + effort)

| Agent | Model | Effort | Role |
|-------|-------|--------|------|
| architect | sonnet | high | Plan decomposition, solution design |
| qa | sonnet | high | Code review + cross-family |
| archaeologist | sonnet | medium | Deep code investigation |
| dependency-analyst | sonnet | medium | Dependency mapping |
| standards-expert | sonnet | medium | Industry best practices research |
| architecture-reviewer | sonnet | medium | Architecture review |
| performance-reviewer | sonnet | medium | Performance review |
| security-reviewer | sonnet | medium | Security review |
| doodlestein-strategic | sonnet | medium | Strategic improvement (single question) |
| doodlestein-adversarial | sonnet | medium | Blind spot detection (single question) |
| doodlestein-regret | sonnet | medium | Regret prediction (single question) |
| doodlestein-scope-reducer | sonnet | medium | Scope reduction (single question) |
| minimal-change-engineer | — | — | Minimum-viable diffs; refuses scope creep |
| code-reviewer | haiku | low | General code review (lightweight) |
| codex-proxy | sonnet | low | Codex MCP relay (haiku→sonnet: haiku held parameter-level MUSTs 1 run in 3) |
| gemini-proxy | haiku | low | Gemini MCP relay (stays haiku: no parameter-level per-call MUSTs on that surface) |
| openai-compat-proxy | sonnet | low | Any OpenAI-compatible backend, endpoint and family supplied per call |

## Override Hierarchy

### Skill model (TL)
SKILL.md `model:` → overrides TL mainLoopModel for entire skill execution (verified: `SkillTool.ts:810-821`). Persists across Agent Teams wake/sleep. Scoped per-invocation (does not bleed into next user prompt).

### Agent model (subagents)
Priority (highest wins):
1. `CLAUDE_CODE_SUBAGENT_MODEL` env var
2. `Agent()` inline `model:` parameter
3. Agent frontmatter `model:` field
4. `inherit` (default — uses parent/TL model)

### User override
Users can override with `CLAUDE_CODE_SUBAGENT_MODEL` env var (agents) or pipeline.yml config (planned: BL-019).

### Cost-gate (parameter-level permission, CC v2.1.178+)
`Agent(model:…)` permission rules cap which model a subagent may use — e.g. `deniedTools: ["Agent(model:opus)"]` blocks opus subagents to force cheaper sonnet/haiku on mechanical stages. Scope: **Claude-family subagents only** — it does NOT govern non-Claude / local model backends reached via MCP (those are controlled at the MCP server layer).
