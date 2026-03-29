---
id: "002"
title: "Harness Improvement — 评判标准、自动化、Drift Detection"
type: plan
created: 2026-03-29
status: draft
discussion: "docs/discussions/002-harness-improvement/conclusion.md"
---

# Feature: Harness Improvement

## Goal

提升 ae 的三个核心 harness 能力：评判标准覆盖全流程、减少不必要的人工确认、执行中检测和拉回跑偏的 agent。

## 依赖链

```
Phase 1: plan 结构化 + drift 基础 + 效率优化
  ↓
Phase 2: contract 提取 + drift 验证 + auto-pass gate
  ↓
Phase 3: --auto N + Doodlestein + 反馈闭环
```

---

## Phase 1: 基础层（纯 SKILL.md 改动，零基础设施）

### Step 1: Fix Loop Circuit Breaker (AC1)
- [ ] `/ae:work` SKILL.md — TDD cycle 加 fix loop 检测
- [ ] 规则：同一 test file 连续失败 N 次（默认 3）→ STOP
- [ ] 暂停后展示选项："重试不同方案" / "跳过并 defer" / "寻求帮助"
- [ ] N 可在 pipeline.yml 中配置（`work.max_fix_loops: 3`）

### Step 2: Git Diff 透明度 (AC2)
- [ ] `/ae:work` SKILL.md — 每步完成后、commit 前，输出 `git diff --stat`
- [ ] 用户可直观看到改动范围，判断是否 drift

### Step 3: Pre-commit Disposition 效率优化 (AC3)
- [ ] `/ae:work` SKILL.md — pre-commit disposition 默认行为：
  - P3 findings → auto-skip（不展示）
  - P2 style/naming findings → auto-skip（不展示）
  - 只展示 P1 + P2 logic/security 类
- [ ] `/ae:code-review` SKILL.md — review 输出按 severity 分组，P3 折叠

### Step 4: Plan Self-check (AC4)
- [ ] `/ae:plan` SKILL.md — Step 2 完成后加 agent self-check：
  - 每个 step 有明确完成条件（不是 "实现 X 功能"）？
  - AC 有具体验证方法（不是 "结果应合理"）？
  - Evidence：列出每步预计改动的文件（为 Phase 2 contract 提供基础）
- [ ] `/ae:plan-review` SKILL.md — review 时检查上述条件

### Step 5: Discussion Self-check (AC5)
- [ ] `/ae:discuss` SKILL.md — 每个 topic decided 后 agent self-check：
  - 决策有明确 rationale（不是 "感觉 A 好"）？
  - 高风险决策标注 reversibility（high/medium/low）？
  - Evidence：决策引用了哪些具体分析或数据？

---

## Phase 2: 验证层（依赖 Phase 1 的 plan 结构化）

### Step 6: Contract 提取 + Post-step 验证 (AC6)
- [ ] `/ae:work` SKILL.md — 每步开始前，从 plan 提取 contract：
  - `files_allowed`: 预计改动的文件列表
  - `must_not_touch`: 明确不该碰的文件/目录
  - `target_ac`: 本步对应的 AC
  - `max_fix_loops`: 熔断次数
- [ ] 每步完成后，自动验证：
  - `git diff --stat` vs `files_allowed` — 超出范围？
  - 新增文件是否在预期内？
- [ ] Violation → 软暂停 + 展示偏离详情 + 选项："修复" / "批准偏离并更新 plan" / "回滚本步"

### Step 7: Auto-pass Gate (AC7)
- [ ] `/ae:work` SKILL.md — 步骤间 auto-pass 条件（全部满足才自动继续）：
  - tests green
  - code-review 无 P1
  - git diff 在 contract 范围内
  - 无 contract violation
- [ ] 自动通过时输出理由："自动继续：tests green，无 P1，diff 在 scope 内"
- [ ] 任何 contract violation 强制暂停（优先级高于 auto-pass）
- [ ] 安全敏感文件（auth/、security/、*.env）改动强制人工确认

---

## Phase 3: 体验层（依赖 Phase 2 的 gate 和验证）

### Step 8: `--auto N` 参数 (AC8)
- [ ] `/ae:work` SKILL.md — 支持 `--auto N` 参数
  - 用户主动授权接下来 N 步自动执行
  - 自动执行时遵守 Phase 2 的 gate + contract 验证
  - 遇到 gate 不通过或 contract violation → 暂停，`--auto` 计数重置
  - N=0 时等同当前行为（全手动）

### Step 9: Doodlestein Challenge 节点 (AC9)
- [ ] `/ae:discuss` SKILL.md — conclusion 生成前，触发 Doodlestein：
  - 创建 Agent Team（challenger + codex-proxy + gemini-proxy）
  - 三个固定问题：Smartest Alternative / Problem Validity / Regret Prediction
  - 只给 topic titles + decisions + rationale，不给讨论过程
  - 收集挑战 → 展示给用户 → 用户 dismiss 或 reopen topic
  - 记录到 conclusion.md `## Doodlestein Review`
- [ ] `/ae:plan` SKILL.md — plan confirm 前，触发同样的 Doodlestein
  - 只在 cross-family 可用时执行
  - 不可用时跳过并标注 "Doodlestein skipped: cross-family unavailable"

### Step 10: Outcome 数据收集 (AC10)
- [ ] `/ae:review` SKILL.md — feature review report 增加 outcome 统计：
  - 返工率：多少 step 需要 fixup commit？
  - P1 逃逸率：review 发现了多少 P1？
  - Drift 次数：多少次 contract violation？
  - 自动通过率：多少步骤通过了 auto-pass gate？
- [ ] 数据自然积累在 review report 中，不需要额外基础设施

---

## Acceptance Criteria

### AC1: Fix Loop — Circuit Breaker
同一 test file 连续失败 3 次时，`/ae:work` 暂停并展示三个选项。不会无限循环。

### AC2: Drift 透明度 — Git Diff
每步完成后可以看到 `git diff --stat` 输出，用户可判断改动是否在预期范围。

### AC3: Disposition 效率
pre-commit 阶段只展示 P1 + P2-logic/security，P3 和 P2-style 自动跳过。人工确认次数减少。

### AC4: Plan 结构化
plan 中每个 step 有明确完成条件 + 预计改动文件列表。plan-review 检查这些条件。

### AC5: Discussion 质量
每个 decided topic 有 rationale + reversibility + evidence。没有 "感觉 A 好" 式的决策。

### AC6: Contract 验证
`/ae:work` 从 plan 提取 contract，步骤完成后 git diff 验证范围。超出 scope 时暂停并展示偏离。

### AC7: Auto-pass Gate
满足 tests green + 无 P1 + contract 内 → 自动继续。任何 violation 强制暂停。

### AC8: --auto N
用户可指定自动执行步数，遵守所有 gate 和 contract 验证。

### AC9: Doodlestein
discuss conclusion 前和 plan confirm 前，cross-family 独立挑战三问。结果记录在文档中。

### AC10: Outcome 统计
review report 包含返工率、P1 逃逸率、drift 次数、自动通过率。
