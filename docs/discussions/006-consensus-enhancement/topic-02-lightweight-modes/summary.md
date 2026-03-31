---
id: "02"
title: "Quick/Duo 轻量模式"
status: converged
current_round: 1
created: 2026-03-31
decision: "三档（full/quick/duo）+ 智能路由默认 + flag override"
rationale: "灵活性和便利性兼得。智能路由减少认知负担，显式 flag 保留控制权。"
reversibility: "high"
---

# Topic: Quick/Duo 轻量模式

## Current Status
已收敛：三档 + 智能路由 + flag override

## Round History
| Round | Score | Key Outcome |
|-------|-------|-------------|
| 1 | converged | 三档 + 智能路由 + override |

## Context
当前 `/ae:consensus` 固定启动 5 个 agent（advocate + critic + mediator + codex-proxy + gemini-proxy），对于小决策（如 "要不要加个 flag"）开销过大。Council 提供 3 种模式：full（18 人 3 轮）、quick（2 轮）、duo（2 人辩证）。

我们需要考虑：轻量模式的边界在哪？什么时候 "小决策" 其实需要完整辩论？怎么让用户容易选择？

## Options

### A: 加 `--quick` 和 `--duo` flag
- `--quick`：跳过 cross-family，仅 advocate + critic + mediator（3 agent）
- `--duo`：仅 advocate + critic 直接辩论，无 mediator（2 agent，用户自己当 mediator）
- 默认不变（full 5 agent）
- **Pros**: 灵活，用户按需选择；`--duo` 极其轻量
- **Cons**: 用户可能不知道该选哪个；`--duo` 没有中立综合，verdict 质量下降

### B: 自动检测复杂度
- 根据提案内容自动判断：涉及多模块/高 blast radius → full；单模块/可逆 → quick；yes/no 问题 → duo
- 用户可 override
- **Pros**: 用户不需要选择；智能路由
- **Cons**: 自动判断可能出错；增加实现复杂度；用户可能不信任自动判断

### C: 只加 `--quick`，不加 `--duo`
- `--quick` 跳过 cross-family（3 agent）
- 不提供 `--duo`，因为 2 agent 辩论没有综合方，价值有限
- 用户想要超轻量的话，直接问 Claude 就行，不需要 consensus 工作流
- **Pros**: 简单，只两个档位；保证最低辩论质量
- **Cons**: 少了极轻量选项

## Recommendation
倾向 C — `--duo` 本质上退化成了 "用两个 agent 来回对话"，这不需要 consensus 工作流框架。`--quick` 提供足够的弹性，同时保持 mediator 综合的核心价值。
