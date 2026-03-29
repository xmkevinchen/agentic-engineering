---
id: "003-phase2-impl-review"
title: "Phase 2 实现审查：work/SKILL.md 综合评审"
type: review
created: 2026-03-29
status: final
reviewers: [code-reviewer, challenger, codex-proxy]
---

# Phase 2 实现审查：work/SKILL.md 综合评审

## 审查范围

- `plugins/ae/skills/work/SKILL.md`（主审）
- `plugins/ae/skills/plan/SKILL.md`（一致性参照）
- `plugins/ae/templates/pipeline.template.yml`（配置参照）

---

## 一、code-reviewer 发现的挑战与验证

### F1：Contract Extraction 在并行模式下的歧义（code-reviewer 标记 P1）

**code-reviewer 观点**：Agent Teams 启动后，每个 dev agent 都会独立执行 contract extraction，存在重复工作和合约不同步风险。

**挑战者评估：维持 P1，但重新定性**

验证后认同这是真实问题，但根源比 code-reviewer 描述的更深：

SKILL.md 的结构暗示了一个线性读者（Lead 顺序执行），但 Agent Teams 模式下 Lead 的职责在 Execution Mode Selection 之后就转移给了 dev agents。Contract Extraction 章节位于 Execution Mode Selection **之后**，这意味着：

- 如果 Lead 在启动团队前提取 contract → 文档没有指示这一点
- 如果 dev agents 各自提取 → 合约来自同一份计划文件，数值应相同，但"谁执行 contract verification"在 pre-commit 阶段更模糊

**核心矛盾**：Pre-commit Check 1 中"Run `git diff --name-only`"在并行模式下每个 dev 的变更范围不同——每个 dev 只改了自己负责的文件，但 contract 里的 `files_allowed` 是整个步骤的文件列表，还是各自子任务的？文档完全没有说明。

**Codex 交叉验证**：Codex 独立指出"单平台 lead 模式 vs 强制 Agent Teams 检查"存在张力——即使 lead 直接执行不创建团队，仍要求 Agent Teams 启用，可能过于严格。这是 F1 问题的另一个角度：文档没有为"单 Lead 模式"和"Agent Teams 模式"提供清晰的分叉路径。

**结论**：P1 维持。缺少"单 Lead 模式 vs Agent Teams 模式下 contract 生命周期"的明确分叉说明。

---

### F2：Pre-commit Check 顺序问题（code-reviewer 标记 P1）

**code-reviewer 观点**：Check 1（contract verification）在 Check 2（tests green）之前，顺序反向。

**挑战者评估：降级为 P2，理由如下**

code-reviewer 的担忧基于"测试可能改变文件"这一假设。但：

1. TDD Cycle 已经完整结束（"Confirm green"是 TDD 的最后一步）才进入 Pre-commit Checks
2. 测试命令（`test.command`）是只读的——运行测试不应该产生新的被追踪文件
3. 真正的问题不是顺序错误，而是**编号 0-6 与步骤 0-3（Pre-checks）的编号体系冲突**，容易让 Agent 误以为这是同一批 check 的延续

**实际风险**：Agent 混淆两套"Check N"编号 → 跳过或重复执行某步骤。

**结论**：降级为 P2（命名/结构问题，非逻辑错误）。修复方式：Pre-commit Checks 改用字母标记（A/B/C...）或改用描述性小标题，与 Pre-checks 的数字编号区分。

---

### F3：Contract Violation 恢复流程不清晰（code-reviewer 标记 P2）

**code-reviewer 观点**：3 个选项缺少执行细节（retry 从哪里开始、drift 记录在哪里、rollback 用什么命令）。

**挑战者评估：维持 P2，补充一个遗漏问题**

code-reviewer 的发现完全成立。补充一个更严重的遗漏：

选项 2 "Approve drift: explain why... (recorded in commit message)" 与 auto-pass gate 的条件矛盾。Auto-pass 要求 "contract verified (no violation, or contract.is_empty)"，但 Approve drift 是一种**有违规但被批准**的状态。文档中 auto-pass gate 没有处理这个第三态：

```
contract.status 可能是：
  - verified（无违规）
  - empty（跳过）
  - approved_drift（用户批准的违规）← 文档遗漏了这一态
  - violation（未处理违规）
```

**Codex 交叉验证**：Codex 同样指出"Contract violation options 没有强制用户提示规则（agent 可能自行选择）"。这与 F3 的问题一致——当 agent 面对 3 个选项时，如果没有明确说明"必须通过 AskUserQuestion 呈现给用户"，agent 可能自行选择选项 1 或 3，绕过用户确认。

