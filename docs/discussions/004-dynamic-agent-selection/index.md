---
id: "004"
title: "动态 Agent 选择 — 根据 context 组建最优团队"
status: active
created: 2026-03-30
pipeline:
  analyze: skipped
  discuss: in_progress
  plan: pending
  work: pending
plan: ""
tags: [agent-selection, dynamic-teams, cross-family-roles, context-aware]
---

# 动态 Agent 选择

## 问题陈述

当前每个 skill 硬编码了使用哪些 agents：
- `/ae:plan` review → 固定 architect + dependency-analyst + simplicity-reviewer + codex-proxy + gemini-proxy
- `/ae:review` → 固定 security-reviewer + performance-reviewer + architecture-reviewer + challenger + codex-proxy + gemini-proxy
- `/ae:team` → 按 task type 查 8 种固定组合表

问题：
1. **不匹配 context** — UI 改动不需要 performance-reviewer，数据库迁移不需要 simplicity-reviewer，但现在都会被拉进来
2. **cross-family 是通用角色** — codex-proxy 和 gemini-proxy 只是 "把东西丢给另一个 model"，没有专业化角色
3. **浪费 token** — 不相关的 agent 在 team 里消耗 context 但不产生价值
4. **不可扩展** — 项目加了新 agent（如 swift-reviewer、backend-dev），skill 不知道怎么用它们

## 目标

Agent 选择应该是：
```
问题 context → 分析 → 选择最合适的 agent set → 每个 agent 有明确 role
```

包括 cross-family agents — codex 和 gemini 也应该根据 context 扮演不同角色。

## Topics

| # | Topic | File | Status | Decision |
|---|-------|------|--------|----------|
| 1 | Agent 选择机制 | [topic-01-selection-mechanism/](topic-01-selection-mechanism/) | pending | — |
| 2 | Cross-family 角色化 | [topic-02-cross-family-roles/](topic-02-cross-family-roles/) | pending | — |

## Documents
- [Conclusion](conclusion.md) *(after discussion complete)*
