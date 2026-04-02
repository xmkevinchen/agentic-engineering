---
id: "014"
title: "ae:test-plugin v2 — Conclusion"
concluded: 2026-04-02
plan: ""
---

# ae:test-plugin v2 — Conclusion

## Decision Summary (Converged)

| # | Topic | Decision | Rationale | Reversibility |
|---|-------|----------|-----------|---------------|
| 1 | Phase 2 执行编排 | 盲执行模型 + `--verbose` hedge | Test TL 持有 cases + 判定，Session TL 盲执行。职责分离防止 judge/executor 耦合。`--verbose` flag 允许调试时可见。 | high |
| 2 | LLM-as-judge 协议 | codex-proxy 基线 judge + configurable | 不同模型天然独立视角。judge 可配置（pipeline.yml `test.judge`）。加 judge 健康检查。 | high |
| 3 | 测试用例持久化 | 生成+持久化+回归 + `source` tag | `source: generated\|manual\|regression` frontmatter 机械区分。`--regression` 跳过生成，`--refresh` 只覆盖 generated。 | high |
| 4 | retrospect 集成 | C-lite: type filter only | retrospect 跳过 `type: test-report`（allowlist `type: review`）。完整集成推到 5+ 报告积累后。 | high |

## Doodlestein Review

### doodlestein-strategic
**Recommendation**: Mutation testing (`--mutate` flag) — test-lead generates SKILL.md variants with targeted deletions, verifies tests catch them. Self-improving test quality loop.
**TL judgment**: Good idea, recorded for implementation. Within scope, additive.

### doodlestein-adversarial (7 findings)
| # | Severity | Finding | Response | Action |
|---|----------|---------|----------|--------|
| 1 | P1 | SKILL.md stale — no decisions reflected | Architect + Challenger: accepted | Plan must include SKILL.md rewrite |
| 2 | P1 | Blind execution bootstrapping unproven, no fallback | Architect: accepted. Challenger: implementation risk, add smoke test | Plan adds fallback protocol + smoke test |
| 3 | P2 | test-lead.md doesn't reflect expanded responsibilities | Both accepted | Plan includes agent definition update |
| 4 | P2 | Existing test cases lack `source` field | Both accepted | Migration step in plan |
| 5 | P2 | Directory structure conflicts (flat vs subdirs) | Both accepted | Define migration path |
| 6 | P2 | pipeline.yml judge config schema undefined | Noted | Define in plan |
| 7 | P3 | Layer 1 static vs behavioral distinction blurred | Noted | Clarify in SKILL.md rewrite |

### doodlestein-regret
**Prediction**: Decision 1 (blind execution) most likely reversed when first real e2e test hits SendMessage orchestration issues.
**Trigger condition**: First Layer 2 execution attempt via SendMessage.
**Hedge adopted**: `--verbose` flag (Session TL can see test cases for debugging). Default blind, debug visible.
**Architect response**: Partial concession — accepted --verbose, defended blind execution on职责分离 grounds.
**Challenger response**: Did not support reversal — blind execution's value is structural (test-lead generating+judging creates self-easy-test risk).

**TL judgment**: Not reversed. Both respondents defend the core decision. --verbose hedge reduces reversal risk.

## Process Metadata
- Topics: 4 total (4 converged)
- Topics 1-3: converged in old discuss flow (no Agent Teams)
- Topic 4: first Discussion Mode execution (archaeologist + challenger + codex, UAG passed)
- Doodlestein: 3 agents (strategic + adversarial + regret), challenges routed to architect + challenger
- Doodlestein modifications: +source tag, +--verbose flag, +SKILL.md rewrite requirement, +bootstrapping fallback
- Execution note: first Doodlestein attempt failed (team closed before routing). Redone with proper team lifecycle.

## Next Steps
→ `/ae:plan` for implementation
→ Plan MUST include: SKILL.md rewrite, test-lead.md update, existing test case migration, pipeline.yml judge config schema
→ Consider `--mutate` (mutation testing) as stretch goal
