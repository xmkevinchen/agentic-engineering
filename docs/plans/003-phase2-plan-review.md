---
id: "003-review"
title: "Phase 2 计划评审：Contract 提取 + Auto-pass Gate"
type: review
target_plan: "docs/plans/003-phase2-contract-and-gate.md"
created: 2026-03-29
status: complete
reviewers:
  - lead-reviewer (architect)
  - dependency-analyst
  - simplicity-reviewer
  - gemini-proxy
  - codex-proxy
---

# 计划评审：003-phase2-contract-and-gate.md

## 评审总结

计划整体设计方向正确，核心逻辑（contract 提取 → drift 验证 → auto-pass gate）形成闭环。但存在若干需要修复的问题：步骤顺序语义倒置、contract 数据接口未定义、用户确认设计与自动化目标矛盾，以及多个边界情况未覆盖。

Codex 补充警示：当前 contract 语义太浅（只做路径层面 drift 检测），"approve drift"逃生舱的失效模式未充分管控，建议在实现前加强这两点，或先做 MVP 版本验证可用性。

---

## 步骤依赖图

```
Step 4 (模板更新)
    │
    │  [语义前提：定义 Expected files 字段格式]
    │  [可与 Steps 1-3 并行，或提前至 Step 0]
    ▼
Step 1 (Contract 提取)
    │
    │  contract 对象 { files_allowed, target_ac }
    ▼
Step 2 (Drift 验证)
    │
    │  contract_verified: bool
    ▼
Step 3 (Auto-pass Gate)
```

**串行链：** Step 1 → Step 2 → Step 3（严格顺序，不可并行，同修 work/SKILL.md）

**可并行：** Step 4 与 Steps 1-3 完全独立（改不同文件），可提前或并行执行

---

## 并行策略

| 步骤 | 并行可行性 | 说明 |
|------|-----------|------|
| Steps 1-3 | 不可并行 | 同文件同逻辑链，必须串行 |
| Step 4 | 可提前或并行 | 改 plan/SKILL.md 和 pipeline.template.yml，与 Steps 1-3 无文件冲突 |

**建议：** 将 Step 4 调整为 Step 0（或标注为"可与 Steps 1-3 并行"），因其从语义上是 contract 提取的前置条件（定义了 Expected files 字段格式）。

---

## Must Fix（必须修复）

### MF1：Contract 数据结构接口未定义

**来源：** dependency-analyst

Step 1 产生 contract 对象，Step 2 消费它，但计划未定义：
- contract 对象的格式（字段名、类型、传递方式）
- 是存在内存状态中、写入临时文件，还是通过其他方式传递

**后果：** Steps 1 和 2 的实现者若各自理解，会产生接口不一致的 bug。

**建议修复：** 在 Step 1 中补充 contract 对象的明确定义，例如：
```
contract = {
  files_allowed: string[],   # 从 "Expected files:" 解析
  target_ac: string[],       # 从步骤标题 "(ACx)" 解析
  is_empty: bool             # true 时跳过 drift 验证
}
```
传递方式：在 SKILL.md 内以 session 状态变量形式存在（同 fix_loop_count 的处理方式）。

---

### MF2：Contract 为空时 auto-pass 状态未定义

**来源：** dependency-analyst、simplicity-reviewer

Step 3 的 auto-pass 条件之一是"contract verification 通过"。当 plan 没有 Expected files（contract 为空，Step 2 整体 skip）时：
- 如果"contract verified"视为 false → 旧 plan 永远无法 auto-pass，违反 AC1 的 graceful degradation 意图
- 如果视为 true → 需要在 Step 3 明确写出此逻辑

**建议修复：** 在 Step 3 中补充明确规则：`contract.is_empty == true → "contract verified" 视为自动满足（true）`

---

### MF3：Step 4 顺序语义倒置

**来源：** dependency-analyst

Step 4 定义了 plan 的"Expected files"字段模板，而 Step 1 依赖这个字段作为 contract 提取的输入。当前顺序让"格式消费者"先于"格式定义者"出现。

**实际阻断影响：** 无（Steps 1-3 和 Step 4 修改不同文件，执行顺序不影响技术运行）。但语义上造成混乱，且会导致执行 plan 003 时产生的 work/SKILL.md 中 contract 提取逻辑所期望的格式，在 plan/SKILL.md 模板更新之前尚未传达给用户。

**建议修复：** 将 Step 4 改为 Step 0（首先执行），或在 plan 文本中注明"Step 4 是 Step 1 的模板前提，应提前或并行执行"。

---

### MF4：AC2"用户确认 contract"与自动化目标矛盾

**来源：** simplicity-reviewer

