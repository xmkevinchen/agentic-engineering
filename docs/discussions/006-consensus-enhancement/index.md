---
id: "006"
title: "Consensus Enhancement — Anti-groupthink, Modes, Cross-examination"
status: concluded
created: 2026-03-31
pipeline:
  analyze: skipped
  discuss: done
  plan: pending
  work: pending
plan: "docs/plans/005-adaptive-mediator-consensus.md"
tags: [consensus, debate, anti-groupthink, cross-family, workflow]
---

# Consensus Enhancement — Anti-groupthink, Modes, Cross-examination

## Problem Statement

`/ae:consensus` 当前是固定的 5-agent 单轮辩论结构（advocate + critic + mediator + codex-proxy + gemini-proxy）。受 Council of High Intelligence 项目启发，识别出几个结构性改进点：辩论可能流于形式（缺乏 anti-groupthink）、小决策过重（无轻量模式）、对立方不直接交锋（无 cross-examination）。需要决定哪些机制该加入工作流，如何设计。

## Topics

| # | Topic | File | Status | Decision |
|---|-------|------|--------|----------|
| 1 | Anti-groupthink 机制 | [topic-01-anti-groupthink/](topic-01-anti-groupthink/) | converged | 合并入 adaptive mediator（不作为独立特性） |
| 2 | Quick/Duo 轻量模式 | [topic-02-lightweight-modes/](topic-02-lightweight-modes/) | converged | --quick flag + adaptive 自动判断 |
| 3 | Cross-examination 交锋轮 | [topic-03-cross-examination/](topic-03-cross-examination/) | converged | 合并入 adaptive mediator（条件触发） |
| 4 | 对立立场的 Provider 路由 | [topic-04-polarity-routing/](topic-04-polarity-routing/) | converged | 保持独立评估（撤回定向挑战） |

## Documents
- [Conclusion](conclusion.md) *(after discussion complete)*