**结论**：P2 维持，且需补充 `approved_drift` 状态对 auto-pass 的影响（应视为 pause，即使其他条件全满足）；并明确要求 violation 选项必须通过 AskUserQuestion 交给用户决定。

---

### F4：Auto-pass Gate 缺少 contract.verified 定义（code-reviewer 标记 P2）

**code-reviewer 观点**：Approve drift 后是否算 verified 未说明。

**挑战者评估：维持 P2，与 F3 合并处理**

这与 F3 的 `approved_drift` 问题是同一根源，建议合并为一条修复项：定义 contract 的完整状态机（4 态），并在 auto-pass gate 中明确每个态的处置。

---

### F5：文档过长、关键信息分散（code-reviewer 标记 P2）

**code-reviewer 观点**：Pre-commit Checks 嵌套过深，建议用 3 列表或流程图。

**挑战者评估：部分同意，但反对改为表格**

3 列表（Check | Condition | Action）在静态文档中易读，但 Agent 执行时需要散文式的条件逻辑（"if P1 then fix now, else if P2-logic then ask user"），表格会压缩这些条件导致 Agent 误判。

**Codex 交叉验证**：Codex 认为"191 行本身不算太长，但已接近需要将解析规则提取为紧凑'规范性说明块'的临界点，否则 agent 行为容易发生漂移"。这与挑战者的判断一致：问题不是长度本身，而是缺乏结构化的输入/输出/停止条件说明。

更有效的改进：**每个 pre-commit check 加一行 TL;DR 总结**（像 pre-checks 那样输出 ✅/⚠️/🔴 状态行），让 Agent 知道每步的预期输出格式，而不是只描述行为。

**结论**：P2 维持，修复方向从"改表格"调整为"为每个 check 添加输出格式示例"。

---

### F6：Contract 提取失败 vs 故意无 Expected files（code-reviewer 标记 P3）

**code-reviewer 观点**：提取失败自动 `is_empty = true` 可能太宽松。

**挑战者评估：升级为 P2**

这个区分在实践中很重要：

- "No Expected files line"：计划作者故意省略（无法进行 drift 检测，是计划质量问题）
- "Plan structure unrecognizable"：SKILL.md 的解析代码（即 Agent 的解释）失败（可能是计划文件格式严重错误）

将两者都映射到 `is_empty = true` 掩盖了第二种情况。第二种情况应该触发更强的警告，并建议用户运行 `/ae:plan` 修复计划文件，而不是静默跳过。

**Codex 交叉验证**：Codex 将"从自由格式步骤文本解析 `Expected files:` 和 AC 标签"列为"最容易被 Agent 误解的地方"之一，并明确指出"格式脆弱"。这进一步支持升级到 P2：脆弱的解析 + 静默降级 = 无法感知的 drift detection 失效。

**结论**：升级为 P2（影响 drift detection 的可靠性）。

---

### F7：Agent Teams 中的 P2 处置流程（code-reviewer 标记 P3）

**code-reviewer 观点**：P2 logic/security 在 Agent Teams 中谁来 disposition 不明确。

**挑战者评估：维持 P3，但指出更大的模式问题**

这个问题是下面"整体连贯性"部分所述系统性问题的一个症状：SKILL.md 整体缺少"Agent Teams 模式专用说明"章节，导致所有涉及人机交互（AskUserQuestion、disposition、contract violation）的步骤在并行模式下都有歧义。

**Codex 补充**：Codex 同样指出"P2 disposition 边界不清晰——'P2 logic/security' vs 'P2 style/naming' 如何区分"。这是 P3 级别的清晰度问题，可在修复 N1（执行流程图）时一并说明。

修 F7 本身是 P3，但修底层的"Agent Teams 交互模式分叉"是 P1（见下文新发现 N1）。

---

### F8：无测试命令时 auto-pass 的 "tests green" 条件（code-reviewer 标记 P3）

**code-reviewer 观点**：跳过测试的情况下是否满足 "tests green" 未说明。

**挑战者评估：维持 P3，简单修复**

pipeline.template.yml 中 `test.command` 默认为空字符串，这是正常配置。文档只需在 auto-pass gate 条件里加一句："tests green（无 test.command 时视为通过）"即可。

---

## 二、挑战者新增发现

### N1：整体连贯性 — 概念密度超过 Agent 可靠执行阈值（P1）

work/SKILL.md 包含 7 个主要模块，总计约 190 行：

