---
id: "002"
title: "Agent Harness 改进 — Conclusion"
concluded: 2026-03-29
plan: "docs/plans/002-harness-improvement.md"
---

# Agent Harness 改进 — Conclusion

## Decision Summary

| # | Topic | Decision | Rationale |
|---|-------|----------|-----------|
| 1 | 评判标准体系 | A-MVP（精简 self-check）+ C（自然积累 outcome 数据） | 每个环节加 1-2 个可客观验证的 check + evidence 字段；Doodlestein 降级为可选，仅 plan confirm + discuss final 两个节点 |
| 2 | 自动化判定机制 | D（效率优化）先行 → A（single gate）→ `--auto N` | 先 P3/P2-style 默认 skip 减摩擦；gate 依赖 plan 结构化和 drift detection 就绪；4 级系统简化为 `--auto N` |
| 3 | Drift Detection | D（circuit breaker）+ A-lite（git diff 透明度）先行 | fix loop 熔断解决最大 token 浪费；git diff --stat 零成本透明度；E（plan-anchored）降级为可选叠加 |

## 关键架构决定

1. **三个 topic 存在依赖链**：plan 质量 → drift 可判定 → gate 可信。实施必须按此顺序。
2. **Drift detection 优先于 automation gate**：任何 contract violation 强制暂停，不受自动化级别影响。
3. **Evidence schema 是基础**：所有 checklist 和 gate 必须附带可追溯的 evidence（diff、test log、decision trace），否则会被形式化绕过。
4. **Legitimate drift 需要出口**：drift 检测触发暂停后，agent 可以 "说明理由并申请批准偏离"。

## Doodlestein Review

讨论过程中进行了两轮 Doodlestein 挑战：

**第一轮（v1 团队）**：simplicity-reviewer 主导，将原始 5 个 topic 中的 4 个归档为 YAGNI。但因未考虑内部 AE 的实战经验，过度简化。

**第二轮（v2 团队，5 方参与）**：基于真实痛点重写 3 个 topic。关键挑战：
- Challenger：E（plan-anchored）制造虚假安全感，应降级
- Challenger：A+D 哲学互斥（checklist 假设你知道查什么，Doodlestein 假设你不知道）
- Codex：建议参考 LangChain/CrewAI/AutoGen 的 drift 处理模式
- Gemini：语义漂移是硬问题，先解决 scope drift

## Next Steps

→ 见 `docs/plans/002-harness-improvement.md`（分三阶段实施）
