---
id: "001"
title: "统一输出规范落地"
type: plan
created: 2026-03-22
status: done
discussion: "docs/discussions/001-unified-output/conclusion.md"
---

# Feature: 统一输出规范落地

## Goal

让所有 ae skill 的文件输出路径、命名、格式、临时持久化行为完全统一，agent 只需读 pipeline.yml 就知道该往哪写。

## Steps

### Step 1: 更新 pipeline 模板 (AC1)
- [x] 重写 `plugins/ae/templates/pipeline.template.yml` — output 块改为 6 个语义槽 + 默认值，加 scratch 配置
- [x] 删除旧的 `output.review` 和 `output.plans` 两项

### Step 2: 更新 ae:setup skill (AC1, AC2)
- [x] 修改 `plugins/ae/skills/setup/SKILL.md` — 生成逻辑匹配新模板
- [x] setup 生成的 pipeline.yml 包含完整 output 块（所有 slot + 默认值注释）和 scratch 配置

### Step 3: 统一正式输出 skills — 路径读取 (AC1, AC3)
- [x] `analyze/SKILL.md` — 从硬编码 `docs/discussions/` 改为读 `output.discussions`
- [x] `discuss/SKILL.md` — 从硬编码 `docs/discussions/` 改为读 `output.discussions`
- [x] `plan/SKILL.md` — 从 `output.plans`（无默认值）改为有默认值 `docs/plans/` + NNN-slug 命名
- [x] `work/SKILL.md` — 从硬编码 `docs/milestones/` + `docs/backlog/` 改为读 `output.milestones` + `output.backlog`
- [x] `review/SKILL.md` — 从硬编码 `notes.md` + `docs/backlog/` 改为读 `output.milestones` + `output.backlog`
- [x] `think/SKILL.md` — 确认默认值 `docs/analyses/` + NNN-slug 命名

### Step 4: 统一命名与格式规范 (AC3)
- [x] 在每个写文件的 skill 中加入统一命名指令：`NNN-slug`，三位编号，每类独立递增
- [x] 在每个写文件的 skill 中加入统一 frontmatter 指令：必含 `id`, `title`, `type`, `created`, `status`

### Step 5: 加入 scratch 临时持久化 (AC4, AC5)
- [x] 在所有产出内容的 skill 中加入 scratch 写入指令：完成时自动写 `scratch/<type>-<date>-<NNN>.md`
- [x] `trace/SKILL.md` — 加 scratch + 完成后 AskUserQuestion "要正式保存吗？"
- [x] `consensus/SKILL.md` — 加 scratch + 完成后 AskUserQuestion "要正式保存吗？"
- [x] `think/SKILL.md` — 加 scratch + 完成后 AskUserQuestion "要正式保存吗？"
- [x] `code-review/SKILL.md` — 加 scratch action log（不提醒）
- [x] `team/SKILL.md` — 加 scratch（不提醒）

### Step 6: scratch action log 格式与 session 恢复 (AC5, AC6)
- [x] `code-review/SKILL.md` — action log 格式：每个 finding 有 action + status（Step 5 已完成）
- [x] 所有 skill 的 pre-check 加入：扫 scratch 目录，发现 `status: in_progress` 时提醒用户（plan, work, review, consensus, team, trace）
- [x] `review/SKILL.md` — feature gate 时批量展示本轮 scratch 记录，问用户要不要归档

### Step 7: 结构调整 (AC7)
- [x] 移动 `plugins/ae/skills/cross-family-review/` 到 `plugins/ae/docs/cross-family-review.md`
- [x] 更新 plugin.json 版本号 → 0.0.2
- [x] 更新 CHANGELOG.md
- [x] 更新 README.md 组件计数（12 skills, 13 agents）

## Acceptance Criteria

### AC1: pipeline.yml 语义槽完整
模板包含 6 个 output slot（discussions, plans, milestones, backlog, reviews, analyses）+ scratch 配置。每个 slot 有默认值注释。`/ae:setup` 生成的 pipeline.yml 匹配此模板。

### AC2: 零配置可用（修订）
~~在一个空项目（无 pipeline.yml）运行 `/ae:plan test-feature` 时，skill 使用默认值写入 `docs/plans/001-test-feature.md`。不报错，不需要先运行 setup。~~

修订：无 pipeline.yml 时自动触发 `/ae:setup` 流程（告知用户"首次使用 ae 插件，正在初始化..."），setup 完成后继续执行原命令。用户无需手动跑 setup，但 pipeline.yml 始终存在。

### AC3: 所有写文件 skill 读 pipeline.yml
逐一检查 7 个写文件 skill（analyze, discuss, plan, work, review, think, setup），确认每个都从 `pipeline.yml → output.<slot>` 读路径，无硬编码路径。命名格式统一 `NNN-slug` + frontmatter。

### AC4: 高价值 skill 完成后提醒保存
运行 `/ae:trace`、`/ae:consensus`、`/ae:think` 后，agent 用 AskUserQuestion 问用户是否正式保存。用户选是 → 文件从 scratch 移到正式目录。

### AC5: 流水线 skill 自动写 scratch
运行 `/ae:code-review` 后，检查 scratch 目录存在 action log 文件，包含 findings + action + status 字段。

### AC6: session 恢复
在 scratch 中手动创建一个 `status: in_progress` 的 action log，然后运行任意 ae skill，agent 应主动提醒用户有未完成的操作。

### AC7: cross-family-review 移出 skills
`plugins/ae/skills/cross-family-review/` 目录不存在。内容移至 `plugins/ae/docs/`。README 显示 12 skills。
