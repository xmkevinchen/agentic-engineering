# Changelog

## v0.6.0 — 2026-04-04

### CC Capability Uplift (Plans 024-025)

#### P0: Agent/Skill Frontmatter
- **All 17 agents**: `color` by role group (research=blue, workflow=green, review=yellow, doodlestein=red, proxy=purple)
- **All 17 agents**: `effort` tiering (high/medium/low by role)
- **All 17 agents**: `maxTurns` protection (conservative-high values)
- **5 agents**: `omitClaudeMd: true` for proxy + Doodlestein agents (~1000 tokens saved per spawn)
- **All 17 skills**: `user-invocable` field audit (fixed underscore → hyphen)
- **codex-proxy, gemini-proxy**: `model: haiku` (validated — quality indistinguishable from Sonnet, ~10x cost reduction)

#### P1: Config
- **plugin.json**: `userConfig` with 2 keys (gemini_flash_model, gemini_pro_model)
- **plugin.json**: `outputStyles` — ae-structured + ae-compact
- **Gemini MCP**: FALLBACK_MODEL reads from `CLAUDE_PLUGIN_OPTION_GEMINI_FLASH_MODEL` env var
- **Gemini MCP**: `alwaysLoad` annotation on chat/reply tools (skip ToolSearch overhead)

#### P1: Docs
- **docs/references/claude-code-plugin-api.md**: stable API reference (~200 lines) — frontmatter fields, hooks, security boundaries, feature flags, token budgets
- **docs/decisions/021-claude-code-source-analysis-conclusion.md**: decision record with moat definition, risk register, agent override mechanism

#### P1: Agents
- **4 agents**: `skills` preload (qa→ae:code-review, architect→ae:agent-teams+ae:agent-selection, challenger→ae:agent-teams, test-lead→ae:test-plugin)
- **cross-family-review.md**: canonical MCP tool name reference header
- **test-plugin/SKILL.md**: worktree memory isolation instruction

### Component counts
- 17 skills, 17 agents, 2 MCP servers, 2 output styles, 2 hooks

## v0.5.0 — 2026-04-04

### test-plugin Layer 2: Real Execution (Plan 022)
- **test-plugin/SKILL.md**: Phase 1.3 rewrite — writers shutdown, test-lead stays alive, no unconditional TeamDelete
- **test-plugin/SKILL.md**: Prompt/assertion file split — `tests/prompts/` and `tests/assertions/` for structural blind protocol isolation
- **test-plugin/SKILL.md**: Phase 2 unified git worktree isolation for both Class A and B
- **test-plugin/SKILL.md**: Class B team rebuild — one TeamCreate with skill agents + resurrected test-lead (reads assertions from main repo path)
- **test-lead.md**: Resurrection Protocol — context recovery from files, judge by assertion text only
- **work/SKILL.md**: C.5 delegates to `/ae:test-plugin --regression --layer1` instead of inline logic
- **test-plugin/SKILL.md**: `--layer1` flag for Layer 1-only execution (used by C.5)
- 46 existing test cases migrated to split format, 13 new ae:team test cases generated

### Doodlestein Review Pipeline (Plan 023)
- **code-review/SKILL.md**: Track 4 — per-commit Doodlestein adversarial challenge (sonnet, 1 combined agent, full mode only)
- **work/SKILL.md**: Accumulated Doodlestein checkpoint — mid-feature (floor(total/2) for plans >5 steps) + final step (plans >=3 steps), Codex/Gemini proxy, P1 injects into auto-pass gate

### Component counts
- 17 skills, 17 agents, 2 MCP servers (unchanged — skill enhancements only)

## v0.4.2 — 2026-04-03

### Usage Insights — Pipeline Hardening
- **work/SKILL.md**: Check 1 scans pending steps for missing "Expected files:" and warns upfront (mentions hard-stop at Check B)
- **work/SKILL.md**: UNKNOWN drift upgraded from soft pause to hard stop with 3 explicit recovery options (add Expected files / confirm as unknown / rollback)
- **work/SKILL.md**: Post-commit gate description updated — UNKNOWN no longer reaches gate (blocked at Check B)
- **review/SKILL.md**: Outcome Statistics adds `Fix loop triggers` metric + `unknown` category to Drift events

### Component counts
- 17 skills, 17 agents, 2 MCP servers (unchanged — pipeline hardening only)

## v0.4.1 — 2026-04-02

