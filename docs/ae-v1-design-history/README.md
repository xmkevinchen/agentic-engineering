# AE v1.0 设计史档案

> 设计定稿：2026-08-23 · 入库归档：2026-08-24 · 原路径：`.ae/1.0/`

本目录保存 AE v1.0 从独立研究、交叉评审到设计定稿的完整材料，用于回答“v1.0 的设计是如何形成的”。它是只读的设计来源与决策档案，不是运行时状态目录。

## 阅读顺序

1. 先读 [`docs/references/finalized/README.md`](../references/finalized/README.md)，了解定稿结论与文档权威顺序；
2. 再读 [`docs/references/finalized/source-evaluation.md`](../references/finalized/source-evaluation.md)，了解各来源被采纳、修正或拒绝的原因；
3. 需要追溯原始论证时，再进入 `claude/`、`codex/` 与 `fable-v1/`。

## 档案构成

| 目录 | 性质 | 是否具有规范权威 |
|---|---|---|
| [`claude/`](./claude/) | Claude/CC 原始研究、实测与方案 | 否，仅作来源与审计记录 |
| [`codex/`](./codex/) | Codex 原始设计、实施计划与 Patterns 研究 | 否，仅作来源与审计记录 |
| [`fable-v1/`](./fable-v1/) | 盲写方案、合流方案与最后一次 cross-review | 否，仅作补充来源与审计记录 |
| [`docs/references/finalized/`](../references/finalized/) | 各方经事实核对与冲突裁决后的 AE 1.0 设计定稿 | **是，且仍在生效**；因此不留在本档案里，见 [`docs/references/`](../references/) |

`claude/`、`codex/` 与 `fable-v1/` 保留原始表述，不再并行演进。除归档入口和相对链接修复外，来源材料不作追溯性改写。

本档案记录的是设计冻结时的规范与推导过程。当前实现行为、已完成迁移和发布状态仍以仓库中的代码、测试及现行产品文档为准；若它们与本档案存在差异，应把差异理解为设计落地后的演进，而不是回写历史材料。