Phase 2 的目标是"减少不必要的人工确认"，而 AC2 要求每步执行前展示 contract 并等待用户确认。这将每步的暂停从 1 次（post-commit）变为 2 次（pre-execution + post-commit），净效果是暂停次数翻倍。

**建议修复：** 将 AC2 改为"静默展示 contract（show，不 block）"，类比现有的"Diff transparency"设计——展示信息但不等待确认。仅在以下情况才 block：
- contract 为空且未检测到 Expected files → 提示用户考虑补充（非强制）
- 用户在 pipeline.yml 中设置了 `work.require_contract_confirm: true`

---

## Consider（建议考虑）

### C1：删除 `must_not_touch` 字段，简化 contract

**来源：** simplicity-reviewer

`must_not_touch` 需要 agent 从整个 plan 中推断其他步骤的文件列表，这是不稳定的（plan 描述未必精确列出文件，agent 可能误判）。实际上，验证"实际改动在 files_allowed 内"已经隐含了"不改其他文件"的要求，两者语义重叠。

**建议：** 删除 `must_not_touch` 字段，仅保留 `files_allowed` 验证。最小 contract = `files_allowed` + 可选 `target_ac`。同时删除 `max_fix_loops` 从 contract 字段中（它属于 fix loop circuit breaker，Phase 1 已实现，不是 contract 概念）。

---

### C2：Auto-pass 应明确为 opt-in

**来源：** gemini-proxy

用户对自动执行代码变更天然有顾虑，Phase 2 初期应以 opt-in 形式发布 auto-pass，让用户主动启用。

**建议：** 在 Step 3 中补充：auto-pass 默认关闭，需在 `pipeline.yml` 中设置 `work.auto_pass: true` 才启用。未启用时保持当前行为（post-commit 始终暂停）。

---

### C3：安全敏感文件 patterns 移到 pipeline.yml

**来源：** simplicity-reviewer、gemini-proxy

当前计划将安全敏感文件匹配规则（`auth/*`, `security/*`, `*.env` 等）硬编码在 SKILL.md 正文，有两个问题：
1. "敏感"定义是项目上下文相关的，一刀切不适合
2. SKILL.md 作为行为描述文档，不应内嵌配置数据

**建议：** 移到 `pipeline.yml → work.security_patterns`，SKILL.md 只描述"若文件匹配 security_patterns，则强制人工确认"的行为逻辑。默认值可包含常见模式。

Gemini 补充的额外推荐 patterns（供参考）：`*.pem`, `*.key`, `*token*`, `*.tf`, `*.tfvars`, `Dockerfile`, `migrations/*`

---

### C4：Contract 提取失败时的处理路径

**来源：** dependency-analyst

计划定义了"plan 无 Expected files → graceful degradation"，但未定义"plan 结构异常、提取逻辑无法解析"的情况。

**建议：** 在 Step 1 中补充：
- 提取结果为空列表 → 等同于"无 Expected files"，走 graceful degradation
- 提取逻辑无法解析（结构异常）→ 展示警告并询问用户：手动输入 contract 还是跳过验证继续？

---

### C5：混合 plan（部分步骤有 Expected files，部分没有）

**来源：** dependency-analyst

当前 AC1 只定义了"整个 plan 无 Expected files"的退化，未覆盖"部分步骤有、部分没有"的混合情况。

**建议：** 明确为按步独立退化：每步分别判断是否有 Expected files，有则提取 contract 并验证，无则该步 skip 验证。不以整个 plan 是否有此字段作全局决策。

---

### C6：使用 `git diff --name-only` 替代 `--stat`

**来源：** gemini-proxy

`git diff --stat` 已用于 Phase 1 的 Diff transparency（展示给用户看）。在 contract 验证中提取文件列表时，`git diff --name-only` 更精确（只返回文件路径，无附加统计信息，更易解析）。

**建议：** Step 2 的 drift 验证中使用 `git diff --name-only` 提取实际改动文件列表，`--stat` 继续用于 Diff transparency 展示。

---

### C7：AC7 与 AC1 重叠，可合并

**来源：** simplicity-reviewer

AC7（旧 plan 无 Expected files 时 graceful degradation）在 AC1 中已经覆盖。建议合并为同一条 AC，或删除 AC7，避免规格冗余。

---

### C8：Contract 语义太浅——仅路径层面无法检测行为 drift

**来源：** codex-proxy

当前 contract（`files_allowed`, `must_not_touch`）只能捕捉路径层面的 drift（改了不该改的文件），无法检测行为层面的危险改动（allowed 文件内部的 auth bypass、secret 硬编码等）。

**建议（可选扩展，Phase 3 方向）：**
- `allowed_operations`：edit / create / delete / rename 分别授权
- `forbidden_patterns`：禁止的代码模式（如 auth bypass、secret 硬编码）
- AC 级别的测试证明：哪些测试/断言能证明 target_ac 已达成