### Bug Fixes — External Review P1/P2
- **plugin.json**: register codex + gemini MCP servers (was `mcpServers: {}`, contradicting bundled claim)
- **architect.md**: remove dead `SendMessage to simplicity-reviewer` reference (P1 — would hang or no-op)
- **challenger.md**: rename Step 4 "Synthesize" → "Aggregate and Report" (TL-synthesis protocol consistency)
- **challenger.md**: add YAGNI to Attack Surface Reference (replaces simplicity-reviewer's role via challenger's existing constraint framework)
- **qa.md**: replace direct MCP tool calls with proxy agent SendMessage + 120s timeout protocol
- **agent-selection/SKILL.md**: add missing `name: ae:agent-selection` frontmatter field

### Component counts
- 17 skills, 17 agents, 2 MCP servers (unchanged — bug fixes only)

## v0.4.0 — 2026-04-02

### Agent Teams Protocol Unification
- **New skill**: `/ae:agent-teams` — unified protocol for all Agent Teams (Base layer + Debate Mode + Investigation Mode + Doodlestein Protocol)
- **TL synthesizes everywhere**: all 9 agent-teams skills updated — TL (Session TL) is the sole synthesizer, agents research/challenge/report but never produce final output
- **Challenger = pure opposition**: ae:review and ae:analyze challenger no longer synthesizes, TL merges findings
- **ae:consensus rewrite**: TL acts as mediator directly (no more mediator agent), simplicity-reviewer removed
- **ae:discuss rewrite**: Discussion Mode per agent-teams protocol, UAG (Unanimous Agreement Gate), 3 Doodlestein agents, consensus verification
- **3 new agents**: `doodlestein-strategic`, `doodlestein-adversarial`, `doodlestein-regret` — cross-family challenge layer

### ae:test-plugin v2 — Blind Execution + LLM Judge
- **Blind execution model**: test-lead generates+judges, Session TL executes without seeing assertions (behavioral contract, prevents self-easy-test bias)
- **LLM-as-judge**: configurable judge (`test_plugin.judge` in pipeline.yml) — codex (default), gemini, or claude
- **Persistence**: test cases saved with `source: generated|manual|regression` frontmatter tags
- **Flags**: `--verbose` (debug), `--regression` (run existing only), `--refresh` (regenerate generated cases)
- **Judge health check**: pre-check verifies judge reachability before Phase 2
- **Verdict protocol**: structured `{ verdict, assertion, reasoning }` format, per-assertion granularity
- **test-lead expanded**: Phase 4 judge integration, source tagging, MCP tool routing

### Other changes
- **pipeline.yml**: new `test_plugin.judge` config section
- **ae:setup**: documents test_plugin config in Output Defaults table
- **ae:retrospect**: filters `type: test-report` documents (only processes `type: review`)
- **Existing test cases**: migrated with `source: manual` frontmatter
- **simplicity-reviewer**: removed from all skill references and agent-selection table (agent file preserved)

### Component counts
- 17 skills (+1 ae:agent-teams), 17 agents (+3 doodlestein), 2 MCP servers

## v0.3.0 — 2026-04-02

### ae:test-plugin — Adversarial Behavioral Testing
- **New skill**: `/ae:test-plugin` — adversarial behavioral testing for plugin skills/agents
  - 3 input modes: skill name, `--recent` (git diff), `--all` (full scan)
  - Phase 1: Agent Teams test generation (test-lead + prompts-writer + answer-writer)
  - Phase 2: two-layer execution — Layer 1 deterministic (pass/fail) + Layer 2 behavioral (LLM-as-judge)
  - Phase 3: Markdown test report with pass/fail breakdown
- **New agent**: `test-lead` — adversarial testing lead, generates test cases, reviews writers, enforces communication isolation
- **Sample test cases**: 3 Markdown test cases in `plugins/ae/tests/` (refuse behavior, plan output format, review mode config)
- **Test case format**: Markdown per case with MUST/MUST_NOT/SHOULD behavioral assertions

### Component counts
- 16 skills (+1 ae:test-plugin), 14 agents (+1 test-lead), 2 MCP servers

## v0.2.2 — 2026-04-02

