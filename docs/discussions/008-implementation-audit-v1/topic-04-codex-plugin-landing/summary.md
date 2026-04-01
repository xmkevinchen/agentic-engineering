---
id: "04"
title: "Codex Plugin 落地评估"
status: pending
current_round: 1
created: 2026-03-31
decision: ""
rationale: ""
reversibility: ""
---

# Topic: Codex Plugin 落地评估

## Current Status
待讨论：Discussion 007 的 codex-plugin-cc 改动是否产生了实际价值。

## Round History
| Round | Score | Key Outcome |
|-------|-------|-------------|

## Context
研究对 Discussion 007 实现的评估：**"well-written best-practice documentation masquerading as infrastructure change"**

具体发现：
- T1 Prompt checklist: 文档，非 gate — proxy 可以跳过
- T2 Response verification: 结构检查，非语义检查 — 3 个 section 在但内容差也通过
- T3 Attack surface: 加了但没整合进 Challenge Format workflow — 没有字段追踪"是否覆盖了 attack surface"
- T4 Result handling: Rule 4 最具体（OK/NOT-OK 示例），其他 4 条靠 Claude 自觉
- T5 Tool restrictions: 纯 cosmetic 注释

根本差异：codex-plugin-cc 建了验证层（JSON Schema, skill loading, allowed-tools），AE 写了文档希望 Claude 遵守。

## Options
### A: 接受"文档即约束"的架构选择
- AE 的约束机制就是 agent 定义（system prompt），这是架构决定不是缺陷
- LLM 遵守 system prompt 的可靠性在持续提升
- **Pros**: 简单，不增加基础设施复杂度
- **Cons**: 无法保证规则被遵守；质量依赖模型能力

### B: 为关键规则增加轻量验证层
- 不做 JSON Schema（已在 T2 讨论中否决），但在 proxy agent 逻辑中加 post-action 检查
- 例如：proxy 发出 SendMessage 前，检查是否包含执行指令（Rule 4 违规）
- 例如：challenger 输出前，检查每个 finding 是否回答了 4 个 Finding Bar 问题
- **Pros**: 在现有架构内增加可靠性
- **Cons**: 增加 agent 定义复杂度；"检查自己的输出"仍是 LLM 自检

### C: 建立 post-hoc 审计机制而非 pre-action 验证
- 不在 runtime 做约束，而是在 session 结束后审计：proxy 是否遵守了规则？
- 类似 code review 但针对 agent 行为
- **Pros**: 不增加 runtime 复杂度；可以迭代改进规则
- **Cons**: 事后审计不能防止当次 session 的错误

## Recommendation
B — 在最关键的规则上加轻量 self-check（特别是 Rule 4 no-auto-fix 和 Rule 5 fail-honestly），其他规则接受文档约束。
