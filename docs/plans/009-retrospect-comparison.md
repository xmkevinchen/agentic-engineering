---
id: "009"
title: "ae:retrospect Comparison Mode"
type: plan
created: 2026-04-01
status: approved
discussion: "docs/discussions/010-retrospect-comparison/conclusion.md"
---

# Feature: ae:retrospect Comparison Mode

## Goal
为 ae:retrospect 添加显式 comparison 模式，支持对比两份 retrospect 报告的指标变化趋势，使用箭头 + 绝对 delta 展示。

## Steps

### Step 1: 添加 comparison 逻辑到 SKILL.md (AC1, AC2, AC3) ✅ 0bdeaad
- [x] 在 `## Input` section 添加 `--compare ID1 ID2` 参数说明
- [x] 在 Pre-check 或 Step 5 开头添加 ID 验证：两个 ID 对应的 retrospect 报告必须存在，不存在时返回 graceful message
- [x] 新增 `## Step 5: Comparison Mode` section，包含：
  - 读取两份指定 ID 的 retrospect 报告
  - 解析 Data Summary 表格中的 5 项指标
  - 计算 delta 并判断方向（每个指标的"好"方向是固定的）
  - 输出 comparison 表格：箭头 + 绝对 delta 格式
- [x] 在 Step 5 中定义 5 个指标的正向方向（↑ steps completed = improving, ↓ rework = improving, ↓ P1 escape = improving, ↓ drift = improving, ↑ auto-pass = improving）
- [x] 在 `## Step 4: Output` 中添加 comparison 报告模板
- [x] 处理边界情况：报告不存在、报告格式不匹配、指标缺失
Expected files: plugins/ae/skills/retrospect/SKILL.md

### Step 2: 版本 bump + CHANGELOG (AC4) ✅ 1466609
- [x] plugin.json patch 版本 bump（0.3.0 → 0.3.1）
- [x] CHANGELOG.md 记录变更
- [x] README.md 确认 skill 计数无变化（15 不变）
Expected files: plugins/ae/.claude-plugin/plugin.json, CHANGELOG.md, README.md

## Acceptance Criteria

### AC1: Comparison 参数可用
SKILL.md 的 Input section 包含 `--compare ID1 ID2` 参数说明，语义明确。

### AC2: Comparison 输出格式正确
SKILL.md 包含 comparison 表格模板，使用箭头（↑/↓）+ 绝对 delta 格式，无百分比。5 个指标的"好"方向均有定义。

### AC3: 边界情况处理
SKILL.md 包含报告不存在、格式不匹配时的错误提示文案（不是 crash，是 graceful message）。

### AC4: 版本和文档一致
plugin.json 版本号为 patch bump，CHANGELOG 记录 comparison mode 变更。

## Parallel Strategy

```
Step 1 → Step 2（串行：Step 2 依赖 Step 1 完成确认变更范围）
```

无并行机会，两步串行。
