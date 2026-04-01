---
id: "06"
title: "Doodlestein 进入方式 — 问卷 vs 辩论"
status: pending
current_round: 1
created: 2026-03-31
decision: ""
rationale: ""
reversibility: ""
---

# Topic: Doodlestein 进入方式 — 问卷 vs 辩论

## Current Status
待讨论：Doodlestein Challenge 的当前实现是问卷模式，不产生真正的对抗。

## Round History
| Round | Score | Key Outcome |
|-------|-------|-------------|

## Context
当前 Doodlestein 实现：TL 把 3 个问题（Smartest Alternative / Problem Validity / Regret Prediction）打包发给 codex-proxy、gemini-proxy、challenger，它们各自独立回答，challenger 综合。

问题：这是**问卷收集**，不是**辩论**。没有人 defend 已有决策，挑战者也没有对手。三方独立回答同样的问题，没有交锋。

活证据：Discussion 008 的 Doodlestein 阶段，三方各自回答了 Q1/Q2/Q3，challenger 综合后发现 T4 有问题。但没有人尝试 defend T4 — 它直接被推翻了。如果有 defender，T4 可能经过更严格的辩论后仍然成立或被更精确地修正。

## Options
### A: 问题即 Agent — 每个问题 spawn 一个攻击者
- Spawn 3 个 Doodlestein agent，每个只带一个问题
- 它们读代码找证据，然后跟讨论中的原有 agent 辩论
- 问题不是被"回答"的，而是被"攻击/辩护"的
- **Pros**: 最接近真正的辩论；每个问题有专注的攻击者
- **Cons**: agent 数量翻倍；原有 agent 需要持久化到 Doodlestein 阶段

### B: 对抗者注入 — 新 agent 加入推翻决策
- 不改问题形式，但注入 1-2 个 devil's advocate agent
- 它们的唯一任务是推翻已有决策，原有 agent 必须 defend
- **Pros**: 简单，只加 1-2 个 agent；有真正的对抗
- **Cons**: devil's advocate 可能为反对而反对

### C: 角色反转 — Challenger 转攻击，Proxy 转防御
- Challenger 在讨论阶段是综合者，Doodlestein 阶段转为攻击者
- Proxy 从"提供视角"转为"defend 自己选过的 option"
- **Pros**: 不需要新 agent；利用已有 agent 的上下文；角色反转制造真实张力
- **Cons**: 需要 agent 在同一 session 内转换角色；proxy 的"defend"能力取决于它是否还记得 Round 1 的论点

## Recommendation
C 最优雅 — 不增加 agent 数量，利用已有上下文，但前提是解决 Topic 7（agent 生命周期）。如果 agent 不能持久化到 Doodlestein，C 不可行，退到 B。