```
Pre-checks (Check 0-4)          → 任务管理系统
Execution Mode Selection        → 编排引擎
Contract Extraction             → 合规预处理器
TDD Cycle + Fix Loop Breaker    → 开发引擎
Pre-commit Checks (6 项)        → CI/CD 检查链
Commit                          → VCS 操作
Post-commit + auto-pass gate    → 持续集成决策器
```

**问题**：这 7 个模块跨越了 3 个关注维度（协调/开发/质量），任何一个都足够复杂到拆成独立 SKILL.md。在单一文件中，Agent 极可能：

1. 在 pre-commit checks 中迷失（最复杂，6 个子步骤，每个有不同的交互逻辑）
2. 忘记在 Agent Teams 模式下哪些步骤由 Lead 执行、哪些由 dev 执行
3. 将 Contract Extraction 的 `is_empty` 状态带错到后续步骤（没有明确的状态传递机制）

**参照 plan/SKILL.md**：plan 只有 4 个步骤（Research → Write Plan → Review → Confirm），每步职责单一，Agent Teams 的启动时机明确（Step 3 的开头），交互模式清晰（architect 汇总后发消息给 Lead）。work/SKILL.md 缺乏这种清晰的单线程叙事。

**Codex 交叉验证**：Codex 认为"191 行已接近需要将解析规则提取为紧凑规范性说明块（输入、输出、停止条件）的临界点，否则 agent 行为容易发生漂移"。这与 N1 的诊断完全一致，并提供了具体的修复方向：每个主要阶段需要明确的输入/输出/停止条件定义。

**结论**：P1。不是要拆分文件，而是需要在文件顶部添加**执行流程图**（伪代码形式），让 Agent 在开始前掌握全局脉络，避免在执行中迷失。

---

### N2：缺少"恢复点"定义（P2）

Pre-checks Check 0（Scratch Recovery）只在文件开头运行一次。但 work 是多步骤流程，如果 Agent 在 pre-commit checks 期间崩溃，下次恢复时无法区分"刚开始这个步骤"和"已经做完 TDD、正在等 review 结果"。

plan/SKILL.md 同样有这个问题，但 work 的流程更长、中断代价更高。

**建议**：在每个主要阶段（TDD 完成后、pre-commit checks 通过后）写入 scratch 文件的状态字段，如 `phase: tdd_complete`，供下次 Check 0 使用。

---

### N3：drift detection + auto-pass 的简化空间（Doodlestein 问题）

**当前设计**：
```
Contract Extraction（12 行）
  ↓
TDD Cycle
  ↓
Pre-commit Check 0: git diff --stat（展示）
Pre-commit Check 1: Contract verification（git diff --name-only 对比 files_allowed）
  ↓
Pre-commit Check 2-6: tests、review、disposition、challenge、re-review
  ↓
Auto-pass gate（4 个条件 + 安全模式例外）
```

**更简单的等效设计**：

```
TDD Cycle
  ↓
Pre-commit:
  A. 运行 git diff --stat（透明度）
  B. 如果计划步骤有 Expected files → 对比 git diff --name-only
     → 超出范围？问用户（Fix/Approve/Rollback）
       → 违规文件命中 security_patterns？强制 human review，不提供 Approve 选项
     → 未超出或无 Expected files → pass
  C. 运行测试
  D. 运行 code-review
  E. 处理 P1/P2 发现
  ↓
Auto-pass = tests_green AND no_P1 AND (no_contract_violation OR user_approved_drift)
```

关键简化：
1. **去掉 Contract Extraction 作为独立阶段**：直接在 pre-commit check B 中内联做——只需读计划步骤里的 "Expected files:" 一行，不需要提前解析并存储 `is_empty` 状态
2. **auto-pass 合并为单一布尔表达式**：当前 4 个条件可以合并为 3 个（`approved_drift` 显式处理后不需要单独的 `contract.is_empty` 分支）
3. **security_patterns 检查合并进 contract verification**：超出 `files_allowed` 的文件如果命中 `security_patterns`，触发 security pause；否则走正常 drift 流程

**Codex 间接支持**：Codex 将 `security_patterns` 的匹配语义（glob？regex？仅路径？）列为模糊点。内联到 pre-commit 后，可在同一处统一说明匹配规则，避免分散在两个章节。

**节省**：约 30 行文档，减少 1 个独立状态变量（`contract.is_empty`），消除 Contract Extraction 与并行模式的歧义（因为内联到 pre-commit，天然在 TDD 完成后执行）。

---

### N4：plan/SKILL.md 与 work/SKILL.md 的一致性问题（P2）

plan/SKILL.md 在 Plan Quality Self-check（Line 82-87）中要求每个步骤列出 "Expected files:"。work/SKILL.md 的 Contract Extraction 依赖这个字段存在。

