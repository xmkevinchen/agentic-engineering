---
id: "01"
title: "评判标准体系 — 从 code review 扩展到全流程"
status: pending
created: 2026-03-29
decision: ""
rationale: ""
---

# Topic: 评判标准体系

## Context

ae 的 code review 有明确的评判标准：5 个 reviewer 各有 checklist，P1/P2/P3 分级，challenger 仲裁分歧。这部分 works。

但其他环节没有：

| 环节 | 有评判标准？ | 现状 |
|------|-------------|------|
| `/ae:review` (code) | ✅ | checklist + P1/P2/P3 + cross-family |
| `/ae:discuss` (决策) | ❌ | 用户逐 topic 选，无质量 gate |
| `/ae:plan` (计划) | ❌ | architect + dependency-analyst review，但没有 "好计划" 的定义 |
| `/ae:work` (执行) | 部分 | TDD 有 pass/fail，但 "实现质量" 靠事后 review |
| `/ae:plan-review` | ❌ | 和 plan 一样，缺定义 |

### 具体问题

1. **讨论决策**：什么是 "好的决策"？选了 Option A 就一定对吗？没有机制验证决策质量
2. **计划质量**：步骤分解是否合理？AC 是否够 specific？architect review 是主观判断
3. **执行忠实度**：agent 写的代码是否真的在执行计划，还是自由发挥？tests pass 不等于按计划执行

## Options

### A: 分层评判标准

为每个环节定义适合其特点的评判维度，不强求量化但要结构化：

**讨论决策**：
- 每个 topic 至少考虑了 3 个 options？
- 决策有明确的 rationale（不是 "感觉 A 好"）？
- 高风险决策有 reversibility 标注？
- Doodlestein challenge 完成？（cross-family 独立挑战）

**计划质量**：
- 每个 step 有明确的完成条件（不是 "实现 X 功能"）？
- AC 有具体的验证方法（不是 "结果应合理"）？
- Step 之间的依赖关系明确？
- 估算的步骤粒度合理（每步 1-3 个 AC，不超载）？

**执行忠实度**：
- commit message 引用了 plan step？
- 测试覆盖了 AC 中的具体场景？
- 代码改动范围和 step 描述一致（没有 scope creep）？

- **Pros**: 每个环节有适配的标准；结构化但不伪精确；可以逐步加严
- **Cons**: 标准本身也是主观的（"至少 3 个 options" 就一定好吗？）；增加 SKILL.md 复杂度

### B: Cross-family 评判

每个环节的输出都经过 cross-family 评分。不是 checklist，而是让不同 model family 独立打分：

```
Plan written → send to Codex + Gemini:
  "Rate this plan 1-5 on: step clarity, AC specificity, dependency coverage, scope appropriateness"
  → Average < 3 on any dimension → flag for human review
```

- **Pros**: 利用 model family 差异减少盲点；数值化但基于多源共识
- **Cons**: LLM 打分不稳定（同一 plan 跑两次分数可能不同）；增加 API 成本；分数本身可能无意义

### C: Outcome-based 评判（事后验证）

不在过程中评判，而是在流程结束后回溯：

```
/ae:review 结束时：
  - 多少 step 需要返工？（返工率）
  - review 发现了多少 P1？（P1 逃逸率）
  - 哪些 AC 在执行时被发现不够 specific？
  → 记录到 review report，作为下次 plan 的教训
```

- **Pros**: 基于真实结果，不是预测；自然积累项目经验数据
- **Cons**: 事后才知道，当时没法阻止；需要多次迭代才有统计意义

### D: Doodlestein 作为通用评判机制

不为每个环节设计专门标准，而是在每个关键节点统一用 Doodlestein 三问（Smartest Alternative / Problem Validity / Regret Prediction）+ cross-family：

- plan 写完 → Doodlestein
- discussion 结束 → Doodlestein
- review 结束 → Doodlestein

- **Pros**: 一套机制覆盖所有环节；利用 cross-family 独立视角；不需要为每个环节设计不同标准
- **Cons**: 三个固定问题可能不适合所有场景；可能变成形式化的 "过关仪式"

## Recommendation

**A + D 组合**。A 提供每个环节的结构化 checklist（最小化版本），D 在关键节点做 cross-family 挑战。C 作为长期积累自然发生（review report 里记录返工数据）。B 的 LLM 打分不可靠，排除。
