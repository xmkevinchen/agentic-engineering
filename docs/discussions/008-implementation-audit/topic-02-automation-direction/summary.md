---
id: "02"
title: "自动化演进方向"
status: pending
current_round: 1
created: 2026-03-31
decision: ""
rationale: ""
reversibility: ""
---

# Topic: 自动化演进方向

## Current Status
待讨论：AE 的自动化程度是否朝正确方向演进。

## Round History
| Round | Score | Key Outcome |
|-------|-------|-------------|

## Context
研究发现当前自动化水平分层明显：
- **100% 自动**：think, trace, analyze, testgen, code-review（分析类 skill）
- **60-85% 半自动**：plan, work, discuss, review, consensus（执行类 skill）
- 执行类 skill 的 human gate 集中在：plan 审批、P1/P2 disposition、fix loop、Doodlestein 确认

关键瓶颈不是技术，而是**决策权委托**：谁有权做最终决定？

roadmap（Plan 002 Phase 1-3）存在但大部分在 SPEC 阶段，未实现。auto-pass gate 已规定但依赖未实现的 drift detection。

## Options
### A: 优先实现 auto-pass gate + drift detection（Phase 2）
- 让 /ae:work 能真正自动跑完多个 step
- 实现 drift detection 使 auto-pass 有意义
- **Pros**: 最直接的自动化提升，用户能看到效果
- **Cons**: 需要实际的代码实现（不是 SKILL.md 文本改动）

### B: 优先减少 human gate — 信任模型决策
- /ae:plan 去掉 Step 5 的强制确认，auto-approve 如果 plan-review 通过
- /ae:discuss 提高 TL 自主决策比例（减少 escalation 条件）
- **Pros**: 立即提升端到端自动化体验
- **Cons**: 增加风险 — 模型可能做出用户不同意的决策

### C: 引入 overnight mode — 参数化的全自动模式
- 添加 `--auto` 参数到所有 skill，禁用所有 human gate
- 失败时记录到文件，用户次日 review
- **Pros**: 用户可以选择完全自动化的时机
- **Cons**: 需要好的失败恢复机制；错误累积风险

## Recommendation
A 和 C 组合 — 先实现 auto-pass gate 的基础设施（drift detection），同时增加 `--auto` 模式。这比减少 human gate（B）更安全。
