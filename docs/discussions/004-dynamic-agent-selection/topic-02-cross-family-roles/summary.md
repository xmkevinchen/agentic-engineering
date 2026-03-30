---
id: "02"
title: "Cross-family 角色化 — Codex/Gemini 不只是 second opinion"
status: converged
current_round: 2
decision: "TL 根据 context 决定 cross-family 的角度"
rationale: "Cross-family 是外部专家，需要明确的审查角度。TL 有足够上下文判断从什么角度最能发现盲区。Naive 版本先做起来，后续根据实战数据迭代。"
reversibility: "high"
created: 2026-03-30
decision: ""
rationale: ""
reversibility: ""
---

# Topic: Cross-family 角色化

## Current Status
待讨论。

## Round History
| Round | Score | Key Outcome |
|-------|-------|-------------|

## Context

当前 codex-proxy 和 gemini-proxy 的使用方式：
- "把这个 plan 发给 Codex 看看" — 通用 review
- "把这个 diff 发给 Gemini 看看" — 通用 review
- 没有专业化角色，每次都是 "你觉得这个怎么样？"

这浪费了 cross-family 的潜力。Codex（OpenAI 系）和 Gemini（Google 系）各有擅长的领域，应该根据 context 给它们**专业化角色**。

### 当前 proxy agent 的工作方式

`codex-proxy.md`：接收 prompt → 调用 `mcp__plugin_ae_codex__codex` → 返回结果
`gemini-proxy.md`：接收 prompt → 调用 `mcp__plugin_ae_gemini__chat` → 返回结果

Prompt 内容完全由调用方决定。proxy 只是通道。

### 角色化的意思

不是改 proxy agent 本身，而是在组 team 时给 proxy 一个**专业化的 prompt**：

```
# 现在（通用）
Agent(subagent_type: "codex-proxy", prompt: "Review this plan for issues")

# 角色化
Agent(subagent_type: "codex-proxy", prompt: "As a database migration specialist,
      review this migration plan. Focus on: index strategy, data integrity during
      migration, rollback plan, zero-downtime approach.")
```

同一个 codex-proxy agent，不同的专业化 prompt。

## Options

### A: Prompt 模板化

为常见角色预定义 prompt 模板，team 组建时根据 context 选择：

```
Cross-family role templates:
- security-specialist: "Focus on auth, injection, data protection..."
- performance-specialist: "Focus on query optimization, caching, N+1..."
- migration-specialist: "Focus on data integrity, rollback, zero-downtime..."
- api-specialist: "Focus on contract compatibility, versioning, error handling..."
- architecture-specialist: "Focus on module boundaries, dependency direction..."
```

TL 组 team 时：
```
Agent(subagent_type: "codex-proxy",
      prompt: "<security-specialist template> + <specific task context>")
Agent(subagent_type: "gemini-proxy",
      prompt: "<performance-specialist template> + <specific task context>")
```

- **Pros**: 简单；模板可复用；不改 proxy agent 代码
- **Cons**: 模板有限，新场景需要加新模板；TL 要选模板

### B: Context 驱动动态 prompt

不预定义模板，让 TL 根据 context 直接构造专业化 prompt：

```
TL 分析: "数据库迁移，涉及 user_sessions 表"
→ codex-proxy prompt: "你是数据库迁移专家。审查这个迁移：[具体内容]。
   关注：索引策略、数据完整性、回滚方案。"
→ gemini-proxy prompt: "你是性能分析专家。评估这个新表的查询性能：[具体内容]。
   关注：索引覆盖度、预期查询模式、分页策略。"
```

- **Pros**: 最灵活；完全适配当前 context；不需要维护模板库
- **Cons**: 依赖 TL 写好 prompt（又是 TL 能力问题）；每次都要想

### C: Agent 描述中声明 cross-family 适用场景

在每个 review/research agent 的 .md 中声明 "如果 cross-family 可用，建议给 codex/gemini 什么角色"：

```yaml
# performance-reviewer.md
cross_family_roles:
  codex: "query optimization specialist — review SQL/ORM queries for N+1, missing indexes"
  gemini: "load testing analyst — estimate throughput under specified concurrency"
```

组 team 时，已选的 Claude agents 自动带出对应的 cross-family 角色建议。

- **Pros**: 角色建议和 agent 能力绑定；新 agent 自带 cross-family 指导
- **Cons**: 每个 agent 要维护额外字段；codex/gemini 的能力可能变化

## Recommendation

待讨论。
