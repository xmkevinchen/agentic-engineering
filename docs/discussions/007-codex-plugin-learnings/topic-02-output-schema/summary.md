---
id: "02"
title: "结构化输出约束（JSON Schema vs Markdown）"
status: converged
current_round: 1
created: 2026-03-31
decision: "B — Markdown + verification 指令"
rationale: "MCP proxy 是文本通道，JSON Schema 增加 parse failure mode。更严格的 Markdown 格式 + verification 指令在 LLM 能力范围内且人可读。与 Topic 1 一致：内联到 proxy agent 定义。"
reversibility: "high"
---

# Topic: 结构化输出约束（JSON Schema vs Markdown）

## Current Status
已收敛：B — Markdown + verification 指令。四方一致（Codex/Gemini/两个 proxy）。

## Round History
| Round | Score | Key Outcome |
|-------|-------|-------------|
| 1 | converged | 四方一致选 B，MCP 文本通道约束下 JSON 无结构性优势 |

## Context
codex-plugin-cc 用 JSON Schema（`review-output.schema.json`）强制 review 输出结构：verdict (approve/needs-attention)、findings[]（每个有 severity/title/body/file/line_start/line_end/confidence/recommendation）、next_steps[]。

我们当前用 Markdown 约定（challenger 的 Claim/Evidence/Objection/Confidence 格式）。好处是人可读、灵活；坏处是格式遵从全靠 prompt 指令，LLM 可能偏离。

关键差异：codex-plugin-cc 的 Codex 直接返回 JSON（Codex app server 支持 outputSchema 参数）。我们的 cross-family 通过 MCP proxy 通信，Codex MCP 和 Gemini MCP 返回的是文本，不是结构化数据。

## Options

### A: 给 cross-family 输出加 JSON Schema
- 在 prompt 中要求 Codex/Gemini 返回 JSON，proxy agent 解析后转为结构化 findings
- 定义 `schemas/` 目录，每种任务类型一个 schema（review, consensus, plan-review）
- **Pros**: 输出格式严格保证；可程序化处理；与 codex-plugin-cc 一致
- **Cons**: Gemini MCP 返回文本不是 JSON，需要 proxy 解析；LLM 返回的 JSON 可能格式错误；增加复杂度

### B: 保持 Markdown 约定，但加校验指令
- 不用 JSON Schema，但在 prompt 里更严格地定义 Markdown 格式
- 加 "检查你的输出是否包含所有必需字段" 的 verification 指令
- **Pros**: 简单；人可读；不依赖 JSON 解析
- **Cons**: 格式遵从仍靠 prompt；没有程序化校验

### C: Hybrid — 内部结构化，外部 Markdown
- Proxy agent 向 Codex/Gemini 发 prompt 时要求结构化输出（JSON 或 XML tagged）
- Proxy 接收后转为 Markdown 格式发给 team（SendMessage 用 Markdown）
- **Pros**: 兼得结构化和可读性；proxy 做翻译层
- **Cons**: proxy 负责格式转换，增加复杂度

## Recommendation
倾向 B — 我们的 MCP proxy 本质是文本通道，强制 JSON 反而增加 failure mode（JSON parse error）。更好的方式是用更严格的 Markdown 约定 + verification 指令，这在 LLM 能力范围内且人可读。
