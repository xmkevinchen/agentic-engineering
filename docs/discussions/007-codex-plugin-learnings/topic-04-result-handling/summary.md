---
id: "04"
title: "Result Handling 规范"
status: converged
current_round: 1
created: 2026-03-31
decision: "B — 加入 proxy agent 定义，5 条 result handling 规则"
rationale: "Topic 1 已决定不创建独立 prompting skill（Option C 失效）。5 条规则加入 codex-proxy.md 和 gemini-proxy.md。no auto-fix 边界：代码片段作为 fix suggestion 可以，但不能包含执行指令。Doodlestein 挑战后澄清。"
reversibility: "high"
---

# Topic: Result Handling 规范

## Current Status
已收敛：B — 加入 proxy agent 定义。三方一致。Doodlestein 后澄清 no auto-fix 边界。

## Round History
| Round | Score | Key Outcome |
|-------|-------|-------------|
| 1 | converged | 三方一致选 B。Challenger 强调 no auto-fix 最重要，Doodlestein 挑战后澄清边界定义 |

## Context
codex-plugin-cc 有一个 `codex-result-handling` 内部 skill（`user-invocable: false`），规定了如何呈现 Codex 返回的结果。关键规则：

1. **保持原始结构**：preserve verdict, summary, findings, next steps 的顺序
2. **保持证据边界**：如果 Codex 标注了 "inference" 或 "uncertainty"，保持这个区分
3. **不要二次加工**：不要把 Codex 的输出改写、总结、添加评论
4. **严禁自动修复**：review 完后必须问用户哪些要修，不能直接改代码
5. **失败时诚实**：如果 Codex 调用失败，不要用 Claude 的输出替代

我们的 proxy agent 定义里有类似的指导（"Translator, not parrot"），但没有这么系统化。特别是：
- 我们没有明确 "不要用 Claude 替代失败的 cross-family 结果"
- 我们没有 "保持 inference vs fact 区分" 的规则

## Options

### A: 创建 `result-handling` 内部 skill
- `user-invocable: false`，被所有 proxy agent 引用
- 规定：输出保持原始结构、不二次加工、保持 inference/fact 区分、失败时不替代
- **Pros**: 系统化；所有 proxy 行为一致
- **Cons**: 又一个 skill 文件；proxy 定义里已有部分指导，可能冗余

### B: 把规则加入现有 proxy agent 定义
- 在 codex-proxy.md 和 gemini-proxy.md 的 "Team Communication Protocol" 部分加入 result handling 规则
- **Pros**: 不新增文件；信息集中在 agent 定义里
- **Cons**: 两个 proxy 要分别加；规则可能不一致

### C: 合并到 Topic 1 的 prompting skill 里
- 如果 Topic 1 决定做 prompting skill，result handling 作为其中一个 section
- **Pros**: 减少文件数；prompt 组装和结果处理放在一起合理
- **Cons**: 一个 skill 职责可能太多

## Recommendation
倾向 C — 如果 Topic 1 做了 prompting skill，result handling 自然是它的一部分（"怎么发 prompt" + "怎么处理结果" 是一个完整流程）。如果 Topic 1 不做，fallback 到 B。
