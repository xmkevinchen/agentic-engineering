---
id: "08"
title: "Agent 定义精简原则"
status: pending
current_round: 1
created: 2026-03-31
decision: ""
rationale: ""
reversibility: ""
---

# Topic: Agent 定义精简原则

## Current Status
待讨论：Discussion 007 的实施证明过度指令化会损害 agent 表现。

## Round History
| Round | Score | Key Outcome |
|-------|-------|-------------|

## Context
活证据（Discussion 008 当天发生）：
1. v0.1.2 给 proxy 加了 Prompt Assembly Checklist + Response Verification + 5 条 Result Handling Rules（+28 行/文件）
2. 给 challenger 加了 Attack Surface（20 行）+ Calibration Rules + Finding Bar（+36 行）
3. 结果：Gemini proxy 在 Discussion 008 v1 中超时无法返回
4. 精简后（删除重复，压缩规则）：Gemini proxy 正常返回，讨论质量未下降

关键发现：
- "Prompt Assembly Checklist" 跟已有的 "Two-layer prompt assembly" 说的是同一件事 — 纯重复
- "Response Verification" 增加了一个自检步骤 — 让 agent 更犹豫
- Calibration Rules 里的 "Grounding required" 和 Challenge Format Rules 里的 "Evidence MUST reference specific files" 重复
- 用户对比：公司内部版本 agent 定义更精简，agent 表现更好（更自主、更快收敛）

## Options
### A: 制定 agent 定义字数上限
- 例如：proxy agent ≤ 100 行，reviewer agent ≤ 80 行
- 超过需要 review 并裁剪
- **Pros**: 硬约束，防止膨胀
- **Cons**: 行数不等于质量；可能限制必要的复杂指令

### B: 制定内容原则（不设字数）
- 原则：不重复已有内容；一条规则用一行；不加自检步骤（让 agent 自己判断）
- 每次修改 agent 定义后必须跑一次实际任务验证
- **Pros**: 灵活；关注内容质量而非形式
- **Cons**: 原则可能被忽视（没有硬约束）

### C: Agent 定义 review checklist
- 修改 agent 定义时必须回答：(1) 新增内容是否与已有内容重复？(2) 能否用一行说清楚？(3) 修改后跑过实际任务吗？
- 写入 CLAUDE.md 或 discuss 流程
- **Pros**: 具体可操作；不限制灵活性
- **Cons**: 又是一个 checklist（ironic）

## Recommendation
B + C 的测试要求 — 内容原则 + "修改后必须跑实际任务"作为硬约束。不设字数上限但强制验证。
