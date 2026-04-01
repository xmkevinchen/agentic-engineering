---
id: "010"
title: "ae:retrospect Comparison Mode"
status: concluded
created: 2026-04-01
pipeline:
  analyze: skipped
  discuss: done
  plan: pending
  work: pending
tags: [retrospect, comparison, pipeline-metrics]
---

# ae:retrospect Comparison Mode

## Problem Statement

ae:retrospect 目前只能生成单次快照报告。当积累多次 review 数据后，用户需要对比不同时期的 pipeline 表现趋势变化。需要决定 comparison 功能的粒度、展示方式和触发机制。

## Topics

| # | Topic | File | Status | Decision |
|---|-------|------|--------|----------|
| 1 | Comparison 粒度 | [topic-01-comparison-granularity/](topic-01-comparison-granularity/) | converged | A — 报告级对比 |
| 2 | Delta 展示格式 | [topic-02-delta-presentation/](topic-02-delta-presentation/) | converged | C — 箭头 + 绝对 delta |
| 3 | Auto-compare 触发方式 | [topic-03-auto-compare-trigger/](topic-03-auto-compare-trigger/) | converged | A — 显式 compare |
