---
id: "05"
title: "系统验证计划"
status: pending
current_round: 1
created: 2026-03-31
decision: ""
rationale: ""
reversibility: ""
---

# Topic: 系统验证计划

## Current Status
待讨论：如何设计一个系统化的验证计划来检验 AE 的实际效果。

## Round History
| Round | Score | Key Outcome |
|-------|-------|-------------|

## Context
当前的核心问题是：**AE 的能力全部停留在 SKILL.md 规范层，没有被实际验证。**

具体缺失：
- /ae:consensus 从未被执行过
- Discussion 007 的改动未经 A/B 对比验证（加了 checklist 后输出质量是否提升）
- Plan 005 的 AC 打了勾但无执行证据
- auto-pass gate 规范了但 drift detection 未实现
- 没有 baseline 数据来衡量改进效果

## Options
### A: 设计端到端烟雾测试（Smoke Test Suite）
- 为每个 skill 设计一个最小完整测试用例
- /ae:consensus 跑一个真实提案辩论
- /ae:discuss 跑一个真实设计讨论
- /ae:plan + /ae:work 跑一个小功能端到端
- 记录：是否按预期执行、哪里出了问题、agent 是否遵守规则
- **Pros**: 最直接的验证；发现真实问题
- **Cons**: 耗时；需要设计有意义的测试场景

### B: A/B 对比测试 — 有 AE 规则 vs 无 AE 规则
- 用同一任务，分别用"裸 Claude"和"AE 流程"执行
- 对比：输出质量、遗漏问题数、一致性
- 关注：Discussion 007 的 proxy 改动是否真的提升了 cross-family 输出质量
- **Pros**: 量化 AE 的实际价值
- **Cons**: 变量多，难以严格控制；A/B 测试本身耗时

### C: Self-dogfooding 验证 — 用 AE 审计 AE
- 这个 Discussion 008 本身就是一次 dogfooding 测试
- 继续用 /ae:plan → /ae:work 来实现审计发现的改进
- 在执行过程中记录 AE 流程的实际表现
- **Pros**: 零额外成本（正在做的事就是测试）；真实场景
- **Cons**: 自己审计自己有盲点；不是系统化测试

### D: 组合方案 — Smoke Test + Dogfooding
- Topic 3 的 consensus 验证作为第一个 smoke test（最紧急，因为从未被测试）
- Discussion 008 的后续执行作为持续 dogfooding
- 为每个改进建立 before/after baseline（例如：proxy 输出在加了 checklist 前后的质量对比）
- **Pros**: 最全面；紧急的先做
- **Cons**: 需要纪律性持续执行

## Recommendation
D — 先做 /ae:consensus smoke test（Topic 3 决定后立即执行），同时把 Discussion 008 后续执行作为 dogfooding，并为关键改动建立 before/after baseline。
