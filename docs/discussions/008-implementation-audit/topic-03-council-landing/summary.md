---
id: "03"
title: "Council of High Intelligence 落地评估"
status: pending
current_round: 1
created: 2026-03-31
decision: ""
rationale: ""
reversibility: ""
---

# Topic: Council of High Intelligence 落地评估

## Current Status
待讨论：从 Council 借鉴的模式是否真正落地并产生价值。

## Round History
| Round | Score | Key Outcome |
|-------|-------|-------------|

## Context
研究发现 Council 模式的落地情况令人担忧：

**借鉴了什么**：
1. Cross-examination（对手辩论）— 写在 SKILL.md 但从未执行
2. Anti-groupthink — 从"自动检测+强制异议"弱化为条件规则
3. Lightweight modes — 从三档智能路由简化为 --quick/--full
4. 结构化辩论格式 — Claim/Evidence/Objection/Confidence（已落地）

**核心问题**：
- /ae:consensus 从未被实际执行过 — 无输出文件、无测试记录
- 量化信号（矛盾点计数）→ 主观 YES/NO 判断，失去了 Council 的精确性
- Plan 005 的 AC 全打了勾但无验证证据
- Mediator 的 Phase 1/2 分离是 prompt pattern，不是可执行逻辑

## Options
### A: 承认 consensus 未验证，设计并执行验证测试
- 用一个真实问题跑 /ae:consensus，记录结果，评估质量
- 基于实际表现决定是否需要改进
- **Pros**: 实事求是，用证据说话
- **Cons**: 可能发现问题比想象的更严重

### B: 回归 Council 原始设计 — 恢复量化信号
- 把 mediator 的 YES/NO 判断改回量化指标（矛盾点数、证据引用数、confidence 分布）
- 让评估基于数据而非 Claude 的主观判断
- **Pros**: 更客观、更可预测的共识机制
- **Cons**: 需要显著重写 consensus SKILL.md

### C: 重新评估 — AE 是否真正需要 consensus skill
- AE 的架构优势是真实的多模型多样性（Claude+Codex+Gemini），不是同模型角色扮演
- 可能 /ae:discuss 的 Doodlestein + 多轮辩论已经覆盖了 consensus 的需求
- **Pros**: 减少复杂度，聚焦真正有价值的能力
- **Cons**: 丢掉了一个可能有用的工具

## Recommendation
A 优先 — 先测试，再决定。不测试就做架构决策是重蹈 Discussion 006 的覆辙。
