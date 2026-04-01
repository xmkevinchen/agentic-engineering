---
id: "07"
title: "Agent Teams 多轮生命周期"
status: pending
current_round: 1
created: 2026-03-31
decision: ""
rationale: ""
reversibility: ""
---

# Topic: Agent Teams 多轮生命周期

## Current Status
待讨论：agent 完成第一轮任务后退出 team，导致多轮辩论断裂。

## Round History
| Round | Score | Key Outcome |
|-------|-------|-------------|

## Context
活证据（Discussion 008 当天发生）：
1. Round 1 — codex-proxy 和 gemini-proxy 分析完发给 challenger 后退出 team
2. Round 2 — TL 发送挑战给 proxy，消息无人接收（agent 已不在 members 列表）
3. Workaround — 重新 spawn codex-r2/gemini-r2，但它们没有 Round 1 上下文
4. 意外 — 原来的 proxy 有时又能收到消息（可能是 idle 而非 exit），行为不确定

根本问题：agent 的 spawn prompt 是一次性任务（"分析这些 topic，SendMessage 给 challenger"），完成后 agent 认为任务结束。没有"留在 team 等后续指令"的机制。

## Options
### A: Spawn prompt 加持久化指令
- 在所有需要多轮讨论的 agent 的 spawn prompt 末尾加："完成后留在 team 等待后续轮次，不要退出"
- **Pros**: 最简单，不需要改架构
- **Cons**: 依赖 LLM 遵守"不要退出"的指令；agent 可能 idle 后被系统回收

### B: 每轮重新 spawn + 传递上下文
- 接受 agent 是短生命周期的，每轮重新 spawn
- 但在 spawn prompt 中包含之前轮次的关键结论（"你上一轮选了 B，理由是 X"）
- **Pros**: 不依赖 agent 持久化；架构简单
- **Cons**: 上下文传递可能丢失细节；token 成本增加

### C: 讨论状态持久化到文件
- 每轮结束后把讨论状态写到 topic 的 round-NN.md
- 下一轮 spawn 新 agent 时让它读 round 文件获取上下文
- **Pros**: 上下文完整保存；不依赖 agent 存活
- **Cons**: 需要在 discuss skill 中加 round 文件写入/读取流程（已有此设计但未用于 Agent Teams）

## Recommendation
A 先试 — 最低成本。如果 agent 系统确实会回收 idle agent，再退到 C。B 是 C 的简化版但上下文传递不可靠。
