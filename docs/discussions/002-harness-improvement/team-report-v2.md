---
id: "002"
title: "Agent Harness 改进 — Team Report v2"
created: 2026-03-29
authors: [lead, challenger, simplicity-reviewer, codex-proxy, gemini-proxy]
status: final
---

# Agent Harness 改进 — Team Report v2

## 参与者

- **Lead（架构师）**：读取所有 topic 和技能文件，负责综合与最终判断
- **Challenger**：深度质疑各方案的失效模式和隐式冲突
- **Simplicity-Reviewer**：从最小可行改动角度评估每个方案
- **Codex-Proxy**：GPT 系列视角，重点补充跨框架对比和证据模型
- **Gemini-Proxy**：Gemini 视角（flash），重点补充失败模式、反馈闭环和业界实践

---

## 跨 Topic 核心发现

在讨论具体 topic 之前，有三个贯穿所有议题的结构性问题需要先明确：

### F1：三个 Topic 存在隐式依赖链

```
Topic 01（计划质量）→ Topic 03（可判定的 drift）→ Topic 02（可信的 gate）
```

Topic 02 的 gate 条件"diff 范围在 plan step 内"和 Topic 03 的 contract 提取，都依赖 Topic 01 的 plan 足够结构化。如果 plan 里写"重构认证模块"，后两个机制都无法正常工作。这个依赖链在原始提案中没有被明确，是最大的隐患。

**推论**：实施顺序不能随意选择，必须遵循依赖关系。

### F2：缺少统一的 Evidence Schema

所有三个 topic 的方案都缺少对"证据"的明确定义。没有可追溯的 evidence（diff、test log、decision trace），所有 checklist 和 gate 都可能被形式化绕过（checklist gaming）。Evidence schema 是基础设施，而非可选项。

### F3：Topic 02 与 Topic 03 存在未解决的优先级冲突

Topic 02-A（Automation Gates）的自动继续条件之一是"diff 范围在 step 内"；Topic 03-A（Contract Violation）的触发也是"超出 scope"但结果是暂停。如果用户开了高自动化模式（level 2），但 agent 出现 scope drift，两个机制对同一事件的响应相互矛盾——谁的优先级更高？原始提案未定义，必须在实施前解决。

**解决方案**：Drift detection 的暂停优先级高于 Automation Gate 的自动通过。任何 contract violation 都是强制暂停，不受自动化级别影响。

---

## Topic 01：评判标准体系

### 推荐决定：A-MVP（精简分层 checklist）+ C（自然积累）；暂缓 D

**完整推荐 vs 原始提案的差异**：原始提案推荐 A+D 组合，但经过讨论后调整。

### 各方视角整合

**支持 A 的理由**（codex-proxy、gemini-proxy）：
- 分层结构化 checklist 成本低、立即可用、为 Topic 02/03 提供机器可读输入
- 与 CI/CD 多阶段质量门、rubric-based evaluation 等业界实践对齐

**对 A 的限制条件**（simplicity-reviewer、challenger）：
- 每个环节只加 1-2 个最客观的 checklist 项，不是完整 checklist（防止 SKILL.md 膨胀）
- 去掉所有计数类标准（"至少 3 个 options"），只保留可客观验证的条件
- 必须包含 evidence 字段（diff/test log/decision trace），否则 checklist 可被形式化绕过

**对 D（Doodlestein）的争议**：
- Challenger 指出 A 和 D 的哲学基础相反（checklist 假设你知道检查什么，Doodlestein 假设你不知道），做完 checklist 后 Doodlestein 会流于形式
- Challenger 还指出 Doodlestein 三问对执行环节无用（step 执行中无法回答"Smartest Alternative"）
- Simplicity-reviewer 建议最多在 2 个最高风险节点触发（plan confirm、discuss final decision），不要全环节
- Lead 判断：D 作为可选插件而非默认流程，避免仪式化

**对 C（事后统计）**：
- Gemini 建议立即开始收集 outcome 数据（返工率、P1 逃逸率），作为优化 checklist 的实证基础
- 不需要专门建数据管道，自然积累在 review report 里即可

