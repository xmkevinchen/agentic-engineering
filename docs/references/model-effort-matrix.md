# Model & Effort Matrix

Current model and effort assignments for all AE skills and agents.

## Skills (TL model + effort)

| Skill | Model | Effort | Role |
|-------|-------|--------|------|
| ae:discuss | opus | high | Multi-round team orchestration + synthesis |
| ae:plan | opus | high | Plan generation + team review |
| ae:review | opus | high | Deep multi-agent review + fixup |
| ae:work | opus | high | Plan execution loop (TDD + commit + review) |
| ae:think | opus | high | Deep multi-step reasoning |
| ae:analyze | inherit | medium | Research + team analysis |
| ae:consensus | inherit | medium | Structured debate |
| ae:plan-review | inherit | medium | Standalone plan review |
| ae:test-plugin | inherit | medium | Adversarial behavioral testing |
| ae:team | inherit | medium | Ad-hoc agent team |
| ae:code-review | inherit | medium | Pre-commit quick review |
| ae:testgen | inherit | medium | Test suite generation |
| ae:dashboard | inherit | inherit | Read-only pipeline status |
| ae:next | inherit | inherit | Next step inference |
| ae:trace | inherit | inherit | Execution flow tracing |
| ae:agent-selection | inherit | inherit | Agent selection reference |
| ae:agent-teams | inherit | inherit | Agent Teams protocol reference |
| ae:setup | inherit | inherit | Project config initialization |
| ae:retrospect | inherit | inherit | Execution trend analysis |

## Agents (subagent model + effort)

| Agent | Model | Effort | Role |
|-------|-------|--------|------|
| architect | sonnet | high | Plan decomposition, solution design |
| challenger | sonnet | high | Pure opposition, blind spot detection |
| qa | sonnet | high | Code review + cross-family |
| test-lead | sonnet | high | Test orchestration + LLM-as-judge |
| archaeologist | sonnet | medium | Deep code investigation |
| dependency-analyst | sonnet | medium | Dependency mapping |
| standards-expert | sonnet | medium | Industry best practices research |
| architecture-reviewer | sonnet | medium | Architecture review |
| performance-reviewer | sonnet | medium | Performance review |
| security-reviewer | sonnet | medium | Security review |
| simplicity-reviewer | sonnet | medium | Simplicity review |
| doodlestein-strategic | sonnet | medium | Strategic improvement (single question) |
| doodlestein-adversarial | sonnet | medium | Blind spot detection (single question) |
| doodlestein-regret | sonnet | medium | Regret prediction (single question) |
| code-reviewer | haiku | low | General code review (lightweight) |
| codex-proxy | haiku | low | Codex MCP relay |
| gemini-proxy | haiku | low | Gemini MCP relay |

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
