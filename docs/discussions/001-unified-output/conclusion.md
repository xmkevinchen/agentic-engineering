---
id: "001"
title: "统一 ae 插件文件输出规范 — 结论"
concluded: 2026-03-22
plan: ""
---

# 统一 ae 插件文件输出规范 — 结论

## 决策摘要

| # | 议题 | 决定 | 原因 |
|---|------|------|------|
| 1 | 输出根目录选择 | 废弃，被议题 2 合并 | 不需要统一根目录 |
| 2 | pipeline.yml 配置粒度 | 语义槽 + 合理默认值，无 root | SmartPal 零迁移兼容；新项目零配置即用；agent 读取简单 |
| 3 | 文件命名与格式规范 | 每类独立编号 + slug | 实现简单，与已有约定兼容，跨类型时间靠 frontmatter |
| 4 | 终端 skill 持久化策略 | 临时持久化 + 主动提醒正式保存 | 解决 compact 丢信息；不强制文件膨胀；用户不需记参数 |

## 关键约束

### 正式输出

1. **pipeline.yml output 块是唯一路径真相** — 所有写文件的 skill 必须从这里读路径
2. **每个 slot 有默认值** — 不配 = 用默认值，默认值匹配 SmartPal 现有结构
3. **命名统一 `NNN-slug`** — 三位编号，每类独立递增，slug 从标题生成
4. **格式统一 Markdown + YAML frontmatter** — 必含 `id`, `title`, `type`, `created`, `status`

### 临时持久化（scratch）

5. **scratch 目录默认 `~/.claude/scratch/<project-hash>/`** — 不污染 repo，跨 session 可靠，按项目隔离
6. **pipeline.yml 可选覆盖**：`scratch: "~/.claude/scratch/"` — 想 commit 给队友看的团队可改为 `.claude/scratch/`
7. **所有 skill 产出自动写 scratch** — session compact/crash/close 后信息不丢

### 持久化提醒策略

8. **高价值产出**（trace、consensus、think）→ 完成时立即问："结果已暂存，要正式保存到 `docs/xxx/` 吗？"
9. **流水线产出**（code-review、team）→ 不问，自动写 scratch，格式为 action log：
   - 每个 finding 有 `action`（fix now / backlog / skip）和 `status`（pending / in_progress / resolved）
   - 进 backlog 的写 BL-xxx 到 `output.backlog`，标记 resolved
   - 当场修的标记 in_progress，修完标记 resolved + commit hash
10. **session 恢复** — agent 启动时扫 scratch，发现 `status: in_progress` 的记录主动提醒："上次有未完成的操作，要继续吗？"
11. **feature gate 归档** — `/ae:review` 时批量展示本轮 scratch 记录，问用户要不要归档

### 结构调整

12. **cross-family-review 不是用户 skill** — 应从 skills/ 移出，改为参考文档

## pipeline.yml output 块定义

```yaml
# --- Output Directories ---
output:
  discussions: "docs/discussions/"   # ae:analyze, ae:discuss
  plans: "docs/plans/"              # ae:plan
  milestones: "docs/milestones/"    # ae:work
  backlog: "docs/backlog/"          # ae:work, ae:review, ae:code-review
  reviews: "docs/reviews/"          # ae:review
  analyses: "docs/analyses/"        # ae:think

# --- Scratch (临时持久化) ---
scratch: "~/.claude/scratch/"        # 默认值，一般不用改
```

## scratch action log 格式

```yaml
# ~/.claude/scratch/<project-hash>/code-review-2026-03-22-001.md
---
type: code-review
created: 2026-03-22T14:30:00
status: in_progress    # pending | in_progress | resolved
---

## Findings

1. [FIXING] auth.py:42 — SQL injection risk
   - action: fix now
   - status: in_progress

2. [BACKLOG] api.py:88 — missing rate limiting
   - action: BL-072
   - status: resolved → docs/backlog/BL-072-rate-limiting.md

3. [FIXED] utils.py:15 — unused import
   - action: fixed in commit abc123
   - status: resolved
```

## 需要修改的文件

### 模板
- `plugins/ae/templates/pipeline.template.yml` — output 块改为语义槽 + 默认值，加 scratch

### Skills（读/写路径统一 + scratch）
- `plugins/ae/skills/analyze/SKILL.md` — 从硬编码改为读 `output.discussions`
- `plugins/ae/skills/discuss/SKILL.md` — 从硬编码改为读 `output.discussions`
- `plugins/ae/skills/plan/SKILL.md` — 改为读 `output.plans`，加默认值
- `plugins/ae/skills/work/SKILL.md` — 改为读 `output.milestones` + `output.backlog`
- `plugins/ae/skills/review/SKILL.md` — 改为读 `output.reviews` + `output.backlog` + scratch 归档
- `plugins/ae/skills/think/SKILL.md` — 改为读 `output.analyses` + 完成后提醒保存
- `plugins/ae/skills/setup/SKILL.md` — 生成逻辑匹配新模板
- `plugins/ae/skills/trace/SKILL.md` — 加 scratch + 完成后提醒保存
- `plugins/ae/skills/consensus/SKILL.md` — 加 scratch + 完成后提醒保存
- `plugins/ae/skills/code-review/SKILL.md` — 加 scratch action log
- `plugins/ae/skills/team/SKILL.md` — 加 scratch

### 结构调整
- `plugins/ae/skills/cross-family-review/` — 移出 skills/，改为参考文档

## 下一步

→ 运行 `/ae:plan` 基于这些决策生成执行计划。
  引用本结论：`docs/discussions/001-unified-output/conclusion.md`
