---
id: "01"
title: "Anti-groupthink 机制"
status: converged
current_round: 1
created: 2026-03-31
decision: "A — mediator 检测过早一致，条件触发深挖轮"
rationale: "条件触发比无条件强制更精准，不增加正常场景开销。mediator 已有综合判断能力，自然承担检测。"
reversibility: "high"
---

# Topic: Anti-groupthink 机制

## Current Status
已收敛：选择 A（mediator 条件触发深挖轮）

## Round History
| Round | Score | Key Outcome |
|-------|-------|-------------|
| 1 | converged | 选 A — 条件触发深挖轮 |

## Context
当前 consensus 的 advocate（FOR）和 critic（AGAINST）各自论述后，mediator 综合。但实际运行中，如果提案明显合理，critic 可能只提出形式化的反对（"acknowledges strengths honestly" 可能变成主旋律）。Council 项目的做法是：>70% 初始一致时强制产生异议。

问题是：我们的 consensus 已经有 challenger agent（结构化 Claim/Evidence/Objection/Confidence 格式）+ cross-family（不同模型架构的真正多样性）+ Doodlestein（在 discuss 中）。anti-groupthink 机制是否仍有附加价值？

## Options

### A: Mediator 检测 + 强制深挖轮
- mediator 在综合 advocate/critic 意见后，如果检测到过早一致（双方核心论点不矛盾），触发一个额外轮次
- 额外轮次中：critic 被要求 steelman 反对（"即使你同意，找出最强的反对理由"），cross-family 被要求独立评估最大风险
- **Pros**: 结构性保障，不依赖 agent 自觉性；仅在需要时触发，不增加正常开销
- **Cons**: 检测 "过早一致" 的标准不好定义（mediator 判断 vs 规则化）；可能制造人为噪音

### B: 预设异议义务（Mandatory Devil's Advocate）
- critic 的 prompt 中加入硬性要求：无论是否同意，必须提出至少 3 个结构化反对论点
- 不需要检测机制，每次都执行
- **Pros**: 简单直接，无检测逻辑；保证每次辩论都有实质性反对
- **Cons**: 对于确实应该同意的提案，强制反对可能降低信噪比；增加每次 consensus 的 token 开销

### C: 不加，现有机制已足够
- challenger 的结构化挑战格式 + cross-family 多样性 + Disagreement Value Assessment 已经构成了多层防线
- Council 需要 anti-groupthink 是因为它用同一模型扮演 18 个角色；我们用不同模型家族，这个问题本身就弱很多
- **Pros**: 不增加复杂度；避免过度工程
- **Cons**: 如果 cross-family 也同意（它们确实可能在显而易见的问题上一致），仍然缺乏挑战

## Recommendation
倾向 A — 条件触发比无条件强制更优雅，且我们的 mediator 已有综合判断的能力，可以自然承担检测职责。但 C 也有道理，因为我们的多样性来源本质上比 Council 更强。
