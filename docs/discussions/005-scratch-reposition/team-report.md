---
id: "005"
title: "Scratch 重新定位 — 团队报告"
type: team-report
created: 2026-03-30
status: done
discussion: "005-scratch-reposition"
participants: [team-lead, simplicity-reviewer, challenger, codex-proxy]
---

# 团队报告：Scratch 重新定位

## 讨论摘要

本次讨论评估了 scratch（`~/.claude/scratch/`）的当前用途与改造方案。参与者：team-lead（主持）、simplicity-reviewer（简化审查）、challenger（反驳挑战）、codex-proxy（跨框架研究）。

---

## 现状诊断（四方共识）

scratch 当前同时承担三个职责：

1. **探索性产出暂存**：think/consensus/trace 写 scratch → 问用户要不要搬到 `output.analyses`
2. **低价值产出落盘**：team/code-review 写 scratch，不问用户，视为临时
3. **Session recovery**：work/plan/review/think/consensus/trace 在 pre-check 扫描 `in_progress` 文件

核心问题：**三种职责性质完全不同，用同一个机制处理是根本错误。**

此外，`~/.claude/scratch/` 是全局目录，带来两个附加问题：
- 项目产出物脱离 git 追踪
- 多项目共享目录，容易混淆

---

## 各方主要观点

### simplicity-reviewer

推荐方案 D（完全去掉 scratch，产出物直接落盘）。

关键论据：
- 方案 B（迁移到项目内）改动最小但解决不了根本问题
- 方案 D 的 7-8 个 skill 改动点集中，可一遍完成
- session recovery 没有实际使用证据，是过度设计
- 随手探索后用 `git clean` 清理的成本极低

### challenger

对方案 D 和方案 A 提出有价值的挑战。

**挑战 1（方案 D 的 crash 问题，可信度 85%）**：session recovery 不等于代码恢复。Git stash 解决的是代码变更恢复，解决不了 agent 执行上下文恢复（当前步骤、决策链、中间结果）。方案 D 如果直接删除 session recovery，是功能退化。

**挑战 2（方案 A 的污染问题，可信度 80%）**：think/consensus/trace 经常是"随手一问"的探索性使用，强制写 `output.analyses` 会导致该目录积累大量低价值文件。"先写再决定"的两步流程恰恰是解决这个问题的。

**挑战 3（位置 vs 存在）**：真正的问题可能只是 scratch 的位置（`~/.claude/` 全局）而不是 scratch 的存在，方案 B 被低估。

**挑战 4（层级语义）**：问题不是层级太多，而是各层没有清晰语义边界，Option C 方向正确但需要统一写入规范。

### codex-proxy

跨框架研究（LangGraph、CrewAI、AutoGen）后的结论：

- "先写 temp 再问用户"本身不是反模式，但全局/不透明/混合用途的 temp storage 是反模式
- 崩溃恢复的最佳实践是 checkpoint/journal 机制，与用户可见产出物分离
- 混合策略：执行状态自动持久化 + 推测性中间产物默认临时 + 显式触发转为正式
- 全局 `~/.claude/scratch/` 是 "opaque global" 反模式，应去掉
- **关键洞察**：崩溃恢复和用户草稿是两种完全不同的需求，不应用同一机制处理

---

## 团队分歧点

| 分歧 | simplicity-reviewer | challenger | codex-proxy | team-lead 裁决 |
|------|---------------------|------------|-------------|----------------|
| session recovery 是否值得保留 | 无证据使用，可删 | 有真实价值，不能删 | 应保留但分离 | **保留但分离** — challenger 的挑战有理，但实现可以轻量化 |
| 探索性产出是否直接落盘 | 直接落盘，git clean 清理 | 不能直接落盘，会污染目录 | 混合策略 | **不直接落盘** — challenger 的挑战成立，需要保留"决策点" |
| 方案 B 的价值 | 没有解决根本问题 | 被低估，是有效备选 | 不涉及 | **方案 B 不够** — 保留两步流程但去掉全局路径 |

---

## 最终决策：方案 C（精化版）

