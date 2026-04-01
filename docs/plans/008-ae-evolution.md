---
id: "008"
title: "AE Evolution — Pipeline Validation + Infrastructure"
type: plan
created: 2026-04-01
status: approved
discussion: "docs/discussions/009-ae-evolution/conclusion.md"
---

# Feature: AE Evolution — Pipeline Validation + Infrastructure

## Goal
通过实际运行完整 pipeline 验证其结构是否产出更高质量输出。基础设施变更（web research 扩展、Next Steps 标准化、ae:retrospect skill）+ 端到端 pipeline 执行验证。

## Context

Discussion 009 的 5 个决策，按依赖关系分为三层：
- **基础设施**（D2 + D4）：静态扩展 WebSearch、标准化 Next Steps — 独立可做
- **目标 feature**（D5）：ae:retrospect skill — 作为 pipeline 验证的载体
- **观察任务**（D1 + D3）：pipeline 价值验证 + reversibility 观察 — 内嵌在执行过程中

## Steps

### Step 1: 静态扩展 WebSearch/WebFetch 到 agent 定义 (AC1) ✅ aabdd71
- [x] 在 `challenger.md` 和 `architect.md` 的 `tools:` frontmatter 中添加 `WebSearch, WebFetch`
- [x] 权限判断原则记录在 CHANGELOG 中：研究型 agent（需要外部/时间敏感数据来完成职责）可获权；执行型 agent（proxy、review）不可获权
- [x] 不扩展到 proxy agent（通过 MCP 调用外部模型）和 review agent（内部操作）
Expected files: plugins/ae/agents/workflow/challenger.md, plugins/ae/agents/workflow/architect.md

### Step 2: 标准化 Next Steps 到所有 skill (AC2) ✅ aabdd71
- [x] 先定义统一模板格式（3-5 行）：section 标题 `## Next Steps`，内容为基于 skill output + pipeline 状态的条件建议（if/then 风格）
- [x] 按模板在 13 个 skill 的 SKILL.md 末尾添加 Next Steps：analyze, plan, work, review, consensus, think, trace, testgen, code-review, team, plan-review, setup（discuss 已有）
- [x] 内容是基于上下文的动态建议，不是固定文本（例如：analyze → 有 discussion 则 `/ae:discuss`，否则 `/ae:plan`）
- [x] agent-selection 是参考文档不是执行 skill，跳过
Expected files: plugins/ae/skills/analyze/SKILL.md, plugins/ae/skills/plan/SKILL.md, plugins/ae/skills/work/SKILL.md, plugins/ae/skills/review/SKILL.md, plugins/ae/skills/consensus/SKILL.md, plugins/ae/skills/think/SKILL.md, plugins/ae/skills/trace/SKILL.md, plugins/ae/skills/testgen/SKILL.md, plugins/ae/skills/code-review/SKILL.md, plugins/ae/skills/team/SKILL.md, plugins/ae/skills/plan-review/SKILL.md, plugins/ae/skills/setup/SKILL.md

### Step 3: 创建 ae:retrospect skill (AC3, AC4) ✅ 94368d9
- [x] 创建 `plugins/ae/skills/retrospect/SKILL.md`
- [x] Skill 功能：读取 `docs/reviews/` 中的 Outcome Statistics（步骤完成率、rework rate、P1 escape rate、drift events、auto-pass rate），生成趋势报告
- [x] 输入：可选指定时间范围或 feature 名
- [x] 输出：写入 `docs/analyses/` 目录，包含趋势数据 + actionable insights（哪些 gate 条件需要调整、哪些 checklist 项频繁触发 rework）
- [x] Skill 的 Next Steps section（遵循 Step 2 的模板）
Expected files: plugins/ae/skills/retrospect/SKILL.md

### Step 4: 在 discuss SKILL.md 中添加 reversibility 观察协议 (AC5) ✅ 94368d9
- [x] 在 discuss SKILL.md 的 scoring section 中添加注释：TL 在填写 reversibility 时记录判断依据（不是新框架，是观察记录）
- [x] 在 conclusion 模板中添加 `## Reversibility Observation` section：记录哪些 topic 的 reversibility 评估影响了决策、哪些没有
- [x] 目标：积累 2-3 个 discussion 的数据后评估字段价值
Expected files: plugins/ae/skills/discuss/SKILL.md