**问题**：plan 的 Self-check 是 Agent 的自检，不是强制格式验证。如果 plan 的写作 Agent 漏掉了某些步骤的 "Expected files:"，work 的 Contract Extraction 只会静默降级到 `is_empty = true`，不会提示用户这是计划质量问题。

**建议**：在 work/SKILL.md 的 Contract Extraction 中，当 `is_empty = true` 且原因是"No Expected files line"时，输出：
```
⚠️ Contract: 计划步骤缺少 Expected files 行（drift 检测已跳过）。
   建议：运行 /ae:plan 补充该步骤的文件列表。
```

这样形成 plan → work 的质量反馈闭环。

---

## 三、Codex 独立发现（未被 code-reviewer 或挑战者覆盖）

### C1：Check 0/4 缺少超时或默认行为定义（P2）

**Codex 观点**：Check 0（"Resume?"）和 Check 4（"解决后继续"）都没有定义超时或默认行为。如果用户不响应，agent 会无限等待。

**评估**：这是真实的实现空白。对于 Check 0（scratch recovery），合理的默认值是"不恢复，从头开始"（超时 30 秒后默认 No）。对于 Check 4（deferred items），合理的默认值是"列出后继续，不阻塞执行"——因为 deferred items 是"需要关注"而非"必须先解决"的提醒。

**结论**：P2。与 F5（添加输出格式示例）一起修复：为每个 check 明确"默认行为（超时/无响应时）"。

---

### C2：Commit 拆分时每个 split 是否都需要完整 pre-commit（P2）

**Codex 观点**：对于拆分 commit，不明确是每个 split 都要完整 review 还是只对最终 split review。

**评估**：当前文档（Line 164）说"One step = one commit (can split if too large, but each must be independent logic unit)"，但完全没有说拆分后的每个 commit 是否都走完整的 pre-commit checks 链（包括 code-review 和 disposition challenge）。

实际上这个决策有显著影响：
- 每个 split 都走完整流程 → review 次数 × split 数，耗时倍增
- 只对最终 split 走 → 中间 commit 可能引入未审查的问题

**建议**：明确规则："拆分 commit 时，每个 split 必须独立通过 tests green 和 contract verification；code-review 和 disposition challenge 只在最后一个 split 执行。"

**结论**：P2。当前完全空白，影响 agent 的执行决策。

---

### C3：auto-pass 使用 pre-commit 缓存结果 vs 重新执行（P3）

**Codex 观点**：auto-pass gate 应明确说明是重用 pre-commit 检查的缓存结果还是 commit 后重新执行检查。

**评估**：从上下文来看，auto-pass gate（post-commit 阶段）显然应该重用 pre-commit 的结果，而不是重新执行。但文档确实没有明说。

**结论**：P3。加一句"auto-pass gate 评估 pre-commit checks 的结果（不重新执行）"即可。

---

### C4："resolve deferred items" 的操作定义（P3）

**Codex 观点**："resolve deferred items"（什么操作才算关闭一个 item？）含义模糊。

**评估**：Check 4 要求"找到当前步骤的 deferred items 并解决"，但没有定义"解决"是指：
- 删除 notes.md 中的条目？
- 将条目状态改为 `resolved`？
- 还是只要当前工作覆盖了该 item 即可？

**结论**：P3。notes.md 格式本身也未在 SKILL.md 中定义，这是一个更大的文档空白，可在专门的 deferred items 规范中处理。

---

## 四、综合评估

### 严重性汇总