### Agent Autonomy + Step Weight Calibration
- **TL Autonomy operational rules**: 6 concrete rules in CLAUDE.md (P3 auto-skip, single-option converge, high-reversibility fast-track, etc.). 3 workflow agents reference these rules.
- **Review mode**: `work.review_mode: full|light` in pipeline.yml. `--light` flag for Claude-only code review (skip cross-family). `--skip-review` flag for ae:plan to skip Agent Teams Plan Review.
- **Proxy timeout protocol**: unified 120s dual timeout (proxy + challenger) defined in agent-selection, referenced by 4 skills.
- **Actionable Next Steps**: work/review/plan completion suggests exact executable commands, SCM-agnostic.
- **Emoji removal**: Next Steps sections cleaned up per CLAUDE.md style.

### Component counts
- 15 skills, 13 agents, 2 MCP servers (unchanged — skills enhanced, not added)

## v0.2.1 — 2026-04-01

### Bug Fixes — Skill/Agent Implementation Audit
- **qa.md**: replace hardcoded CLI `codex -p review` with MCP proxy calls + add Gemini as second cross-family reviewer
- **ae:review**: fixup loop limit (configurable via `work.max_fix_loops`, default 3) + remove `git rebase -i` flag
- **ae:plan + plan-review**: unify Must Fix behavior (direct apply, no user confirm) + update plan status to `reviewed` after inline review + Expected files marked REQUIRED in step template
- **ae:setup**: guide `test.command` configuration + add `test.framework` to template + remove `cross-family-status.json` dead write
- **ae:code-review**: remove `pipeline.yml agents.code_reviewers` dependency, use runtime agent discovery
- **ae:work**: replace undefined "subagent mode" with explicit "Lead inline execution" protocol

### Component counts
- 15 skills, 13 agents, 2 MCP servers (unchanged — skills/agents fixed, not added)

## v0.2.0 — 2026-04-01

### Implementation Audit
- **Auto-pass gate fix**: `no test command` and `no Expected files` now trigger UNVERIFIED/UNKNOWN pause instead of silent bypass
- **Doodlestein role reversal**: Attacker/Defender pattern replaces independent Q1/Q2/Q3 questionnaire — validated with real attack/defense exchange
- **Agent persistence**: "STAY IN THE TEAM" protocol for multi-round discussions — agents survive across rounds
- **Agent definition trimming**: removed duplicate rules from proxy/challenger definitions (v0.1.2 bloat caused Gemini proxy timeout)
- **CLAUDE.md principles**: agent definition rules (no duplication, one-line, test after changes), TL autonomy boundary, 先运行后决策 principle
- **/ae:consensus first execution**: smoke test successful — 5-agent debate produced majority consensus with cross-examination

### AE Evolution — Pipeline Validation + Infrastructure
- **ae:retrospect skill** (NEW): reads Outcome Statistics from `/ae:review` output, generates trend reports with actionable insights. Includes `--compare ID1 ID2` mode for report-to-report comparison with arrow + absolute delta format.
- **WebSearch/WebFetch expansion**: added to challenger and architect agents. Permission principle: research-type agents (need external/time-sensitive data) get access; execution-type (proxy, review) do not.
- **Next Steps standardization**: all 14 skills now have `## Next Steps` sections with conditional suggestions based on skill output and pipeline state (if/then style).
- **Reversibility observation protocol**: discuss SKILL.md now requires `reversibility_basis` when scoring topics. Conclusion template includes `## Reversibility Observation` section.
- **Pipeline end-to-end validation**: full discuss→plan→work→review cycle executed on ae:retrospect comparison mode. First Outcome Statistics produced.

### Component counts
- 15 skills (+1 ae:retrospect), 13 agents, 2 MCP servers

## v0.1.2 — 2026-03-31

### Cross-family Prompt Infrastructure
- **Proxy prompt assembly checklist**: codex-proxy and gemini-proxy now require Role + Task + Context + Output Format before querying external models
- **Response verification**: proxies self-check external model responses for required sections (Findings / Unique Insights / Agreements)
- **Result handling rules**: 5 rules added to both proxies — preserve structure, preserve evidence boundaries, no rewriting, no auto-fix (with concrete OK/NOT-OK examples), fail honestly
- **Challenger adversarial strengthening**: attack surface checklists tagged by scene (`[CODE REVIEW]` vs `[DESIGN DISCUSSION]`), calibration rules (quality > quantity, cross-family agreement ≠ severity increase), finding bar (4-question requirement)
- **Reviewer tool constraint documentation**: all 5 reviewer agents now have explicit "Write/Edit intentionally excluded" comments