### 具体实施内容

**`/ae:discuss` 结束时（agent self-check）**：
- 每个 topic 有明确 rationale（不是"感觉 A 好"）？
- 高风险决策有 reversibility 标注？
- Evidence：决策引用了哪些具体分析或数据？

**`/ae:plan` Step 2 完成后（agent self-check）**：
- 每个 step 有明确完成条件（不是"实现 X 功能"）？
- AC 有具体的验证方法（不是"结果应合理"）？
- Evidence：哪些文件会被改动（为 Topic 03 contract 提供基础）？

**`/ae:work` 每步完成时（agent self-check）**：
- commit message 引用了 plan step？
- Evidence：`git diff --stat` 输出（客观记录实际改动范围）

**改动类型**：纯 SKILL.md prompt 改动，零基础设施。

### 开放问题

1. Checklist 由谁演进？当前由 Lead 人工调整，长期需要 outcome 数据驱动
2. 多 agent 在非代码阶段的分歧仲裁机制（code review 有 challenger，discuss/plan 环节没有）

---

## Topic 02：自动化判定机制

### 推荐决定：D（效率优化）立即做；A（confidence gates）精简后做；B 作为后期 UX 封装；归档 C

**与原始提案的差异**：原始提案推荐 A 先行 + B 封装。经讨论后，D 的优先级提升到最高，且对 A 的实施范围有重要限制。

### 各方视角整合

**对 D（优化手动效率）的共识**：
- Simplicity-reviewer、challenger、gemini-proxy 三方均认为 D 应该最先做
- 零风险、立即改善用户体验、为后续变化建立基准
- 具体：P3 默认 auto-skip、P2 中 style/naming 类默认 skip，直接写入 pre-commit disposition 的默认行为

**对 A（confidence gates）的条件**（challenger 的核心质疑）：
- "diff 范围在 plan step 内"这个条件依赖 plan 足够详细；plan 写"重构认证模块"时无法验证
- "P2 style 类自动 skip"需要预先分类，分类本身是人工判断（把问题上移）
- False pass 比暂停更危险，因为用户失去警觉
- **前置条件**：A 只有在 Topic 01 的 plan 结构化、Topic 03 的 git diff 验证已建立后才能可靠运行

**Challenger 的替代建议**：最简单的自动化是"批量确认 + 默认继续"（用户主动授权"接下来 N 步自动执行"），把判断权还给用户而不是让系统猜。

**Lead 判断**：Challenger 的批量授权方式是 B 的简化版，可作为 B 的 MVI 实现（`--auto N` 参数而非 4 级系统）。

**对 B（分级自动化）的限制**（simplicity-reviewer、challenger）：
- 4 级系统用户需要理解每级含义，选错后果不对称（level 太低浪费时间可接受，level 太高出错严重）
- Level 参数会蜕化成开关：要么全开要么全关，中间级别几乎不用
- MVI 是一个 `--auto` 开关或 `--auto N`（指定步数），不是 4 级系统

**Gemini 补充的安全要求**：
- 自动通过时必须明确告知用户原因（透明度）
- 用户始终有 override 能力
- 必须保留审计日志（哪些步骤自动通过、原因是什么）
- 安全敏感操作（security/data 相关）强制人工，不受自动化级别影响

### 具体实施内容

**第一阶段（立即）**：纯 SKILL.md prompt 改动
- pre-commit disposition 默认行为：P3 auto-skip，P2 style/naming auto-skip
- 展示时只呈现 P1 和 P2 logic/security 类

**第二阶段（Topic 01 + 03 就绪后）**：
- 单一明确的 auto-pass gate：tests green + 无 P1 + diff 在 contract 范围内 → 自动继续
- 自动通过时输出理由："自动继续：tests green，无 P1，diff 在 scope 内"
- Exception：任何 contract violation 强制暂停，不受 gate 影响

**第三阶段（积累信任后）**：
- `--auto` 或 `--auto N` 参数，用户主动授权批量执行

### 开放问题

1. 误自动通过的发现和回滚机制尚未设计
2. "P2 style vs logic"的分类边界需要更精确定义，防止 category error（style 类隐藏逻辑风险）

