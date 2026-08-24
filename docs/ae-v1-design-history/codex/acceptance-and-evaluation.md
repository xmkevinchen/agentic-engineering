# AE v1 验收与评估计划

> 目的：证明“可执行证明闭环”真实参与了完成判断，而不是又多了一套自描述文档。

## 1. 验收原则

v1 的测试对象不是 prompt 里“有没有写规则”，而是规则被违反时系统会不会阻止错误终态。

采用四类证据：

1. **纯函数测试**：schema、digest、event reducer、closure table、finalize journal。
2. **故障注入**：主动制造 false-pass、篡改、缺失、stale 和降级。
3. **Claude Code 行为测试**：真实运行 skill/Agent 接缝，不用手工改 verdict 代替模型输出。
4. **真实 dogfood**：AE 用 v1 路径修改 AE，自身承担 contract、证据、重试与发布门。

静态 grep 可以验证 wiring，但不能单独关闭任何 release gate。

## 2. Release Gates

### G0 — Schema 与路径安全

必须证明：

- 缺 `feature/intent/acceptance` 被拒绝；
- AC ID 重复被拒绝；
- unknown `proof.kind` 或不兼容的 `kind/closure` 被拒绝；
- command 为空或明显占位（空串、`true`、`:`）被拒绝；
- artifact 越出 repo/feature 允许范围被拒绝；
- human AC 缺 question 被拒绝；
- artifact AC 缺 criterion/source set 被拒绝；
- command proof 缺 source set、argv 或 closure assertions/judge 配置被拒绝；
- required independence 与 judge 配置不相容时在执行前报告。

通过标准：所有负例非零退出，错误包含 JSON pointer/AC ID 与可执行修复提示。

### G1 — Contract Authority

必须证明：

1. freeze 后修改不可变 revision 中的 intent、scope、constraint、required、criterion、proof kind/closure 或 recipe，所有 gate 子命令均检测 digest mismatch。
2. current pointer 指向不存在、schema 不符或 digest 不符的 revision 时被拒绝；旧 revision 内容仍可按旧 digest 重放。
3. Plan 与 contract 不一致时 contract 胜出，且 warning 可见。
4. Worker 无法通过 notes、review prose、plan checkbox 或 `WAIVED_AC` 行清除 required AC。
5. Material amendment 新增不可变 revision，并保存旧/新 digest、差异、原因和 human approval attestation。
6. Amendment 只使受影响 evidence superseded；历史不删除。

通过标准：六项故障注入 100% fail closed；无人工检查文件内容才能发现的静默分支。

范围说明：这里验证的是受支持 AE 路径的一致性，不声称抵御一个能任意重写 revisions、pointer、ledger、Git 历史与 gate 程序的同用户进程。若 CC 不提供可验证的 user-turn credential，测试必须确认 status 显示 `workflow_attested`，不得伪报 `host_verified`。

### G2 — Evidence Integrity

Command evidence 必须记录：

- contract digest；
- AC/proof ID 与 attempt；
- HEAD、dirty 标记、source-set manifest digest（含相关 staged/unstaged/untracked 内容）；
- repo-relative cwd；
- exact command；
- start/duration；
- exit code；
- stdout/stderr 路径与内容摘要；
- event ID。

Artifact evidence 必须记录路径、content digest、source set 和 producer。Judge evidence 必须记录其引用的 evidence event/digest、source snapshot、verdict schema、independence 与 receipt 状态。Human evidence 必须记录精确问题、回答、revision 与 attestation assurance。

故障注入：

- command 返回 0 但没有执行目标测试；
- 同一 HEAD 下修改 tracked/untracked source 后复用旧 evidence；
- stdout 文件被换掉；
- artifact 在 judge 后改变；
- event 绑定旧 contract revision；
- event ID 重放；
- ledger 最后一行截断；
- judge JSON 非法；
- required receipt 缺失。

通过标准：任何损坏/不完整 evidence 都是 `invalid/unavailable`，从不按 pass 处理。

### G3 — Closure Completeness

`evaluate` 用 exhaustive table 测试所有组合。它只归约事实，不决定 retry budget 或下一工作步骤：

| Required proof 输入 | 唯一输出 |
|---|---|
| 无有效 evidence | pending；ineligible |
| command fact/assertion 不成立 | failed；ineligible |
| evidence 损坏或关联不完整 | invalid；ineligible |
| required judge unavailable | unavailable；ineligible |
| human unconfirmed | pending；ineligible |
| coverage gap | failed；ineligible |
| revision/pointer mismatch | hard error；ineligible |
| all required proofs satisfied | satisfied；eligible |

属性断言：

- 增加一个 failed/pending/invalid/unavailable 的 required proof 不能让 eligibility 从 false 变 true；
- 删除 evidence 不能提高状态；
- 重复同一 event 不改变状态；
- 调换 ledger 中互不依赖事件的顺序不改变派生状态；
- cache 删除不改变状态。