### Future direction (from Doodlestein review)
- AGENT_CONTRACT.md (centralized agent constraints) and MCP middleware (transport-layer validation) identified as evolution paths when architecture matures

### Component counts
- 14 skills, 13 agents, 2 MCP servers (unchanged — agents enhanced, not added)

## v0.1.1 — 2026-03-31

### Adaptive Mediator Consensus
- **Multi-round debate**: `/ae:consensus` upgraded from single-round to adaptive multi-round — mediator evaluates Round 1 with qualitative YES/NO signals, conditionally triggers cross-examination
- **Structured output schema**: advocate/critic must use Claims/Evidence/Conceded/Unaddressed format — mediator parses structured data, not free-form text
- **Cross-examination round**: when triggered, mediator extracts opponent's top claims and distributes; each side must respond per-claim (agree/partially agree/disagree)
- **Mode flags**: `--quick` (3 agents, no cross-family, skip evaluation), `--full` (force cross-examination), default adaptive
- **Mediator Phase 1/Phase 2 separation**: evaluation (ROUND_DECISION) and synthesis (verdict) are clearly separated phases to avoid context competition
- **Max 3 rounds cap**: prevents infinite loops on ambiguous topics

### Component counts
- 14 skills, 13 agents, 2 MCP servers (unchanged — consensus enhanced, not added)

## v0.1.0 — 2026-03-30

### Dynamic Agent Selection
- **Centralized agent selection**: `skills/agent-selection/SKILL.md` — unified selection table referenced by all 12 Agent Teams skills
- **Context-aware team composition**: TL selects agents based on task context signals, not hardcoded lists
- **Cross-family as external experts**: TL decides review angle, proxy assembles full prompt (two-layer assembly)
- **Auto-pass default ON**: gate passes → auto-continue, pause only on exception. Removed `--auto N`.

### Challenger Format
- **Structured disagreement**: Claim/Evidence/Objection/Confidence — no free-form challenges
- **Disagreement Value Assessment**: tracks which challenges changed conclusions

### /ae:work Rewrite
- **Inline drift detection**: contract extraction moved into pre-commit (no separate phase)
- **Execution flow diagram**: top of file for agent orientation
- **Pre-commit checks A-G**: letter labels, contract verification, disposition efficiency