---

## Topic 03：Drift Detection

### 推荐决定：D（circuit breaker）+ A-lite（contract + git diff）先行；E（plan-anchored）降级为可选；归档 B 和 C

**与原始提案的最大差异**：原始提案推荐 D+E 先行，A 作为下一步。经讨论后，E 的优先级大幅下降，A-lite 提升为与 D 并列的第一优先级。

### 各方视角整合

**对 E（Plan-anchored Execution）的重大质疑**（challenger，部分 codex-proxy 支持）：
- 核心失效模式：agent 复述了 plan 但没有遵守——这不只是 Cons，是该方案最根本的失效模式
- 更危险的是：复述制造虚假的"已对齐"安全感，让 scope drift 更难被发现
- 没有 A（客观验证），无法知道 E 是否真的有效
- Challenger 建议：E 应该排在 A 之后，而不是之前

**Gemini 的折中立场**：E 作为低成本预防措施仍有价值，但必须配合客观验证（A）才有意义，不能作为唯一的 drift 防控机制。

**Lead 判断**：E 降级为可选 prompt enhancement，不作为主力机制。核心机制是 D + A-lite。

**对 D（Fix Loop Circuit Breaker）的共识**：
- 解决最痛的 token 浪费，触发条件明确，影响范围小
- Challenger 的补充：如果 agent 修改了 test 本身，计数器可能重置导致 circuit breaker 失效；3 次阈值是任意的，某些复杂 bug 需要更多次迭代
- **建议**：计数器追踪"同一个 test file 的连续失败"而非"同一行 test"，阈值可配置（默认 3，允许覆盖）

**对 A-lite（contract + git diff）的升级**（codex-proxy 的核心贡献）：
- 同时覆盖 scope drift 和 hallucination drift，而 D+E 只覆盖 fix loop 和认知锚定
- git diff 是现成工具，实现成本不高
- 与 Topic 01 的 evidence schema 天然对接（post-step git diff --stat 既是 evidence 也是 drift check）

**Challenger 的最简替代（值得记录）**：
- 每步结束后直接展示 `git diff --stat` 给用户，不需要 contract，不需要自动判断，透明度本身就是 drift 检测
- 用户比任何自动检测都更懂"这个改动是不是 drift"
- 这可以作为 A-lite 的第一步实现，后续再加自动化 contract 验证

**Gemini 补充的语义漂移问题**：
- git diff 只能检测语法变化，不能检测语义漂移（文件范围合规但逻辑实现完全偏离 AC）
- 语义漂移检测是硬问题，需要 AST 分析或 AI 辅助对比代码 vs plan 描述
- 建议：先解决可客观验证的 scope drift，语义 drift 作为后续 Phase 3

**Legitimate Drift 问题**（gemini-proxy 补充）：
- Agent 可能发现更优解，正确判断是"改进"而非"跑偏"
- 需要"可批准偏离"通道：drift 检测触发暂停后，给 agent 提供"说明理由并申请批准"的选项

### 具体实施内容

**第一阶段（立即）**：
- D（Circuit Breaker）：TDD cycle 加计数器，同一 test file 连续失败 N 次（默认 3，可配置）→ STOP + 展示选项（重试不同方案 / 跳过并 defer / 寻求帮助）
- A-lite 第一步（透明度）：每步结束后输出 `git diff --stat` 供用户查看

**第二阶段（Topic 01 plan 结构化就绪后）**：
- A-lite 完整版：从 plan 自动提取 contract（files_allowed、must_not_touch、target_tests、max_fix_loops），post-step 自动做 diff + AC 映射校验
- Violation → 软暂停 + 偏离原因 + 可选动作（修复 / 批准偏离 / 修改 plan）
- E（可选）：在 A-lite 验证有效后，可叠加 plan-anchored 复述作为额外预防

**归档**：B（parallel monitor）、C（频繁 commit checkpoints）

### 开放问题

1. 语义漂移检测（approach drift）：文件范围合规但逻辑实现偏离 AC，需要 AI 辅助或 AST 分析
2. Multi-step contamination：早期小偏差在后续放大，后验难归因，当前方案无法处理
3. Plan 本身模糊时的 contract 提取：需要 plan 足够结构化（依赖 Topic 01）

