---
id: "01"
title: "Scratch 的正确用途和改造方案"
status: pending
current_round: 0
created: 2026-03-30
decision: ""
rationale: ""
reversibility: ""
---

# Topic: Scratch 的正确用途和改造方案

## Current Status
待讨论。

## Round History
| Round | Score | Key Outcome |
|-------|-------|-------------|

## Context

Scratch 当初设计为 "session 崩溃后恢复用的临时持久化"。但实际使用中变成了产出物的暂存区 — think/consensus/trace 先写 scratch 再问用户要不要存到项目目录，team 的结果也默默写进 scratch。

核心矛盾：**值得保存的东西应该直接写到项目目录，不值得保存的东西写到 scratch 也没用。**

## Options

### A: Scratch 只保留 session recovery，产出物直接写项目目录

- think/consensus/trace → 直接写到 `output.analyses`，不经过 scratch
- team → 直接写到 `output.analyses` 或项目指定位置
- code-review → `in_progress` 状态可以用项目内的临时文件（`.claude/tmp/`）
- Session recovery → 改用项目内的 `.claude/tmp/` 目录替代 `~/.claude/scratch/`
- 完全去掉 `~/.claude/scratch/`

**Pros**: 所有产出物在项目目录，git 可追踪；没有中间步骤；目录结构清晰
**Cons**: think/consensus/trace 的结果不一定每次都值得保存到项目（有时只是随手想想）

### B: 保留 scratch 作为 "草稿纸"，但改到项目内

把 scratch 从 `~/.claude/scratch/` 移到 `.claude/scratch/`（项目内）：
- 仍然是 "先写 scratch 再决定存不存"
- 但 scratch 在项目目录内，git 可以选择追踪或 .gitignore

**Pros**: 最小改动；草稿纸功能保留；在项目内
**Cons**: 还是两步（写 scratch → 决定搬不搬）；`.claude/scratch/` 里积累垃圾

### C: 分两类处理

- **高价值产出** (think/consensus/trace/team) → 直接写项目目录，不问 "要不要存"
- **临时状态** (code-review `in_progress`、session recovery) → 用 `.claude/tmp/`（项目内），自动清理

**Pros**: 区分了两种需求；高价值不丢、临时不积累
**Cons**: 要改 5+ 个 skill；"高价值" 和 "临时" 的分界不总是清晰

### D: 去掉 scratch，去掉 "要不要存" 的询问

所有产出物直接写到项目目录对应位置。不问用户。Session recovery 用 git stash 或 worktree 替代。

- think → 直接写 `output.analyses/think-NNN.md`
- consensus → 直接写 `output.analyses/consensus-NNN.md`
- trace → 直接写 `output.analyses/trace-NNN.md`
- team → 直接写 `output.analyses/team-NNN.md`
- code-review → 状态记在 commit message 或 plan checkbox，不用单独文件

**Pros**: 最简单；没有 scratch、没有暂存、没有 "要不要存"；所有产出物自动落盘
**Cons**: 有时用户只是随手试试，不想在项目里留文件（但可以 git clean）

## Recommendation

待讨论。
