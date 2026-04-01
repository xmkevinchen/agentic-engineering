---
id: "03"
title: "Auto-compare 触发方式"
status: converged
current_round: 1
created: 2026-04-01
decision: "A — 仅显式 compare 模式"
rationale: "零数据阶段保持最简触发方式，auto-compare 等验证 comparison 价值后再加"
reversibility: "high — 触发方式变更，随时可加 auto 模式"
---

# Topic: Auto-compare 触发方式

## Current Status
已收敛：仅显式 compare 模式。

## Round History
| Round | Score | Key Outcome |
|-------|-------|-------------|
| 1 | converged | A — 显式 compare，YAGNI 原则 |

## Context
当 `docs/analyses/` 中已有之前的 retrospect 报告时，新的 retrospect 运行可以自动对比上一份报告，或者要求用户显式指定 `--compare`。这影响默认行为和 skill 复杂度。

## Options

### A: 仅显式 compare 模式
用户必须主动指定：`/ae:retrospect --compare 001 002`。普通 `/ae:retrospect` 只生成快照。

- **Pros**: 行为可预测；skill 定义简单；不需要"查找上一份报告"逻辑
- **Cons**: 用户需要记住报告 ID；每次都要多一步操作

### B: 自动对比上一份
每次运行 `/ae:retrospect` 时，自动查找最近一份 retrospect 报告并附加对比 section。如果是第一份，跳过对比。

- **Pros**: 零额外操作；趋势变化自然可见；符合"渐进式数据积累"的设计意图
- **Cons**: 增加 skill 复杂度；可能产出不需要的对比（用户只想看当前快照）；默认行为变了

### C: 自动对比但可 opt-out
默认行为同 B（自动对比），但支持 `/ae:retrospect --no-compare` 跳过对比。

- **Pros**: 最佳默认体验（大多数时候都想看对比）；保留灵活性
- **Cons**: 最高复杂度；opt-out flag 可能很少使用

## Recommendation
Option A（仅显式 compare）。与 Topic 01 的 YAGNI 原则一致 — 先做最简单的，auto-compare 可以在确认 comparison 有价值后再加。当前连第一份 retrospect 数据都没有，自动对比的前提不存在。