综合三方意见，团队倾向**方案 C 的精化版**：

### 原则

> **执行状态** 和 **用户产出** 是两种完全不同的东西，用两套完全不同的机制处理。

### 具体方案

**A. 产出物类（think / consensus / trace）**
- 保留"写草稿 → 询问用户 → 决定是否落盘"的两步流程
- 但草稿改写到 **`.claude/drafts/`**（项目内，而非 `~/.claude/scratch/`）
- git 默认 ignore（加入 `.gitignore`），但可选追踪
- 命名：`think-YYYY-MM-DD-NNN.md`（同现在）

**B. 低价值临时产出类（team / code-review）**
- team：结果仅展示给用户，**不自动落盘**（team 是协作过程，结论已在代码/plan 中体现）
- code-review：`in_progress` 状态写到 `.claude/tmp/`（项目内，TTL 自动清理），review 归档时迁移

**C. Session recovery 类**
- 扫描目标改为 `.claude/tmp/`（项目内），而不是 `~/.claude/scratch/`
- 记录的是**执行状态**（当前 skill、步骤、任务上下文），不是产出物内容
- 轻量实现：一个 JSON 文件 `.claude/tmp/session-state.json`，skill 执行时更新，完成后删除

**D. 废弃 `~/.claude/scratch/`**
- 全局 scratch 完全废弃
- `pipeline.yml` 中删掉 `scratch` 字段
- setup/SKILL.md 不再提及 scratch

### 改动范围

| 文件 | 改动内容 |
|------|---------|
| think/SKILL.md | Persist：scratch 路径改为 `.claude/drafts/` |
| consensus/SKILL.md | Persist：scratch 路径改为 `.claude/drafts/` |
| trace/SKILL.md | Persist：scratch 路径改为 `.claude/drafts/` |
| team/SKILL.md | 删除 Scratch Persistence，改为只展示结果 |
| code-review/SKILL.md | in_progress 状态改写到 `.claude/tmp/` |
| work/SKILL.md | Pre-check Check 0：扫描路径改为 `.claude/tmp/` |
| plan/SKILL.md | Pre-check Check 0：扫描路径改为 `.claude/tmp/` |
| review/SKILL.md | Pre-check + archive：路径从 scratch 改为 `.claude/tmp/` 和 `.claude/drafts/` |
| setup/SKILL.md | 删掉 `scratch` 字段，改为说明 `.claude/drafts/` 和 `.claude/tmp/` |
| pipeline.yml 模板 | 删掉 `scratch` 字段 |

**约 10 个文件，改动点集中，可一遍完成。**

---

## 尚未解决的问题

1. **team 的结果是否值得持久化？** — simplicity-reviewer 和 team-lead 倾向不落盘，但如果 team 的分析本身有高价值（如架构讨论），应该有显式保存选项。建议：team 执行完后询问用户"是否保存到 `output.analyses`"（同 think 一样的决策点），但默认不保存。

2. **`.claude/drafts/` 的清理策略** — 目前没有自动清理机制，草稿会积累。可以在 `/ae:review` 的 "Scratch archive" 步骤中一并处理，但需要更新 review/SKILL.md 的归档逻辑。

3. **session recovery 的实际实现** — `.claude/tmp/session-state.json` 的具体 schema 需要设计。当前 pre-check 只是扫描文件，更精确的状态记录（步骤、上下文）需要各 skill 在执行中主动更新，这比当前实现复杂。建议先保持现有行为（只记录 `in_progress` 状态），只改路径，不改语义。

---

## 行动建议

**下一步**（优先级排序）：

1. **立即执行**：把 scratch 路径从 `~/.claude/scratch/` 改为项目内路径（`.claude/drafts/` + `.claude/tmp/`），这是所有方案的共识基础
2. **同步执行**：删掉 team 的自动落盘，改为询问用户
3. **后续优化**：`.claude/drafts/` 的清理策略，在 review/SKILL.md 中补充

---

*报告由 team-lead 综合 simplicity-reviewer、challenger、codex-proxy 意见后撰写。*
*讨论时间：2026-03-30*
