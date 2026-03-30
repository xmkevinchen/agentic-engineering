---
id: "004"
title: "动态 Agent 选择 — Conclusion"
concluded: 2026-03-30
plan: ""
---

# 动态 Agent 选择 — Conclusion

## Decision Summary

| # | Topic | Decision | Rationale | Reversibility |
|---|-------|----------|-----------|---------------|
| 1 | Agent 选择机制 | TL 查 `docs/agent-selection.md` 选人 | 统一 mapping table，所有 skill 引用。TL 根据 context 查表选 2-4 agents。| high |
| 2 | Cross-family 角色化 | TL 根据 context 决定外部专家审查角度 | Cross-family 是外部专家，需要明确的审查角度。TL 从 context 判断最能发现盲区的角度。| high |

## Key Design Decisions

1. **统一选择表** — `docs/agent-selection.md` 是唯一的 agent 选择参考，所有 skill 引用它
2. **Cross-family = 外部专家** — 不是 "也看看"，是 "从什么角度请外部专家看问题"
3. **TL 决定角度** — TL 有足够 context 判断外部专家应该聚焦哪里
4. **同一问题不同视角** — cross-family 的价值是独立性，不是模型专长
5. **Naive 版本先做** — 从简单实现开始，根据实战数据迭代

## Process Metadata
- Rounds: 2 (team report + user direct discussion)
- Converged: 2/2
- Deferred resolved: 0
- Doodlestein: not executed (direct convergence through user discussion)

## Next Steps
→ 已实现 naive 版本（agent-selection.md + skills 引用）
→ 实战验证后根据数据迭代
