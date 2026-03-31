---
id: "004"
title: "Scratch 重新定位 — 去掉 scratch，产出物直接写项目目录"
type: plan
created: 2026-03-30
status: done
discussion: "docs/discussions/005-scratch-reposition/team-report.md"
---

# Feature: Scratch 重新定位

## Goal

去掉 `~/.claude/scratch/`，所有产出物直接写到 `pipeline.yml` 配置的项目目录。去掉 "要不要存" 的询问和 session recovery。

## Steps

### Step 1: 去掉 scratch 引用 — 产出物直写 (AC1, AC2)
- [ ] `think/SKILL.md` — 去掉 scratch 暂存 + "要不要存" 询问，直接写到 `output.analyses`
- [ ] `consensus/SKILL.md` — 同上
- [ ] `trace/SKILL.md` — 同上
- [ ] `team/SKILL.md` — 去掉 Scratch Persistence，直接写到 `output.analyses`
- [ ] `code-review/SKILL.md` — 去掉 scratch `in_progress`/`resolved` 状态文件
- [ ] 所有写文件的指令加强调：**必须调用 Write tool 写入文件，对话输出不算完成**
Expected files: plugins/ae/skills/think/SKILL.md, plugins/ae/skills/consensus/SKILL.md, plugins/ae/skills/trace/SKILL.md, plugins/ae/skills/team/SKILL.md, plugins/ae/skills/code-review/SKILL.md

### Step 2: 去掉 session recovery pre-check (AC3)
- [ ] `work/SKILL.md` — 去掉 Check 0 Scratch Recovery
- [ ] `plan/SKILL.md` — 去掉 Pre-check 0 Scratch Recovery
- [ ] `review/SKILL.md` — 去掉 Scratch Recovery pre-check
- [ ] `team/SKILL.md` — 去掉 Scratch Recovery pre-check
- [ ] `think/SKILL.md` — 去掉 Scratch Recovery pre-check
- [ ] `consensus/SKILL.md` — 去掉 Scratch Recovery pre-check
- [ ] `trace/SKILL.md` — 去掉 Scratch Recovery pre-check
Expected files: plugins/ae/skills/work/SKILL.md, plugins/ae/skills/plan/SKILL.md, plugins/ae/skills/review/SKILL.md, plugins/ae/skills/team/SKILL.md, plugins/ae/skills/think/SKILL.md, plugins/ae/skills/consensus/SKILL.md, plugins/ae/skills/trace/SKILL.md

### Step 3: 去掉 review 的 scratch archive (AC4)
- [ ] `review/SKILL.md` — 去掉 "Scratch archive + cleanup" 段落（Output 第 5 项）
- [ ] review 的产出物（challenger report 等）直接写到 `output.reviews`
Expected files: plugins/ae/skills/review/SKILL.md

### Step 4: 更新 pipeline 模板和 setup (AC5)
- [ ] `templates/pipeline.template.yml` — 删掉 `scratch` 字段和注释
- [ ] `setup/SKILL.md` — 删掉 scratch 相关的说明和默认值表中的 scratch 行
Expected files: plugins/ae/templates/pipeline.template.yml, plugins/ae/skills/setup/SKILL.md

## Acceptance Criteria

### AC1: 产出物直写
think/consensus/trace/team 的输出直接写到 `output.analyses`（或用户配置的路径），不经过中间暂存。

### AC2: 无 "要不要存" 询问
去掉所有 "要不要正式保存" 的 AskUserQuestion。产出物直接写，不问。

### AC3: 无 session recovery
所有 skill 的 pre-check 不再扫描 scratch。Plan checkbox + git history 是恢复依据。

### AC4: 无 scratch archive
`/ae:review` 不再有 scratch 归档步骤。

### AC5: Pipeline 模板干净
`pipeline.yml` 模板和 `/ae:setup` 不再提及 scratch。

## Plan Quality Self-check

1. **Step 完成条件**：每步列出具体要改的文件和改什么 ✅
2. **AC 验证方法**：每个 AC 都是 "某个东西不存在了" — 可以 grep 验证 ✅
3. **Evidence for drift**：每步有 Expected files ✅
