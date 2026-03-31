---
id: "006"
title: "Consensus Enhancement — Conclusion"
concluded: 2026-03-31
plan: "docs/plans/005-adaptive-mediator-consensus.md"
---

# Consensus Enhancement — Conclusion

## Decision Summary (Post-Doodlestein)

Doodlestein Challenge 改变了多个初始决策。三个独立视角（Codex + Gemini + Challenger）一致指出：D1+D2+D3 本质上在补偿同一个根本问题（固定单轮 pipeline 的刚性），应合并为单一的 "规则化 adaptive mediator" 特性。

| # | Topic | Initial Decision | Doodlestein Impact | Final Decision | Reversibility |
|---|-------|-----------------|-------------------|----------------|---------------|
| 1 | Anti-groupthink | A — mediator 条件触发深挖轮 | **撤回** — 3/3 认为现有多层防线足够，问题不存在 | 合并入 adaptive mediator 规则（矛盾点 < 2 时自动触发，不作为独立特性） | high |
| 2 | 轻量模式 | 三档 + 智能路由 + override | **大幅简化** — 3/3 预测智能路由和三档会被砍 | 简化为 `--quick` flag（跳过交锋 + cross-family）+ adaptive mediator 自动判断深度 | high |
| 3 | Cross-examination | A — 结构化交锋轮 | **保留但合并** — 交锋轮是高价值的，但应由 adaptive mediator 条件触发 | 合并入 adaptive mediator：有未回应论点或证据不足时触发交锋轮 | high |
| 4 | Provider 路由 | B — cross-family 定向挑战 | **撤回** — 1/3 指出独立评估比定向挑战更有价值 | 保持 cross-family 独立评估（不改现状） | high |

## 最终设计：规则化 Adaptive Mediator

核心改动是一个：**mediator 从被动综合者变为主动编排者**，基于 Round 1 输出的可量化信号动态决定辩论深度。

### 可量化信号（Round 1 后提取）

| 信号 | 度量方式 | 含义 |
|------|----------|------|
| 矛盾点数量 | critic 直接 dispute 了 advocate 多少个 claim | 0 = 过于一致 |
| 证据引用 | 双方引用了多少 file:line 证据 | 少 = 论证空泛 |
| 重叠论点 | 双方引用相同文件/模块的比例 | 高重叠 = 视角不够多 |
| Confidence 分数 | challenger 结构化挑战的 1-10 confidence | 全高 = 可快速收敛 |
| 未回应论点 | advocate 提出的论点中 critic 未触及的 | 有 = 交锋有价值 |

### 决策规则

```
Round 1 完成后，mediator 评估：
- 矛盾点 < 2 且 confidence 全 > 7  → 快速收敛（跳过交锋）
- 有未回应论点 或 证据引用 < 3     → 触发交锋轮
- 用户传 --quick                    → 强制快速收敛
- 用户传 --full                     → 强制完整流程
```

### 模式

- **默认**：adaptive — mediator 根据规则决定
- `--quick`：跳过交锋 + 跳过 cross-family（3 agent 快速综合）
- `--full`：强制完整流程（交锋 + cross-family）

## Doodlestein Review

### 挑战与回应

| 挑战 | 来源 | 回应 |
|------|------|------|
| 合并 D1+D2+D3 为 adaptive mediator | 3/3 一致 | **接受** — 重新设计为规则化 adaptive mediator |
| D1 Anti-groupthink 是不存在的问题 | 3/3 一致 | **接受** — 合并为 adaptive 规则的一部分，不作为独立特性 |
| D2 智能路由 + 三档会被砍 | 3/3 一致 | **接受** — 简化为 --quick + adaptive 自动判断 |
| D4 保持 cross-family 独立评估 | 1/3 (Codex) | **接受** — 独立得出的不同结论比被引导反对更有价值 |
| D3 交锋轮使 full 更重 | 1/3 (Challenger) | **部分接受** — 交锋保留但由 adaptive 条件触发，不是每次强制 |

关键讨论：用户提出 "怎么保证 mediator 判断对？"，最终共识是用规则化方式（可量化信号 + if/else 规则）而非 AI 自由判断，确保可预测、可调试、可逐步调优。

## Process Metadata
- Rounds: 1 (all topics converged in Round 1)
- Topics: 4 total (4 converged, 0 spawned, 0 explained)
- Deferred resolved in Sweep: 0
- Revisit cycles: 0
- Doodlestein: executed (cross-family: yes — Codex + Gemini + Challenger)
- Doodlestein impact: 3/4 decisions significantly modified

## Next Steps
→ `/ae:plan` for implementation of adaptive mediator consensus enhancement
