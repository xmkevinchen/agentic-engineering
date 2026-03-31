---
id: "005"
title: "Scratch 重新定位 — 从产出物暂存到纯临时状态"
status: active
created: 2026-03-30
pipeline:
  analyze: done
  discuss: in_progress
  plan: pending
  work: pending
plan: ""
tags: [scratch, persistence, output, session-recovery]
---

# Scratch 重新定位

## 问题陈述

当前 scratch（`~/.claude/scratch/`）承担了两个不同的职责：
1. **Session recovery** — 记录 `in_progress` 状态，session 崩溃后恢复
2. **产出物暂存** — 先写 scratch，再问用户要不要正式保存到项目目录

问题：
- 项目产出物不应该在用户 home 目录 — 应该直接写到项目目录
- TL 如果不写到项目目录，也不会写到 scratch（scratch 不解决 "不写" 的问题）
- "先写 scratch 再搬" 是多余的中间步骤

## 当前使用分析

| Skill | 用法 | Scratch 角色 |
|-------|------|-------------|
| work, review, plan, team, think, consensus, trace | Session recovery（扫 `in_progress`） | 临时状态 |
| think, consensus, trace | 产出物暂存 → 问用户存不存 | **应该直接写项目目录** |
| code-review | 写 `in_progress` → 完成改 `resolved` | 临时状态 |
| team | 写 `done` 结果 | **应该直接写项目目录** |
| review | Bulk archive scratch → `output.reviews` | 清理机制 |

## Topics

| # | Topic | File | Status | Decision |
|---|-------|------|--------|----------|
| 1 | Scratch 的正确用途和改造方案 | [topic-01-scratch-scope/](topic-01-scratch-scope/) | pending | — |

## Documents
- [Conclusion](conclusion.md) *(after discussion complete)*