### Knowledge Management
- **docs/references/**: external sources with borrowed/discarded rationale
- **NykDev framework analysis**: "Agreement is a bug" comparison
- **docs/backlog/**: 6 tracked items for future work

### Component counts
- 14 skills (was 13 — added agent-selection contextual skill), 13 agents, 2 MCP servers

## v0.0.9 — 2026-03-30

### Discussion Convergence
- **Three-state scoring**: topics scored as converged/revisit/deferred (no irresolvable escape)
- **Multi-round discussion**: no fixed round limit, revisit until convergence
- **Sweep mechanism**: all deferred items must resolve before conclusion — converge, spawn new discussion, or explain why
- **Topic directory structure**: `summary.md` + `round-NN.md` per topic, agent only reads summary each round (O(1) context vs O(n))
- **Process Metadata**: auto-embedded in conclusion, makes incomplete process visible
- **Downstream validation**: `/ae:plan` checks conclusion completeness

### Harness Phase 3
- **Doodlestein challenge**: cross-family 3-question challenge (Smartest Alternative / Problem Validity / Regret Prediction) at discuss conclusion and plan confirm
- **Outcome statistics**: `/ae:review` reports rework rate, P1 escape rate, drift events, auto-pass rate
- **Auto-pass default ON**: gate passes → auto-continue, pause only on exception. Removed `--auto N` parameter.

### Challenger Improvements
- **Structured disagreement**: challenges must use Claim/Evidence/Objection/Confidence format
- **Disagreement Value Assessment**: tracks which challenges changed conclusions vs dismissed

### Documentation
- **docs/references/**: knowledge sources with what we borrowed, discarded, and why
- **NykDev framework analysis**: compared "Agreement is a bug" 11-agent framework with ae

### Component counts
- 13 skills, 13 agents, 2 MCP servers

## v0.0.8 — 2026-03-29

### Harness Improvement Phase 2
- **Contract extraction**: `/ae:work` extracts `files_allowed` and `target_ac` from plan's "Expected files:" before each step. Graceful degradation when plan lacks this field.
- **Drift verification**: Post-step `git diff --name-only` checked against contract. Violations trigger soft pause with fix/approve/rollback options. Approved drifts recorded in commit message.
- **Auto-pass gate** (opt-in): When `work.auto_pass: true` in pipeline.yml, steps auto-continue if tests green + no P1 + contract verified. Contract violations and security-sensitive files always force pause.
- **Pipeline config**: `work.max_fix_loops`, `work.auto_pass`, `work.security_patterns` added to pipeline template
- **Plan template**: Steps now include "Expected files:" line for contract extraction

## v0.0.7 — 2026-03-29

### Harness Improvement Phase 1
- **Fix loop circuit breaker**: `/ae:work` TDD cycle detects consecutive test failures on same file, stops after 3 (configurable) with retry/defer/help options
- **Git diff transparency**: `/ae:work` shows `git diff --stat` before each commit for drift visibility
- **Disposition efficiency**: Pre-commit auto-skips P3 and P2-style/naming findings, only shows P1 + P2-logic/security
- **Plan quality self-check**: `/ae:plan` verifies step completion conditions, AC verifiability, and expected file lists before review
- **Discussion decision self-check**: `/ae:discuss` requires rationale, reversibility rating, and evidence for each decision

### Documentation
- **Harness improvement**: design discussion with 2 rounds of Agent Team review
- **Plan 002**: 3-phase implementation plan for evaluation criteria, automation gates, drift detection

## v0.0.6 — 2026-03-23

### Features
- **`/ae:plan-review`**: Standalone plan review command — re-review an existing plan with Agent Teams without regenerating it

### Component counts
- 13 skills (was 12), 13 agents, 2 MCP servers

## v0.0.5 — 2026-03-23

### Features
- **Agent Teams pre-check**: All 9 skills that use Agent Teams now check `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS` is enabled before executing — refuses with actionable instructions if missing
- **Setup detects Agent Teams**: `/ae:setup` checks and reports Agent Teams status during initialization
- **README updated**: Prerequisites section documents Agent Teams requirement with setup instructions

## v0.0.4 — 2026-03-22

### Fixes
- **Gemini MCP startup**: Move dep install from SessionStart hook into `.mcp.json` command — fixes race condition where MCP connection started before `npm install` finished
- **GEMINI_API_KEY passthrough**: Add `env` block to `.mcp.json` so the key is forwarded to the Gemini server process

## v0.0.3 — 2026-03-22

### Improvements
- **Agent auto-discovery**: Skills discover agents at runtime from all sources (project, plugins, global) — no need to list agents in pipeline.yml
- **Gemini model auto-discovery**: New `models` tool lists available models via API, agents pick models at runtime. Removed `gemini_model` from pipeline.yml.
- **Auto-setup on first use**: Skills auto-trigger `/ae:setup` when pipeline.yml is missing instead of refusing to execute
- **Review findings fixed**: testgen field name bug, review empty test.command, code-review scratch status, think scratch recovery
- **Proxy failure deadlock fix**: Proxies now notify the team lead (not Lead) on failure, preventing hang
- **Scratch project isolation**: frontmatter `project` field + recovery filters by repo name
- **dist/ included in repo**: Gemini MCP server works immediately on plugin install without build step

## v0.0.2 — 2026-03-22

### Unified Output Specification

- **pipeline.yml output block**: 6 semantic slots (discussions, plans, milestones, backlog, reviews, analyses) with sensible defaults. Replaces old `output.review` + `output.plans`.
- **Scratch persistence**: All skill outputs auto-save to `~/.claude/scratch/<project-hash>/` for session resilience. Survives compact/crash/close.
- **Persistence prompts**: High-value skills (trace, consensus, think) ask user to formally save after completion. Low-ceremony skills (code-review, team) save silently, archived in bulk during `/ae:review`.
- **Session recovery**: All skills with pre-checks now scan scratch for `status: in_progress` items and prompt user to resume.
- **Action log format**: code-review findings tracked with action (fix now / backlog / skip) and status (pending / in_progress / resolved).
- **Unified naming**: `NNN-slug` convention with YAML frontmatter (`id`, `title`, `type`, `created`, `status`) across all file-writing skills.
- **cross-family-review**: Moved from `skills/` to `docs/` — it's a reference document, not a slash command.

### Component counts
- 12 skills (was 13 — cross-family-review moved to docs)
- 13 agents
- 2 MCP servers
