---
id: "002"
title: "Agent Harness 改进 — 评判标准、自动化、drift detection"
status: active
created: 2026-03-29
pipeline:
  analyze: done
  discuss: in_progress
  plan: pending
  work: pending
plan: ""
tags: [harness, evaluation, automation, drift-detection, agent-engineering]
---

# Agent Harness 改进

基于 Meta 内部 AE 的实战经验，识别三个核心痛点并设计改进方案。

## 问题陈述

三个痛点是同一条因果链：

```
缺乏可靠评判标准 → 不敢自动化（需要人盯）→ agent 跑偏时没有机制拉回来
```

1. **评判标准** — code review 有 checklist + P1/P2/P3，但讨论决策和执行计划缺乏可量化的质量 gate
2. **自动化** — 每步暂停等人确认，没有 "什么条件下可以自动继续" 的判定机制
3. **Drift detection** — agent 跑偏靠 review 事后发现，没有执行中的实时检测和拉回

## 参考来源

- Meta 内部 AE 实战（90+ diffs, 5000+ LOC，自举开发）
- [OpenAI: Harness Engineering](https://openai.com/index/harness-engineering/)
- [Anthropic: Harness Design for Long-Running LLM Apps](https://www.anthropic.com/engineering/harness-design-long-running-apps)
- [Ralph Wiggum 自主循环模式](https://paddo.dev/blog/ralph-wiggum-autonomous-loops/)
- [LLM Self-Preference Bias (NeurIPS 2024)](https://arxiv.org/abs/2404.13076)

## Topics

| # | Topic | File | Status | Decision |
|---|-------|------|--------|----------|
| 1 | 评判标准体系 | [topic-01-evaluation-criteria.md](topic-01-evaluation-criteria.md) | pending | — |
| 2 | 自动化判定机制 | [topic-02-automation-gates.md](topic-02-automation-gates.md) | pending | — |
| 3 | Drift Detection | [topic-03-drift-detection.md](topic-03-drift-detection.md) | pending | — |

## Documents
- [Team Report (v1, archived)](team-report.md) *(first round, mostly archived)*
- [Conclusion](conclusion.md) *(generated after all topics decided)*
