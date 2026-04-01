---
id: "01"
title: "Comparison 粒度：报告级 vs 时间段聚合"
status: converged
current_round: 1
created: 2026-04-01
decision: "A — 报告级对比（by ID）"
rationale: "零数据阶段应做最简方案验证 comparison 能力，时间段聚合等积累数据后按需添加"
reversibility: "high — skill 定义修改，随时可扩展"
---

# Topic: Comparison 粒度

## Current Status
已收敛：报告级对比（by ID）。

## Round History
| Round | Score | Key Outcome |
|-------|-------|-------------|
| 1 | converged | A — 报告级对比，YAGNI 原则 |

## Context
ae:retrospect 的 5 项 Outcome Statistics（步骤完成率、rework rate、P1 escape rate、drift events、auto-pass rate）来自 `/ae:review` 的输出。每次 review 产出一份报告。当积累多份报告后，comparison 需要决定对比的基本单元。

当前 `docs/reviews/` 为空，但设计应考虑数据积累后的使用场景。

## Options

### A: 报告级对比（Report-to-Report）
对比两个指定的 retrospect 报告（by ID 或文件名）。

- **Pros**: 实现简单；语义清晰（"对比 feature A 和 feature B 的 pipeline 表现"）；与现有 `NNN-retrospect-slug.md` 输出格式直接对应
- **Cons**: 需要用户知道具体报告 ID；单个报告可能样本量太小不够有代表性

### B: 时间段聚合对比（Period Aggregation）
对比两个时间段内所有 review 的聚合指标（如 "最近 30 天 vs 之前 30 天"）。

- **Pros**: 更有统计意义；不需要知道具体报告 ID；自然适配趋势分析
- **Cons**: 实现更复杂（需要日期解析、聚合逻辑）；早期数据少时聚合没意义

### C: 两者都支持，报告级为默认
支持两种模式：`/ae:retrospect --compare ID1 ID2`（报告级）和 `/ae:retrospect --compare-period 30d`（时间段）。报告级为默认因为更简单。

- **Pros**: 灵活；覆盖两种使用场景
- **Cons**: 增加 skill 定义复杂度；早期只有报告级有用，时间段模式是预支复杂度

## Recommendation
Option A（报告级对比）。原因：ae:retrospect 还没有任何真实数据，应该先做最简单的方案验证 pipeline 能力。时间段聚合可以在积累足够数据后再添加，属于典型的 YAGNI 场景。
