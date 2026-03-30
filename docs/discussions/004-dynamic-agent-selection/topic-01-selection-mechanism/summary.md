---
id: "01"
title: "Agent 选择机制 — 从硬编码到 context-aware"
status: pending
current_round: 0
created: 2026-03-30
decision: ""
rationale: ""
reversibility: ""
---

# Topic: Agent 选择机制

## Current Status
待讨论。

## Round History
| Round | Score | Key Outcome |
|-------|-------|-------------|

## Context

当前 ae 的 13 个 agents：

**Review** (5): architecture-reviewer, code-reviewer, performance-reviewer, security-reviewer, simplicity-reviewer
**Research** (3): archaeologist, dependency-analyst, standards-expert
**Workflow** (5): architect, challenger, qa, codex-proxy, gemini-proxy

加上项目 agents（如 SmartPal 的 backend-dev, ios-dev, swift-reviewer）。

选择方式：每个 skill 硬编码组合。`/ae:team` 有一个 8 类查表（architecture/security/performance/debug/review/research/design/general），但粒度粗。

### 核心问题

同一个 skill（如 `/ae:review`）对不同 context 需要不同 team：
- Review 一个 iOS UI 改动 → swift-reviewer + simplicity-reviewer + qa（不需要 performance-reviewer）
- Review 一个数据库迁移 → performance-reviewer + security-reviewer + architect（不需要 simplicity-reviewer）
- Review 一个 API 认证改动 → security-reviewer + architecture-reviewer + codex(扮演 auth-specialist)

## Options

### A: Agent 描述匹配（TL 选）

TL 读取所有可用 agents 的 description，根据当前 task context 选择最合适的 2-5 个。

```
当前 task: "Review database migration adding new user_sessions table"

TL 分析 context → 选择:
- performance-reviewer (DB queries, indexes)
- security-reviewer (session data = sensitive)
- architect (schema design)
- codex-proxy (cross-family, role: migration specialist)
跳过: simplicity-reviewer, code-reviewer (不是主要关注点)
```

实现：在每个 skill 的 "Agent Teams" 段落改为 "分析 context + 从可用 agents 中选择" 的指令，而不是硬编码列表。

- **Pros**: 最小改动（纯 SKILL.md 指令）；灵活；TL 有完整上下文做判断
- **Cons**: 又是靠 TL 判断（TL 可能偷懒选默认的全部）；选择过程不透明

### B: Agent 自荐（Agent 选）

启动 team 时先广播 task description 给所有可用 agents，每个 agent 自评 "我对这个 task 有多相关"（1-10），TL 选 top N。

```
Broadcast: "Review database migration adding new user_sessions table"
- performance-reviewer: 9 (DB queries are my core focus)
- security-reviewer: 8 (session data needs protection review)
- architect: 7 (schema design review)
- simplicity-reviewer: 3 (not very relevant)
- code-reviewer: 4 (general review, not specialized)

TL picks top 4: performance, security, architect, + codex-proxy
```

- **Pros**: 每个 agent 自评相关度；TL 有数据支撑决策
- **Cons**: 广播给所有 agent 有 token 成本；agent 可能高估自己的相关度

### C: 标签匹配（自动化）

每个 agent 的 .md frontmatter 加 `tags`，task context 也提取 tags，自动匹配。

```yaml
# security-reviewer.md
tags: [auth, encryption, injection, data-protection, secrets]

# performance-reviewer.md
tags: [database, queries, algorithms, memory, io]

# Task context tags (自动提取):
# "database migration" → [database, schema, migration]
# 匹配: performance-reviewer (database), architect (schema)
```

- **Pros**: 全自动；不依赖 TL 判断；可扩展（新 agent 加 tags 就行）
- **Cons**: tag 匹配粗糙；可能漏选（agent 没加对的 tag）；context 到 tags 的提取本身不可靠

### D: 混合 — 标签预筛 + TL 确认

C 的自动匹配产出候选列表，TL 确认或调整。

```
自动匹配建议: performance-reviewer, architect, security-reviewer
TL: "加上 codex-proxy 扮演 migration-specialist，去掉 security-reviewer（纯 schema 改动无安全问题）"
最终 team: performance-reviewer, architect, codex-proxy(migration-specialist)
```

- **Pros**: 自动化基础 + 人工调整；不完全依赖 TL 也不完全依赖自动化
- **Cons**: 需要 tag 体系 + TL 确认两步；tag 不好就建议不好

## Recommendation

待讨论。
