---
id: "04"
title: "对立立场的 Provider 路由"
status: converged
current_round: 1
created: 2026-03-31
decision: "B — cross-family 从中立评估转为定向挑战 advocate"
rationale: "低成本获取 polarity routing 价值，不损失 critic 工具链能力。双层对抗结构。"
reversibility: "high"
---

# Topic: 对立立场的 Provider 路由

## Current Status
已收敛：选择 B（cross-family 定向挑战 advocate）

## Round History
| Round | Score | Key Outcome |
|-------|-------|-------------|
| 1 | converged | 选 B — cross-family 定向挑战 |

## Context
当前 consensus 中，advocate 和 critic 都跑在 Claude 上，cross-family（Codex + Gemini）作为独立中立评估者。Council 的做法是把 polarity pairs（对立观点的成员）硬性约束到不同 provider。

核心 insight：同一模型的两个 instance 即使 prompt 不同，仍然共享训练偏差。真正的认知多样性需要不同模型架构。

但实际限制：Codex 和 Gemini 作为 MCP proxy 运行，没有 Claude subagent 的完整工具链（无法读代码、grep、glob）。它们只能基于发送给它们的上下文来论述。

## Options

### A: 将 critic 角色移到 cross-family
- critic 不再是 Claude challenger agent，而是由 Codex 或 Gemini 担任
- advocate 仍跑 Claude（architect agent，有完整工具链）
- mediator 仍跑 Claude（simplicity-reviewer，需要工具链来验证）
- **Pros**: 对立方真正来自不同模型架构；最大化认知多样性
- **Cons**: cross-family agent 没有工具链，critic 无法自己读代码取证 — advocate 可以引用 file:line 证据，critic 只能基于收到的上下文论述，论证能力不对等

### B: 保持当前结构，强化 cross-family 的对抗性 prompt
- advocate/critic 仍跑 Claude
- 但 codex-proxy 和 gemini-proxy 的 prompt 从 "独立评估" 改为 "专门找 advocate 论点的漏洞"
- 形成双层对抗：Claude 内部（advocate vs critic）+ cross-family 专门挑战 FOR 方
- **Pros**: 不损失 critic 的工具链能力；cross-family 从中立变为定向对抗
- **Cons**: 本质上还是同一模型的内部辩论，cross-family 只是附加层

### C: Hybrid — 双 critic 模式
- 保留 Claude critic（challenger agent，有工具链），同时让一个 cross-family agent 也做 critic
- mediator 综合时有两个 critic 视角：一个来自 Claude（能引用代码），一个来自不同模型（不同认知偏差）
- **Pros**: 兼得工具链能力和模型多样性；不损失现有能力
- **Cons**: 可能过于冗余；两个 critic 论点可能大量重叠；增加 token 开销

### D: 不改，当前架构已最优
- 当前架构的逻辑是：Claude agents 做结构化辩论（有工具链 + 团队通信），cross-family 做独立验证（不同模型的 second opinion）
- 这两个角色的分工是合理的，混合会模糊职责
- **Pros**: 简单清晰；每个角色有明确定位
- **Cons**: 放弃了 "对立方用不同模型" 的潜在价值

## Recommendation
倾向 B — 在不改变架构的前提下，通过调整 cross-family 的 prompt 方向（从中立评估变为定向挑战 advocate），可以低成本获取部分 polarity routing 的价值。C 也有吸引力但增加了复杂度。A 损失太大（critic 没有工具链）。