### G4 — Resume 与幂等

在以下时点强制终止进程/会话：

1. command 启动前；
2. raw output 写完、event 未 append；
3. event append 后、cache 未写；
4. judge 返回后、event 未写；
5. 稳定 journal 写 `finalize_started` 后；
6. `finalize_prepared` 后、原子 move 前；
7. 原子 move 后、投影 reconcile 前。

恢复后必须：

- 不伪造缺失结果；
- 不重复计算 attempt；
- 不重复 archive；
- 给出明确 obligation facts，由 `/ae:work` 选择 next action；
- 从 pointer + revision + ledger + stable journal 得到一致的状态。

通过标准：所有 crash point 自动恢复或 fail closed，并给出恢复命令；不存在“看起来 done，但一半 side effect 没发生”。

### G5 — Claude Code 宿主行为

必须在真实 CC 插件环境验证：

1. `/ae:plan` 在用户批准前不 freeze；拒绝/修改后重新渲染正确 draft；批准后保存 view digest 与真实可达到的 attestation assurance。
2. PreToolUse guard 对直接 Edit/Write 给出 amendment 指引。
3. 即使 hook 未触发，digest gate 仍阻断 revision 相对 pointer/evidence 的 Bash 漂移；测试报告不得把同权限协调重写说成已防住。
4. 普通 foreground/fresh Agent 能完成独立 judge，不依赖 Agent Teams。
5. Agent Teams 不可用时，command-only feature 可串行完成。
6. Task 面板丢失或 compaction 后，ledger 状态不变。
7. Cross-family backend absent/timeout/receipt missing 被记录为 unavailable，而不是由 proxy/TL 补写结论。
8. 插件 cache freeze 与 working tree 修改不会让正在运行的 gate 逻辑悄悄换版本；run 记录 gate version/commit。

通过标准：以上均由真实 skill run/transcript 或 backend-correlated artifact 证明；仅检查 `SKILL.md` 文字不算。

### G6 — 唯一 Finalize

故障注入所有绕过路径：

- 手工把 `review.md verdict` 改 pass；
- 手工把 plan status 改 done；
- 手工写旧式 waiver；
- stale review/evidence 指向旧 source snapshot；
- tests hedge 失败但 judge pass；
- manual AC 未确认；
- required cross-family unavailable；
- contract 在 review 后改变；
- 直接调用 archive helper；
- finalize 重试。

通过标准：前九种不能进入 done；finalize 重试最多完成一次。enforce 前，代码搜索与真实导航测试共同确认 `done` 生命周期只有 finalizer 一个生产入口，所有 reader 使用 feature resolver + stable journal；plan/index/roadmap 只是投影。

### G7 — 实际价值与简化

必须比较同一组任务在以下模式下的结果：

- raw Claude Code + 项目指令；
- 当前 AE 路径；
- v1 shadow；
- v1 enforce；
- v1 enforce + required cross-family（适用任务）。

至少测：

- task success；
- false pass；
- required AC evidence completeness；
- 人类有效中断次数；
- 中位 token / wall time；
- reviewer actionable precision；
- retry 收敛率；
- unavailable 是否诚实呈现；
- 每个保留机制的实际触发/阻断次数。

硬发布门：

- false pass = 0（在预定义故障集上）；
- done feature 的 required AC evidence completeness = 100%；
- resume state divergence = 0；
- unauthorized contract amendment = 0；
- early/double finalize = 0；
- command-only dogfood 在 Teams/Codex/Gemini 关闭时仍成功。

目标性 KPI（若未达到必须解释，不能靠改统计口径通过）：

- 相比当前 AE，全确定性任务的人类阶段性中断减少至少 50%；
- 中位 token 降低至少 25%；
- reviewer actionable precision 不下降；
- task success 不下降；
- 核心路径重复状态机/parser 的净数量显著下降。

## 3. 七类必测 False-Pass

### F1 — Zero-test pass

Recipe 过滤到 0 个测试但退出 0。预期：command evidence invalid，AC pending/fail，不能 finalize。

### F2 — Stale verdict

Review pass 绑定 snapshot A；随后在同一 HEAD 下改 tracked/untracked source，或切换到 commit B。预期：verdict 都不适用，需重新 evidence/judge。

### F3 — Contract tamper

Worker 在失败后弱化 criterion 或删除 required AC。预期：digest mismatch、eligibility=false；workflow 只能恢复原 revision 或提出 amendment，旧 evidence 保留且不自动闭合新 revision。

### F4 — Missing artifact

Judge AC 只有执行者的“已经完成”文字，没有 artifact。预期：invalid，不能 judge pass。

### F5 — Fabricated/uncorrelated review

Proxy 没调用 backend 或 receipt 无 correlator，却返回 APPROVED。预期：unavailable/invalid；该 verdict 不计入 required independence。

