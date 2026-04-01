---
id: "02"
title: "Delta 展示格式"
status: converged
current_round: 1
created: 2026-04-01
decision: "C — 箭头 + 绝对 delta（无百分比）"
rationale: "避免小样本百分比误导，同时保留精确 delta 值和视觉方向指示"
reversibility: "high — 输出格式变更，不影响数据"
---

# Topic: Delta 展示格式

## Current Status
已收敛：箭头 + 绝对 delta（无百分比）。

## Round History
| Round | Score | Key Outcome |
|-------|-------|-------------|
| 1 | converged | C — 箭头 + 绝对 delta，避免小样本百分比误导 |

## Context
对比两份 retrospect 报告时，需要展示 5 项指标的变化。展示方式影响可读性和 actionability。指标类型混合：有些是比率（rework rate、auto-pass rate）、有些是计数（P1 escape、drift events）、有些是分数（steps completed N/M）。

## Options

### A: 方向箭头 + 绝对值
```
| Metric | Before | After | Delta |
|--------|--------|-------|-------|
| Rework rate | 3/10 (30%) | 1/8 (12.5%) | ↓ improved |
| P1 escape | 2 | 0 | ↓ improved |
```

- **Pros**: 视觉直观；快速扫描就能看到改善/退化
- **Cons**: 丢失精确 delta 值；不同指标"改善方向"不同（rework 降是好，completion 升是好）需要 skill 内置方向判断

### B: 数值 Delta + 百分比变化
```
| Metric | Before | After | Δ | Δ% |
|--------|--------|-------|---|-----|
| Rework rate | 30% | 12.5% | -17.5pp | -58.3% |
| P1 escape | 2 | 0 | -2 | -100% |
```

- **Pros**: 精确；可用于自动化判断（"rework 降超过 10% 就是显著改善"）
- **Cons**: 对人类读者 cognitive load 高；百分比对小数值没意义（1→0 是 -100%）

### C: 混合：箭头 + 绝对 delta（无百分比）
```
| Metric | Before | After | Change |
|--------|--------|-------|--------|
| Rework rate | 30% | 12.5% | ↓ -17.5pp |
| P1 escape | 2 | 0 | ↓ -2 |
```

- **Pros**: 兼顾直观和精确；避免小样本百分比的误导
- **Cons**: 仍需 skill 内置"好坏方向"判断

## Recommendation
Option C（箭头 + 绝对 delta）。兼顾可读性和精确度，避免百分比在小样本下的误导。方向判断逻辑简单（5 个指标的"好"方向是固定的）。
