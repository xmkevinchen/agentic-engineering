---
id: "05"
title: "命令级工具权限控制"
status: converged
current_round: 2
created: 2026-03-31
decision: "维持现状 + 显式注释"
rationale: "Doodlestein 三方一致：reviewer agent 已无 Write/Edit（code-reviewer.md:4 等），精准收紧找不到收紧对象。决策改为确认并显式化已有约束：在 reviewer agent tools: 行加注释 # Write/Edit intentionally excluded — review only。"
reversibility: "high"
---

# Topic: 命令级工具权限控制

## Current Status
已收敛（经 Doodlestein 修正）：维持现状 + 显式注释。原 A 精简版被 Doodlestein 挑战推翻。

## Round History
| Round | Score | Key Outcome |
|-------|-------|-------------|
| 1 | revisit | Codex: B, Gemini: C, Challenger: A精简版 — 三方分歧 |
| 2 | converged | Codex/Gemini 转向 A 精简版，三方收敛 |
| Doodlestein | modified | 三方一致：T5 解决不存在的问题，改为维持现状+显式注释 |

## Context
codex-plugin-cc 使用了两个 Claude Code 命令级特性：

1. **`allowed-tools`**：限制命令可以使用的工具。例如 `/codex:review` 只允许 `Read, Glob, Grep, Bash(node:*), Bash(git:*), AskUserQuestion` — 不能 Write/Edit，确保 review 不会改代码。
2. **`disable-model-invocation: true`**：命令不做 LLM 推理，只调工具。`/codex:review` 本质上就是跑一个 node 脚本然后返回输出，Claude 不添加任何解读。

我们的 skill 都是完全开放的 — 没有工具限制，TL（Claude）在执行 skill 时可以调用任何工具。这在大多数场景下是对的（/ae:work 需要完整工具链），但某些场景下可能导致问题：
- /ae:code-review 做完 review 后自动开始修代码（应该先问用户）
- proxy agent 不应该自己改代码（它们是翻译层）

## Options

### A: 给特定 skill 加 `allowed-tools` 限制
- `/ae:code-review`：不允许 Write/Edit（review only, don't fix）
- Proxy agent：只允许 Read + MCP 工具 + SendMessage
- 其他 skill 保持完全开放
- **Pros**: 结构性防护，不依赖 prompt 指令；符合最小权限原则
- **Cons**: Claude Code 的 `allowed-tools` 语法是否支持 agent 级别？需要验证；可能限制灵活性

### B: 用 prompt 指令而非工具限制
- 在 prompt 里明确说 "不要修改代码" / "只做 review"
- 依赖 LLM 遵守指令
- **Pros**: 简单，不需要了解 allowed-tools 语法；灵活
- **Cons**: LLM 可能不遵守（尤其在长上下文中）；不如结构性防护可靠

### C: 等 Claude Code 功能成熟后再考虑
- `allowed-tools` 和 `disable-model-invocation` 可能是较新的 command 特性
- 等确认 SKILL.md 也支持这些字段后再采用
- **Pros**: 不冒险用不确定的特性
- **Cons**: 延迟有价值的改进

## Recommendation
倾向 A（部分采用）— 先验证 SKILL.md 是否支持 `allowed-tools`，如果支持就给 `/ae:code-review` 加上。proxy agent 级别的限制可能需要不同机制（agent 定义的 `tools:` 字段已经存在）。