### Step 5: 版本 bump + CHANGELOG (AC6) ✅ c42b810
- [x] plugin.json 版本 bump（minor：新增 ae:retrospect skill）
- [x] CHANGELOG.md 记录所有变更，包括 WebSearch 权限判断原则
- [x] README.md 更新 skill 计数（14 → 15）
Expected files: plugins/ae/.claude-plugin/plugin.json, CHANGELOG.md, README.md

### Step 6: 端到端 Pipeline 执行验证 (AC7)
- [x] 选定 ae:retrospect comparison mode 作为 pipeline 测试目标
- [x] 执行完整 pipeline：Discussion 010 → Plan 009 → /ae:work (2 commits) → /ae:review (4-agent team)
- [x] discuss 使用 reversibility 观察协议：3 topics 均 high reversibility，支撑了 YAGNI 决策（记录在 conclusion.md）
- [x] review 产出 Outcome Statistics 到 `docs/reviews/001-retrospect-comparison.md`
- [x] ae:retrospect 成功读取 Outcome Statistics，输出 baseline 报告到 `docs/analyses/003-retrospect-baseline.md`
- [x] Pipeline 执行体感：结构化流程在小 feature 上有明显开销（discuss+plan+review 占总时间 80%+），但产出了 3 个 P2 修复（pp 歧义、NNN 规则、comparison 类型排除）——这些是直接实现大概率会遗漏的边界情况。Pipeline 的价值在中大型 feature 上会更明显。
Expected files: docs/reviews/ (pipeline output), docs/analyses/ (retrospect output)

## Acceptance Criteria

### AC1: WebSearch Agent 扩展 — 工具可用
选定的 agent 定义文件中 `tools:` 行包含 `WebSearch, WebFetch`。未选定的 agent 不包含这些工具。判断标准文档化在 commit message 或 CHANGELOG 中。

### AC2: Next Steps 覆盖率 — 13/14 skills 有 Next Steps
除 agent-selection 外的所有 skill SKILL.md 末尾有 `## Next Steps` 或等效 section，内容是基于上下文的动态建议（不是固定文本 "run /ae:plan"）。

### AC3: ae:retrospect Skill 存在且可调用
`plugins/ae/skills/retrospect/SKILL.md` 存在，frontmatter 包含 `name: ae:retrospect`，skill 定义包含输入/输出规范。

### AC4: ae:retrospect 读取正确数据源
Skill 定义中明确引用 review 的 Outcome Statistics 5 项指标（步骤完成率、rework rate、P1 escape rate、drift events、auto-pass rate），输出路径为 `docs/analyses/`。无数据时返回"数据不足"提示而非报错。Step 6 执行后产出真实数据，验证完整读取能力。

### AC5: Reversibility 观察协议已嵌入
discuss SKILL.md 的 scoring section 包含 reversibility 判断依据记录指引，conclusion 模板包含 `## Reversibility Observation` section。

### AC6: 版本和文档一致
plugin.json 版本号为 minor bump，CHANGELOG 包含所有 5 个 step 的变更记录（含 WebSearch 权限判断原则），README skill 计数正确。

### AC7: Pipeline 端到端执行完成
完整 pipeline（discuss→plan→work→review）在一个小 feature 上执行完毕。docs/reviews/ 中存在 Outcome Statistics。ae:retrospect 成功读取并输出分析到 docs/analyses/。reversibility 观察数据已记录。

## Parallel Strategy

```
Phase A: Step 1 (WebSearch) ∥ Step 2 (Next Steps)     — 文件不重叠，可并行
Phase B: Step 3 (retrospect) ∥ Step 4 (reversibility)  — Step 2 完成后，两者文件不重叠
Phase C: Step 5 (版本 bump)                             — 依赖 Step 1-4 全部完成
Phase D: Step 6 (pipeline 执行)                         — 依赖 Step 5（需要完整的基础设施）
```

注：Step 4 修改 discuss/SKILL.md，Step 2 也修改 discuss/SKILL.md（加 Next Steps），因此不能并行。Step 3 和 Step 4 文件无重叠，可以并行。

## Review Summary

Plan review by: architect + dependency-analyst + simplicity-reviewer + codex-proxy + gemini-proxy

### Must Fix (已修复)
- MF-1: Step 2/4 并行冲突 → 修正为 Phase A/B 串行
- MF-2: D1 验证目标断层 → 加入 Step 6 端到端执行
- MF-3: docs/reviews/ 不存在 → AC4 加"无数据时返回提示"，Step 6 产出真实数据

### Consider (已采纳)
- C-1: Next Steps 模板格式 → Step 2 先定义统一模板再应用
- C-2: WebSearch 权限判断原则 → Step 1 记录原则到 CHANGELOG
