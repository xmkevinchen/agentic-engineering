---
id: "01"
title: "Agent 自主性 — 脚本执行 vs 真正自主"
status: pending
current_round: 1
created: 2026-03-31
decision: ""
rationale: ""
reversibility: ""
---

# Topic: Agent 自主性 — 脚本执行 vs 真正自主

## Current Status
待讨论：AE 的 agent 是否具备真正的自主问题分解和解决能力。

## Round History
| Round | Score | Key Outcome |
|-------|-------|-------------|

## Context
研究发现 AE 的 agent 系统本质上是**脚本执行引擎**：
- Agent 零主动性 — 只在被 spawn 时执行，不能发起任务
- 每个 SKILL.md 是详细的步骤脚本（discuss 394 行，work 178 行），agent 按步骤走
- 反馈循环有硬上限（consensus 3 轮，dependency-analyst 1 轮交互）
- 问题分解是 TL 职责，agent 只做事后验证
- Challenger 的 Challenge Format 是强制模板，不允许创新挑战方式

但"脚本化"不一定是坏事 — 它保证了一致性和可预测性。问题是：这是我们想要的定位吗？

## Options
### A: 承认现状，重新定位为"结构化编排框架"
- 不再声称是"自主 agent 系统"，而是"多视角结构化工程流程"
- 价值在于一致性、可重复性、多视角综合 — 不在于自主性
- **Pros**: 诚实定位，管理预期，聚焦真正的强项
- **Cons**: 降低了愿景高度；可能与 Harness Engineering 的目标不一致

### B: 逐步增加真正的自主能力
- 识别可以增加 agent 自主性的具体点：agent 发起子任务、agent 选择工具策略、agent 自适应行为
- 按优先级逐步实现，从高价值低风险处开始
- **Pros**: 朝着真正自主的方向演进
- **Cons**: 需要显著的架构变更；自主性带来不可预测性

### C: 混合定位 — 结构化框架 + 自主性热点
- 大多数流程保持脚本化（保证一致性），但在关键点引入真正自主
- 例如：agent 可以自主决定是否需要更多研究、是否需要拆分问题、是否需要调用特定工具
- **Pros**: 平衡一致性和灵活性
- **Cons**: 需要明确定义"自主边界"

## Recommendation
研究表明当前系统的"多视角综合"确实有价值（cross-family 发现真实盲点），但声称"自主 agent"是不准确的。C 可能是最务实的路径。