**Phase 2 建议**：维持路径层面 drift 检测作为 MVP，在 SKILL.md 注释中说明当前 contract 不覆盖文件内容层面的 drift，为后续扩展预留空间。

---

### C9："approve drift"逃生舱失效模式需管控

**来源：** codex-proxy

当前设计对"approve drift"的约束只有"说明理由记录到 commit message"，Codex 识别出高风险失效模式：

1. **Contract 事后漂白**：粗心或恶意改动通过 approve 被合法化
2. **跨步范围蔓延**：多次 approve drift 逐渐侵蚀 plan 完整性
3. **敏感文件绕过**：反复 approve 可规避 .env / auth / secret 强制拦截
4. **人工疲劳审批**：频繁弹出后用户无脑 approve，门控失效

**建议缓解措施：**
- approve drift 为一次性局部覆盖，不持久更新 contract（防止逐步漂白）
- 要求分类标签（bug-fix / refactor / scope-change）+ 最低字符数原因（防敷衍）
- approve 后强制重跑测试 + code-review（防绕过质量门控）
- 安全敏感文件（security_patterns 匹配项）不允许 approve drift 覆盖，始终强制人工确认并提示原因

---

### C10：Auto-pass gate 安全条件不完整

**来源：** codex-proxy

当前三条件（tests green + no P1 + contract verified）对低风险项目是合理基线，但缺漏：
- 无测试覆盖率阈值（测试通过 ≠ 覆盖充分）
- 无 flaky test 防护（偶发性通过不代表真正 green）
- P1 分类质量依赖 code-review agent 本身

**Phase 2 建议：** 维持当前三条件作为 MVP，在 SKILL.md 中注明"auto-pass 适用于低风险项目，生产关键路径建议禁用（`work.auto_pass: false`）"。覆盖率阈值和 flaky test 检测可列入 Phase 3 backlog。

---

## Approved（认可）

### AP1：整体设计方向

Steps 1 → 2 → 3 的逻辑链条（提取 contract → 验证 drift → 条件 auto-pass）设计合理，形成完整闭环，每步有明确的输入输出。

### AP2：Drift 违反时的三选项

contract violation 时给用户 fix/approve/rollback 三个选项设计合理，覆盖了最常见的处理路径。要求"approve drift"必须说明理由并记录到 commit message，是良好的审计设计。

### AP3：强制暂停的优先级设计

"contract violation 强制暂停优先于 auto-pass 条件"的设计正确，安全边界清晰。

### AP4：Graceful Degradation 基本方向

AC1 定义"无 Expected files → contract 为空 → 退化为 Phase 1 行为"是务实且正确的默认值（gemini-proxy 确认），允许新旧 plan 共存，降低采用阻力。

### AP5：Fix Loop Circuit Breaker 沿用 Phase 1

Step 3 中 `max_fix_loops` 从 `pipeline.yml → work.max_fix_loops` 读取，复用 Phase 1 已实现的机制，正确。（注：该字段从 contract 中移除，C1）

---

## 修复优先级汇总

| 编号 | 问题 | 优先级 | 影响范围 |
|------|------|--------|---------|
| MF1 | Contract 数据结构接口未定义 | 必须修复 | 实现时接口不一致 |
| MF2 | Contract 为空时 auto-pass 状态未定义 | 必须修复 | 旧 plan 无法 auto-pass |
| MF3 | Step 4 顺序语义倒置 | 必须修复 | 语义混乱，建议调整顺序 |
| MF4 | AC2 用户确认与自动化目标矛盾 | 必须修复 | 暂停次数翻倍 |
| C1 | 删除 must_not_touch，简化 contract | 建议 | 减少误报，降低复杂度 |
| C2 | Auto-pass 明确为 opt-in | 建议 | 用户信任和安全 |
| C3 | 安全 patterns 移到 pipeline.yml | 建议 | SKILL.md 轻量化 |
| C4 | Contract 提取失败处理路径 | 建议 | 边界情况健壮性 |
| C5 | 混合 plan 按步独立退化 | 建议 | 边界情况覆盖 |
| C6 | drift 验证用 `--name-only` | 建议 | 实现细节优化 |
| C7 | AC7 与 AC1 合并 | 建议 | 规格清晰度 |
| C8 | Contract 语义太浅，路径层面不覆盖行为 drift | 建议（Phase 3） | 未来扩展方向 |
| C9 | approve drift 失效模式需管控（分类标签+重跑+不可覆盖敏感文件） | 建议 | 安全门控实效 |
| C10 | auto-pass gate 安全条件不完整（缺覆盖率/flaky test） | 建议（Phase 3） | 生产环境风险 |