---

## 跨 Topic 实施路线图

综合所有视角，推荐以下有序实施路径：

### Phase 1：纯 SKILL.md 改动（可立即执行，零基础设施）

| 改动 | 目标技能 | 解决的问题 |
|------|----------|-----------|
| pre-commit disposition 默认 skip P3 + P2-style | `/ae:work` | Topic 02：减少手动摩擦 |
| TDD cycle fix loop 计数器（3次熔断） | `/ae:work` | Topic 03：最大 token 浪费 |
| 每步结束输出 `git diff --stat` | `/ae:work` | Topic 03：基础透明度 |
| plan 完成后 agent self-check（2条核心指标 + evidence） | `/ae:plan` | Topic 01：plan 结构化基础 |
| discuss 结束后 agent self-check（rationale + reversibility） | `/ae:discuss` | Topic 01：决策质量 |

### Phase 2：依赖 Phase 1 的改动（需要 plan 足够结构化）

| 改动 | 目标技能 | 解决的问题 |
|------|----------|-----------|
| Contract 自动提取 + post-step diff 验证 | `/ae:work` | Topic 03：客观 drift 检测 |
| 单一 auto-pass gate（tests green + 无 P1 + 在 contract 内） | `/ae:work` | Topic 02：减少确认等待 |

### Phase 3：UX 封装与体验优化

| 改动 | 目标技能 | 解决的问题 |
|------|----------|-----------|
| `--auto` 参数（批量授权） | `/ae:work` | Topic 02：用户主动控制 |
| Doodlestein 触发点（2个节点：plan confirm、discuss final） | `/ae:plan`, `/ae:discuss` | Topic 01：cross-family 挑战 |

**不做**：Topic 02-C（Earn Autonomy）、Topic 03-B（parallel monitor）、Topic 03-E 作为主力机制（降级为可选叠加层）

---

## 关键分歧记录

### 分歧 1：Topic 03 的实施顺序（E vs A-lite 优先）

- **原始提案 + Simplicity-Reviewer + Gemini**：E（Plan-anchored）先行，成本最低
- **Challenger + Codex**：A-lite（contract + diff）优先，因为没有客观验证无法知道 E 是否有效
- **Lead 裁决**：两者并列 Phase 1，但 E 降级为可选（circuit breaker D 和 git diff 透明度是必须项，E 是锦上添花）。理由：E 本身不可验证，而 git diff 透明度（A-lite 第一步）几乎零成本，两者可以同时做但侧重不同。

### 分歧 2：Topic 01 中 Doodlestein 的定位

- **原始提案**：D 作为通用评判机制，在每个关键节点触发
- **Challenger**：A 和 D 哲学互斥，不适合组合；执行环节中 Doodlestein 无用
- **Simplicity-Reviewer**：只在 2 个节点触发，不要全覆盖
- **Lead 裁决**：D 作为可选挑战插件（challenge plugin），仅在 plan confirm 和 discuss final 两个节点触发，且只在 cross-family 可用时执行。不作为默认必须步骤。

### 分歧 3：Topic 02 中 B（分级自动化）的粒度

- **原始提案**：4 级系统（level 0-3）
- **Simplicity-Reviewer + Challenger**：4 级会蜕化成开关，MVI 是单一 `--auto` 开关
- **Lead 裁决**：`--auto N` 参数（指定步数），比 4 级系统更直观，同时保留了用户主动授权的语义。

---

## 反馈闭环设计（Gemini 补充）

当前三个 topic 的方案都缺少反馈闭环。建议在 Phase 2-3 逐步建立：

1. **短期（Phase 1）**：review report 自然记录返工率和 P1 逃逸率（Topic 01-C 的自然积累）
2. **中期（Phase 2）**：contract violation 记录作为 drift 频率数据，用于判断 phase 1 的 E 是否有效
3. **长期（Phase 3）**：audit log（哪些步骤自动通过、哪些触发 gate）驱动 checklist 和 gate 条件的演进
