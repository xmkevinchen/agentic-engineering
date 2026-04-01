---
id: "01"
title: "Cross-family Prompting Skill"
status: converged
current_round: 1
created: 2026-03-31
decision: "B — 直接强化 proxy agent 定义，各自内联 prompt blocks"
rationale: "agent 定义是 runtime system prompt，是唯一直接生效的载体。skill 是 CLI 接口不会被 agent 自动读取。两个 proxy 需求不同不需要统一。"
reversibility: "high"
---

# Topic: Cross-family Prompting Skill

## Current Status
已收敛：B — 强化 proxy agent 定义

## Round History
| Round | Score | Key Outcome |
|-------|-------|-------------|
| 1 | converged | B — agent 定义是正确载体，不建新 skill |

## Context
OpenAI 的 codex-plugin-cc 有一个 `gpt-5-4-prompting` 内部 skill（`user-invocable: false`），包含：
- **Prompt blocks 库**：12 个可复用 XML block（`<task>`, `<structured_output_contract>`, `<grounding_rules>`, `<verification_loop>`, `<action_safety>` 等），每个有明确使用场景
- **Prompt recipes**：5 种任务模板（Diagnosis, Narrow Fix, Root-Cause Review, Research, Prompt-Patching），直接可用
- **Anti-patterns**：6 种常见错误（vague framing, missing output contract, 用 "think harder" 代替 verification_loop 等）
- **组装清单**：5 步 checklist，确保每个 prompt 覆盖关键维度

我们的现状：codex-proxy 和 gemini-proxy agent 定义里各自有一些 prompt 指导，但不统一、不系统。每次 cross-family 通信的 prompt 质量取决于调用方（skill/TL）的即兴发挥。

## Options

### A: 创建 `cross-family-prompting` 内部 skill
- `user-invocable: false`，被 codex-proxy 和 gemini-proxy agent 通过 `skills:` 引用
- 包含：block 库（适配我们的 Codex MCP + Gemini MCP 双通道）、按任务类型的 recipes（review, plan-review, consensus, analyze）、anti-patterns
- 区分 Codex vs Gemini 的差异（Gemini 没有 repo access，需要发送上下文；Codex 有工具链）
- **Pros**: 系统化、可复用、提升所有 cross-family 交互质量；新 agent 自动获得最佳实践
- **Cons**: 前期工作量；需要持续维护；可能过度约束 prompt 灵活性

### B: 强化现有 proxy agent 定义
- 不创建新 skill，把 prompt 指导直接加到 codex-proxy.md 和 gemini-proxy.md
- 每个 proxy 自己知道怎么组织 prompt
- **Pros**: 简单，不新增文件；proxy 自包含
- **Cons**: 两个 proxy 各自维护 prompt 标准，容易不一致；无法被其他 agent 引用；没有 recipes/anti-patterns 的系统化位置

### C: 创建 `prompts/` 目录（模板文件而非 skill）
- 类似 codex-plugin-cc 的 `prompts/` 目录，放模板 .md 文件
- Proxy agent 在组装 prompt 时引用模板文件
- **Pros**: 模板可以独立版本化；不占用 skill 体系
- **Cons**: 模板引用不如 skill 引用自然；缺少 "使用指南" 部分

## Recommendation
倾向 A — 内部 skill 是最系统化的方式，且 Claude Code 的 `skills:` 引用机制天然支持 agent 引用 skill。codex-plugin-cc 已经验证了这个模式有效。
