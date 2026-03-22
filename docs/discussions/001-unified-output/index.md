---
id: "001"
title: "统一 ae 插件文件输出规范"
status: concluded
created: 2026-03-22
pipeline:
  analyze: skipped
  discuss: done
  plan: done
  work: done
plan: "docs/plans/001-unified-output.md"
tags: [output, conventions, pipeline]
---

# 统一 ae 插件文件输出规范

统一所有 ae skill 的文件输出位置、命名规范和格式，消除当前的混乱状态。

## 问题陈述

当前 13 个 skill 的输出完全不一致：
- analyze/discuss 硬编码 `docs/discussions/`
- plan 读 `pipeline.yml → output.plans`（无默认值）
- think 读 `pipeline.yml → output.analyses`（有默认值 `docs/analyses/`）
- work/review 散落在 `docs/milestones/*/notes.md` 和 `docs/backlog/`
- 命名规范不统一（NNN-slug vs topic.md vs 无规定）
- pipeline.yml 的 `output.*` 用法混乱（有的读、有的硬编码、有的没默认值）

## 现状

产出文件的 skill（7 个）：
- `ae:setup` → `.claude/pipeline.yml`, `.claude/cross-family-status.json`（固定路径，合理）
- `ae:analyze` → `docs/discussions/NNN-slug/analysis.md`（硬编码）
- `ae:discuss` → `docs/discussions/NNN-slug/topic-NN-slug.md`（硬编码）
- `ae:plan` → `pipeline.yml → output.plans`（可配，无默认值）
- `ae:work` → 原地更新 plan + `docs/milestones/*/notes.md` + `docs/backlog/`
- `ae:review` → `notes.md`（路径不明） + `docs/backlog/`
- `ae:think` → `pipeline.yml → output.analyses`（可配，默认 `docs/analyses/`）

仅终端输出的 skill（5 个）：code-review, consensus, trace, team, cross-family-review

代码文件输出：testgen（写到项目测试目录，合理）

## 议题

| # | 议题 | 文件 | 状态 | 决定 |
|---|------|------|------|------|
| 1 | 输出根目录选择 | [topic-01-output-root.md](topic-01-output-root.md) | ✅ 废弃 | 被议题 2 合并取代 |
| 2 | pipeline.yml 配置粒度 | [topic-02-config-granularity.md](topic-02-config-granularity.md) | ✅ 已决定 | D — 语义槽 + 合理默认值，无 root |
| 3 | 文件命名与格式规范 | [topic-03-naming-format.md](topic-03-naming-format.md) | ✅ 已决定 | B — 每类独立编号 + slug |
| 4 | 终端 skill 持久化策略 | [topic-04-terminal-persistence.md](topic-04-terminal-persistence.md) | ✅ 已决定 | D — 临时持久化 + 主动提醒正式保存 |

## 文档
- [结论](conclusion.md)
