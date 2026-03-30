---
id: BL-006
title: "Autonomous Nestable Workflow"
type: backlog
created: 2026-03-30
status: open
---

# Autonomous Nestable Workflow

讨论可以递归拆分并行，每次讨论结果要么 plannable 要么 spawn 新讨论。

前提：
- 讨论收敛机制必须先稳固（Discussion 003 Phase 1 已完成）
- 需要 Phase 2（嵌套讨论 + 子 discussion spawn）和 Phase 3（并行子讨论）

设想：
- 系统自己判断什么时候该拆、怎么拆、拆完怎么汇总
- Divide and conquer + Agent Teams 并行
- 嵌套深度建议最多 2 层

这是 ae 的下一个大方向，不是短期能做的。
