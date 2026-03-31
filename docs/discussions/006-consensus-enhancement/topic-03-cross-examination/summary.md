---
id: "03"
title: "Cross-examination 交锋轮"
status: converged
current_round: 1
created: 2026-03-31
decision: "A — 结构化交锋轮，mediator 协调提取论点并分发"
rationale: "结构化交锋是质量关键保障。mediator 协调确保有焦点有终点。与 anti-groupthink 检测可整合。"
reversibility: "high"
---

# Topic: Cross-examination 交锋轮

## Current Status
已收敛：选择 A（结构化交锋轮，mediator 协调）

## Round History
| Round | Score | Key Outcome |
|-------|-------|-------------|
| 1 | converged | 选 A — 结构化交锋轮 |

## Context
当前 consensus 流程：advocate 和 critic 各自独立论述 → mediator 等两方完成后综合。双方不直接回应对方论点。Council 的 Round 2 要求每个成员必须 engage 2+ 其他成员的具体论点。

直接交锋可以：暴露论证中的薄弱环节（被对方指出）、迫使双方回应最强反论点（而不是各说各的）。但也增加了轮次和 token 开销。

## Options

### A: 加入结构化交锋轮（mediator 协调）
- 流程变为 3 轮：Round 1（独立论述）→ Round 2（交锋：双方必须回应对方最强的 2 个论点）→ Round 3（mediator 综合）
- mediator 在 Round 1 结束后提取双方核心论点，分发给对方
- **Pros**: 保证双方直接 engage；mediator 可以引导交锋焦点
- **Cons**: 多一轮 = 更多 token + 时间；mediator 提取论点可能遗漏或偏向

### B: Agent 间直接 SendMessage 交锋
- Round 1 后，advocate 和 critic 互相 SendMessage，各自回应对方论点
- 无 mediator 中间层，直接交流
- **Pros**: 更自然的辩论流；减少 mediator 瓶颈
- **Cons**: 可能陷入无限来回；没有结构保证何时结束；可能偏离重点

### C: 不加独立交锋轮，强化 mediator 的综合质量
- 保持当前 2 轮结构，但 mediator 在综合时必须：识别双方矛盾点、判断谁的证据更强、指出未被回应的论点
- 本质上把交锋内化到 mediator 的综合过程中
- **Pros**: 不增加轮次；mediator 作为中立方做交叉对比可能比双方自己交锋更客观
- **Cons**: mediator 可能无法完全代替真正的对抗性交锋；双方不知道对方论点就无法被迫回应

## Recommendation
倾向 A — 结构化交锋轮是高价值改进。Council 项目验证了这个模式有效。mediator 协调确保交锋有焦点、有终点。开销增加是可接受的，因为 consensus 本身就是用于重要决策的工具。
