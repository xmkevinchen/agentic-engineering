---
id: "04"
title: "终端 skill 持久化策略"
status: decided
created: 2026-03-22
decision: "D — 临时持久化 + 主动提醒正式保存"
rationale: "解决 session compact 丢信息问题。所有产出自动写临时文件，skill 完成后主动问用户是否正式保存。不需要用户记参数，也不丢信息。"
---

# 议题：终端 skill 持久化策略

## 背景

当前 5 个 skill 仅输出到终端：code-review, consensus, trace, team, cross-family-review。其中 cross-family-review 是被动知识文档，不产出内容，不在此讨论范围。

核心问题不只是"要不要写文件"，还有 **session compact 会丢信息**。一次 `/ae:trace` 的依赖图、一次 `/ae:consensus` 的三轮辩论，compact 后可能只剩摘要甚至消失。

## 选项

### A：全部保持终端输出

不改变任何终端 skill 的行为。

- **优点**：最简单；不增加复杂度
- **缺点**：compact 后信息丢失；review 阶段无法引用之前的 trace

### B：trace 和 consensus 可选持久化（`--save` 参数）

默认终端输出，用户加 `--save` 参数时写入正式目录。

- **优点**：按需持久化，不强制
- **缺点**：用户需要提前知道要保存；忘加参数就丢了；compact 问题未解决

### C：所有分析类 skill 默认持久化

trace、consensus、think 全部默认写文件。

- **优点**：知识不丢失
- **缺点**：文件膨胀；有些只是临时查看

### D：临时持久化 + 主动提醒正式保存（讨论中产生）

两层策略：

1. **自动临时持久化**：所有产出内容的 skill 跑完自动写临时文件（`.claude/scratch/`），用户无感。解决 compact 丢信息问题。
2. **主动提醒**：skill 完成后主动问用户"这个结果要正式保存吗？"
3. **正式保存**：用户确认后 move 到对应的 output slot（如 `docs/traces/001-auth-flow.md`）
4. **不保存**：临时文件保留到下次清理或 session 结束

适用范围：
- `trace` — 依赖图有 plan 阶段引用价值 → 问
- `consensus` — 辩论结论有 discuss 阶段引用价值 → 问
- `code-review` — 每次 commit 前的快速审查，量大且临时 → 不问，只临时保存
- `team` — agent 选择过程，纯临时 → 不问，只临时保存

- **优点**：compact 安全；用户不需要记参数；主动提醒不会漏；不强制膨胀文件
- **缺点**：需要 `.claude/scratch/` 临时目录管理；多一步交互

## 建议

推荐 **D**。解决了选项 B 的"忘加参数"问题和选项 C 的"文件膨胀"问题，同时彻底解决 compact 丢信息的核心痛点。

## 附注：cross-family-review 的归属

`ae:cross-family-review` 是被动知识文档，不是用户可调用的 slash command，不产出任何内容。应考虑从 skills/ 移到更合适的位置（如 docs/ 或 agents/ 的参考文档）。