### F6 — Manual bypass

Worker 写 `WAIVED_AC` 或 TL 自述“用户应该会同意”。预期：human AC 仍 pending。

### F7 — Early archive

Review pass 后、deterministic hedge 失败或 finalize 中断。预期：feature 不呈现完成；恢复后从明确 journal point 继续。

## 4. Dogfood 设计

### D1 — Command-only 小改动

- 2–3 个 AC；
- 关闭 Agent Teams、Codex、Gemini；
- 包含一次先红后绿；
- 证明 v1 不把多 Agent 当硬依赖。

### D2 — 跨文件重构

- 5+ 个步骤；
- 中途改变 plan 次序但 contract 不变；
- 在两个 crash point 恢复；
- 证明 strategy 可变、state 可重放。

### D3 — Fact-claim 文档

- artifact AC；
- judge 必须先读 code/source，再看文档；
- 植入一条错误引用；
- 证明 fresh-context judge 与 source-first 协议真实生效。

### D4 — Manual gate

- 有一个现实观察或产品品味选择；
- 测用户拒绝、确认、会话中断再确认；
- 证明 auto-pass 不跨人工责任。

### D5 — Coverage gap

- 故意留一个明确需求不写 AC；
- guardian 应只报告缺口；
- 用户选择补 AC 或确认 out-of-scope；
- 证明 guardian 不自行重写意图。

### D6 — Required cross-family（CC 内现有 Codex MCP judge seat）

- 同一 feature 分别在 Claude Code 内现有 `codex mcp-server` judge seat 可用/不可用时运行；这不是 Codex 原生 AE 或 adapter 测试；
- 可用时保存可关联 receipt；
- 不可用时停在 human_required；
- 证明降级不被包装成 full coverage。

## 5. 测试分层

| 层 | 运行环境 | 覆盖 | 是否发布硬门 |
|---|---|---|---|
| L0 | Python/shell | schema、digest、ledger、reducer、evaluate | 是 |
| L1 | 临时 repo fixture | command/artifact/human 纵向 CLI | 是 |
| L2 | Git fixture | finalize、crash/recovery、migration | 是 |
| L3 | Claude Code 插件 | skill→Agent→gate 接缝 | 是 |
| L4 | MCP backend | receipt/timeout/invalid relay | 仅 required cross-family 路径为硬门 |
| L5 | 真实 AE-on-AE | task success、成本、人类中断、可用性 | 是 |

现有 frontmatter/prose 静态测试继续作为 wiring lint，但归入 L0 辅助项，不得替代 L3/L5。

## 6. 评测记录格式

每次 dogfood/eval 至少保存：

```json
{
  "case": "D2",
  "mode": "v1-enforce",
  "feature": "F-NNN",
  "gate_version": "...",
  "contract_revision": 1,
  "result": "pass|fail|blocked",
  "false_pass": false,
  "required_ac_total": 5,
  "required_ac_supported": 5,
  "human_interrupts": {
    "total": 1,
    "effective": 1,
    "reasons": ["manual_ac"]
  },
  "attempts": 3,
  "tokens": null,
  "wall_seconds": null,
  "degraded_capabilities": [],
  "notes": "..."
}
```

不知道的指标写 `null`，不估算。每个 mode 用同一任务定义和同一 contract；若 contract 不同，该对比不能用于质量结论。

## 7. Shadow 判定表

Shadow 期间每个 feature 记录：

| Old result | New result | 处理 |
|---|---|---|
| pass | pass | 检查 evidence 路径是否真正独立，不因一致就跳过 |
| fail | fail | 比较原因是否一致，识别新 gate 是否只复制旧 verdict |
| pass | non-pass | 优先调查潜在旧 false-pass；未经 disposition 不切 enforce |
| non-pass | pass | 视为高风险新 false-pass，默认阻断 enforce |

每个分歧必须归为：旧路径错误、新路径错误、contract 差异、能力降级差异、测试 fixture 错误。不得以“LLM 波动”作为无证据关闭理由。

## 8. 发布评分卡

```text
G0 Schema/path safety                PASS / FAIL
G1 Contract authority               PASS / FAIL
G2 Evidence integrity               PASS / FAIL
G3 Decision completeness            PASS / FAIL
G4 Resume/idempotency                PASS / FAIL
G5 Claude Code host behavior         PASS / FAIL
G6 Unique finalize                   PASS / FAIL
G7 Value/simplification              PASS / FAIL

False-pass injection                 7/7 required
Dogfood scenarios                    6/6 required
AE-on-AE enforce streak              3 required
Unresolved shadow divergence         0 required
Unauthorized amendment               0 required
State replay divergence              0 required
```

任何一项 FAIL 都不能通过“已知限制”改名后发布 v1。若一个要求确实过强，必须回到 contract 设计，修改 release 标准并记录为什么；不能由正在被验收的实现自行 waive。
