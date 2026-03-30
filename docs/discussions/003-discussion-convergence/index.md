---
id: "003"
title: "讨论收敛机制 — 可靠收敛到高质量结论"
status: active
created: 2026-03-29
pipeline:
  analyze: skipped
  discuss: in_progress
  plan: pending
  work: pending
plan: ""
tags: [convergence, discussion-mechanism, process-integrity, terminal-states, tl-checks]
---

# 讨论收敛机制

基于 Meta 内部 AE 的大量实战经验。

## 问题陈述

怎么让 `/ae:discuss` 可靠地收敛到高质量结论？

这包含三个不可分割的面：
1. **评判标准** — 什么是 "好的讨论"？TL 用什么数据和标准来判断？
2. **终态定义** — 讨论收敛到哪里？不是所有问题都能 "decided"，需要 resolved/decomposed/irresolvable 三态
3. **执行保障** — 理性 TL 有工具做好判断；非理性 TL 有兜底机制阻止

三者拆开讨论没有意义 — 没标准就没法定义终态，有标准但 TL 能绕过就等于没有。

## Topics

| # | Topic | File | Status | Decision |
|---|-------|------|--------|----------|
| 1 | 讨论收敛的完整机制 | [topic-01-convergence-mechanism.md](topic-01-convergence-mechanism.md) | resolved | B: 分阶段（三态 + Sweep 先行） |

## Documents
- [Conclusion](conclusion.md) *(generated after topic decided)*
