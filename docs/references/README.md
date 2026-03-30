# References — 知识来源与借鉴记录

ae 的设计借鉴了多个外部来源。每个来源记录：出处、借鉴了什么、淘汰了什么、以及为什么。

## Index

| 来源 | 文件 | 借鉴 | 淘汰 |
|------|------|------|------|
| LLM Self-Preference Bias 论文 | [cross-family-rationale.md](cross-family-rationale.md) | Cross-family review 的理论基础 | — |
| OpenAI Harness Engineering | [harness-engineering.md](harness-engineering.md) | 评判标准、drift detection | Context budget 硬限制、CLAUDE.md 目录化 |
| Anthropic Long-Running Apps | [harness-engineering.md](harness-engineering.md) | Auto-pass gate 设计 | Context checkpoint（无原生 API） |
| Ralph Wiggum 自主循环 | [harness-engineering.md](harness-engineering.md) | 启发了 auto-pass 默认开的方向 | Stop hook 循环（与 ae review-heavy 流程不兼容）|
| NykDev "Agreement is a bug" | [nyk-framework.md](nyk-framework.md) | 结构化分歧格式、分歧价值评估 | Education Gate、Capture Stack、Independent Perspective agent |
