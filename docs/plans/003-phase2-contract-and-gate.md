---
id: "003"
title: "Phase 2: Contract 提取 + Auto-pass Gate"
type: plan
created: 2026-03-29
status: reviewed
discussion: "docs/discussions/002-harness-improvement/conclusion.md"
review: "docs/plans/003-phase2-plan-review.md"
---

# Feature: Phase 2 Contract 提取 + Auto-pass Gate

## Goal

让 `/ae:work` 在每步执行时能自动提取 plan contract、验证 drift、并在安全条件下自动继续，减少不必要的人工确认。

## 前置条件

Phase 1 已完成（v0.0.7）：
- ✅ Plan self-check 要求每步列出预计改动文件
- ✅ Fix loop circuit breaker
- ✅ Git diff --stat 透明度
- ✅ Pre-commit P3/P2-style auto-skip

## Contract 数据结构（MF1）

```
contract = {
  files_allowed: string[],   # 从 "Expected files:" 行解析
  target_ac: string[],       # 从步骤标题 "(ACx)" 解析
  is_empty: bool             # true 时跳过 drift 验证（graceful degradation）
}
```

Contract 作为 session 状态在 SKILL.md 执行过程中传递（同 fix_loop_count 的处理方式）。

每步独立判断：有 "Expected files" → 提取 contract；没有 → `is_empty = true`，该步跳过验证（MF2、C5）。

## Steps

### Step 0: Plan 模板更新 (AC6)
- [ ] `plugins/ae/skills/plan/SKILL.md` — Step 结构模板加 "Expected files" 字段指导：
  ```
  ### Step N: <description> (ACx)
  - [ ] Subtask a
  - [ ] Subtask b
  Expected files: src/auth/middleware.ts, src/auth/types.ts
  ```
- [ ] `plugins/ae/templates/pipeline.template.yml` — 加配置项：
  ```yaml
  work:
    max_fix_loops: 3
    auto_pass: false          # opt-in (C2)
    security_patterns:        # (C3)
      - "auth/*"
      - "security/*"
      - "*.env"
      - "*secret*"
      - "*credential*"
      - "*.pem"
      - "*.key"
      - "migrations/*"
  ```
- [ ] 预计改动文件：`plugins/ae/skills/plan/SKILL.md`, `plugins/ae/templates/pipeline.template.yml`

### Step 1: Contract 提取逻辑 (AC1)
- [ ] `/ae:work` SKILL.md — 在 TDD Cycle 之前加 "Contract Extraction" 段落
- [ ] 从当前 step 的 plan 文本提取 contract：
  - 解析 "Expected files:" 行 → `files_allowed`
  - 解析步骤标题 "(ACx)" → `target_ac`
  - 无 "Expected files" → `is_empty = true`
- [ ] 提取后**静默展示** contract（MF4）：显示但不 block，不等用户确认
  ```
  📋 Contract: files_allowed=[src/auth/middleware.ts, src/auth/types.ts], AC=[AC3]
  ```
- [ ] 提取失败（plan 结构异常）→ 警告 + 跳过验证继续（C4）
- [ ] 预计改动文件：`plugins/ae/skills/work/SKILL.md`

### Step 2: Post-step Drift 验证 (AC2, AC3)
- [ ] `/ae:work` SKILL.md — 在 Pre-commit Checks 的 "Diff transparency" 步骤后加 "Contract Verification"
- [ ] 如果 `contract.is_empty == true` → 跳过验证，视为通过
- [ ] 验证逻辑：
  - 运行 `git diff --name-only` 提取改动文件列表（C6）
  - 对比 `files_allowed`：有没有超出范围的文件？
  - 新增文件：是否在 step 描述的预期内？
- [ ] 验证通过 → 继续 pre-commit checks
- [ ] 验证失败 → 软暂停 + 展示偏离详情：
  ```
  ⚠️ Contract violation detected:
  - files_allowed: [list]
  - actual changes: [list]
  - unexpected: [files outside contract]

  Options:
  1. Fix: revert unexpected changes and retry
  2. Approve drift: explain why and continue (recorded in commit message)
  3. Rollback: discard this step's changes
  ```
- [ ] 预计改动文件：`plugins/ae/skills/work/SKILL.md`

### Step 3: Auto-pass Gate 条件 (AC4, AC5)
- [ ] `/ae:work` SKILL.md — Post-commit 段落修改：条件判断替代无条件暂停
- [ ] **默认关闭**（opt-in）：需 `pipeline.yml → work.auto_pass: true` 才启用（C2）
- [ ] 未启用时保持当前行为（post-commit 始终暂停）
- [ ] 启用后，auto-pass 条件（全部满足才自动继续）：
  - tests green（test command 返回 0）
  - code-review 无 P1 findings
  - contract verified（通过 or is_empty）
- [ ] 自动通过时输出理由：
  ```
  ✅ Auto-pass: tests green, no P1, contract verified. Continuing to Step N+1.
  ```
- [ ] **强制暂停**（无论 auto_pass 设置如何）：
  - contract violation（优先级最高）
  - 改动文件匹配 `pipeline.yml → work.security_patterns`（C3）
- [ ] 预计改动文件：`plugins/ae/skills/work/SKILL.md`

## Acceptance Criteria

### AC1: Contract 从 plan 提取 + Graceful Degradation
`/ae:work` 执行 step 前，能从 plan 文本解析出 `files_allowed` 和 `target_ac`。无 "Expected files" 时 `is_empty = true`，跳过 drift 验证，退化为 Phase 1 行为。混合 plan（部分步骤有、部分没有）按步独立退化。

### AC2: Drift 验证 — 正常情况
step 完成后，如果所有改动文件都在 `files_allowed` 内，验证通过，不打扰用户。

### AC3: Drift 验证 — 违反情况
如果有文件超出 contract 范围，暂停并展示三个选项（fix/approve/rollback）。"Approve drift" 记录理由到 commit message。

### AC4: Auto-pass — 正常情况
`work.auto_pass: true` 时，tests green + no P1 + contract verified → 自动继续下一步，输出理由。`auto_pass` 未设或 false 时保持当前暂停行为。

### AC5: Auto-pass — 强制暂停
contract violation 或安全敏感文件改动（匹配 `work.security_patterns`）→ 无论 auto_pass 如何，强制暂停。

### AC6: Plan 模板引导
新生成的 plan 每步包含 "Expected files" 字段。`pipeline.yml` 模板包含 `work.auto_pass`、`work.security_patterns` 配置项。

## Plan Quality Self-check

1. **Step 完成条件**：每步都有明确的 SKILL.md 改动内容 ✅
2. **AC 验证方法**：AC1-6 都有具体的 pass/fail 条件 ✅
3. **Evidence for drift**：每步列出了预计改动文件 ✅

## Review Findings Applied

- MF1 ✅ Contract 数据结构定义（顶部新增）
- MF2 ✅ `is_empty` 时 auto-pass 视为满足（AC1 + Step 2）
- MF3 ✅ Step 4 → Step 0（先行）
- MF4 ✅ AC2 改为静默展示（Step 1）
- C1 ✅ 删除 `must_not_touch`，只保留 `files_allowed`
- C2 ✅ Auto-pass opt-in（Step 3）
- C3 ✅ Security patterns 移到 pipeline.yml（Step 0 + Step 3）
- C4 ✅ 提取失败处理（Step 1）
- C5 ✅ 按步独立退化（AC1）
- C6 ✅ `git diff --name-only`（Step 2）
- C7 ✅ AC7 合并到 AC1
