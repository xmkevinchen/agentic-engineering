---
id: BL-007
title: "/ae:setup migrate 模式"
type: backlog
created: 2026-03-30
status: open
---

# /ae:setup migrate 模式

已有 `.claude/` 配置的项目迁移到 ae 插件的 step-by-step 流程。

需要处理：
- 备份重复的 agents（和 ae 内置重叠的）
- 更新 CLAUDE.md 引用
- Reconcile 已有的 pipeline.yml 和 ae 模板
- 保留项目专属 agents 和 skills

SmartPal 的迁移已经手动做了一次（备份到 `.claude/_backup/`），可以作为参考。