| ID | 来源 | 发现 | 最终严重性 | 建议处置 |
|----|------|------|-----------|---------|
| F1 | code-reviewer | Agent Teams 中 contract 生命周期不明确 | **P1** | Execution Mode Selection 中明确 contract 提取时机和传递方式 |
| F2 | code-reviewer | Pre-commit check 编号与 Pre-checks 编号冲突 | P2（降级） | Pre-commit Checks 改用字母标记 |
| F3 | code-reviewer | Contract violation 恢复选项缺执行细节 | P2 | 补充执行说明；定义 4 态状态机；强制 AskUserQuestion |
| F4 | code-reviewer | auto-pass gate 中 contract.verified 含义模糊 | P2（合并入 F3） | 与 F3 一起定义 4 态状态机 |
| F5 | code-reviewer | Pre-commit Checks 嵌套过深 | P2 | 为每个 check 添加输出格式示例 + 默认行为说明 |
| F6 | code-reviewer | 提取失败 vs 故意无 Expected files 未区分 | P2（升级） | 两种情况输出不同警告级别 |
| F7 | code-reviewer | Agent Teams 中 P2 disposition 归属不明 | P3 | 在 N1 的执行流程图中统一说明 |
| F8 | code-reviewer | 无测试命令时 "tests green" 条件不明 | P3 | auto-pass gate 加"无 test.command 视为通过" |
| N1 | challenger | 7 模块概念密度超过 Agent 可靠执行阈值 | **P1** | 文件顶部添加伪代码执行流程图（Codex 独立验证） |
| N2 | challenger | 缺少多阶段恢复点定义 | P2 | TDD 完成后和 pre-commit 通过后写入 scratch phase 字段 |
| N3 | challenger | drift detection + auto-pass 可大幅简化 | P2 | Contract Extraction 内联到 pre-commit，auto-pass 简化为 3 条件 |
| N4 | challenger | plan → work 质量反馈闭环缺失 | P2 | is_empty 时输出 /ae:plan 建议 |
| C1 | codex | Check 0/4 缺少超时或默认行为 | P2 | 明确每个 check 的默认行为（超时/无响应） |
| C2 | codex | 拆分 commit 时 pre-commit checks 的范围不明 | P2 | 明确规则：每个 split 做 tests+contract，只对最后一个 split 做 review |
| C3 | codex | auto-pass 是否重用缓存结果不明确 | P3 | 加一句说明 |
| C4 | codex | "resolve deferred items" 操作定义模糊 | P3 | 在 deferred items 规范中处理 |

### P1 问题（阻塞，必须修复）

**P1-1（F1）**：Agent Teams 模式下 contract 的提取时机和传递机制完全空白。修复：在 Execution Mode Selection 中明确"Lead 在 TeamCreate 之前提取 contract，通过 dev agent 的 prompt 传入 `files_allowed` 列表"。

**P1-2（N1）**：整体文档没有全局执行路径视图，7 个模块在 Agent 视角下是平铺的 190 行文本，没有层次。Codex 独立确认了这个判断。修复：文件顶部添加 10-15 行的伪代码流程概览，每个阶段标注输入/输出/停止条件。

### 回答 Doodlestein 问题

**是否有更简单的方式实现 drift detection + auto-pass？**

是的。核心简化在于：**取消 Contract Extraction 作为独立阶段**，将其内联到 pre-commit check B。

当前设计在 TDD 之前提取 contract 并存储状态（`is_empty`、`files_allowed`、`target_ac`），然后在 pre-commit 再用这个状态做验证。这个"提前提取 + 延迟使用"的设计引入了：
- 状态在 Agent Teams 间的同步问题（F1/P1）
- 额外的独立文档章节（N3）
- `is_empty` 这个 intermediate 状态变量
- `security_patterns` 匹配规则分散在两个章节（C2 间接指出）

**简化方案**：pre-commit 时直接读计划文件当前步骤的 "Expected files:" 行，即查即用，不存状态。auto-pass 条件简化为：

```
auto_pass = tests_green
  AND no_p1_findings
  AND (no_contract_violation OR contract_violation_approved_by_user)
```

`security_patterns` 不需要作为第 4 个独立条件，只需在 contract violation 处理分支里：若违规文件命中 `security_patterns`，将 "Approve drift" 选项替换为"需要 human review（无法自动批准安全相关文件的 drift）"。同时在该处统一定义 `security_patterns` 的匹配语义（glob，路径匹配）。

这样整个 drift detection + auto-pass 逻辑可以压缩 30-40%，且消除 Agent Teams 下的歧义。

---

## 五、修复优先级建议

**立即修复（P1，阻塞）**
1. 文件顶部添加伪代码执行流程图，每阶段标注输入/输出/停止条件（解决 N1）
2. Execution Mode Selection 中明确 contract 提取时机（解决 F1）

**本轮修复（P2，重要）**
3. 将 Contract Extraction 内联到 pre-commit，去掉独立章节（解决 N3，顺带解决 F1）
4. Pre-commit Checks 改用字母标记，并为每个 check 添加默认行为说明（解决 F2/C1/F5）
5. Contract violation 选项补充执行细节 + 定义 4 态状态机 + 强制 AskUserQuestion（解决 F3/F4）
6. 区分 is_empty 的两种原因（解决 F6/N4）
7. 明确拆分 commit 时的 pre-commit checks 范围（解决 C2）
8. 多阶段 scratch 恢复点（解决 N2）

**可延迟（P3）**
9. Agent Teams 中 P2 disposition 归属说明（解决 F7）
10. 无测试命令时 auto-pass 说明（解决 F8）
11. auto-pass 重用缓存结果说明（解决 C3）
12. "resolve deferred items" 操作定义（解决 C4）
