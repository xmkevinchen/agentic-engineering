# AE v1 实施计划

> 目标：在当前 Claude Code 插件中落地“可执行证明闭环”。
> 约束：不做 Codex 原生移植、不抽象跨 runtime Core、不修改现有 `.ae/1.0` 材料。
> 工作量标记：S = 单一小改动；M = 一个可独立 dogfood 的 feature；L = 多个 feature 或需迁移。

## 1. 交付顺序

```text
P0 冻结 v1 语义与故障样本
  ↓
P1 建立 gate 内核（shadow）
  ↓
P2 建立契约所有权与显式锁定
  ↓
P3 建立证据账本与三类 proof
  ↓
P4 接管 work→review→finalize 闭环（enforce）
  ↓
P5 编排降级为策略并删除重复机制
  ↓
P6 迁移、dogfood、发布
```

顺序不可倒置：

- 没有 P1 的可重放 gate，P2/P3 仍只是新的文本约定；
- 没有 P2 的版本边界，P3 的证据可以通过改题目变成“通过”；
- 没有 P3 的 evidence，P4 的自动循环仍只能相信 reviewer 散文；
- P5 的删除必须等 P4 成为唯一真值，否则会先拆掉仍在工作的旧保护；
- v1 release 只接受 P6 的真实故障注入和 dogfood，不接受“文件都改了”。

## 2. 目标目录形态

新 feature 的最小持久化形态：

```text
.ae/features/active/F-NNN-<slug>/
├── index.md
├── analysis.md                 # 可选，事实研究
├── contract.draft.json         # 未批准或 amendment 草案；不参与 gate
├── contracts/
│   ├── rev-0001.json           # 不可变的规范契约 revision
│   ├── rev-0001.md             # 可重建的人类视图
│   └── rev-0001.lock.json      # 不可变 digest 与批准 attestation
├── contract.lock.json          # current immutable lock pointer
├── plan.md                     # 可变执行策略，只引用 AC ID
├── review.md                   # 人类可读的最新综合报告
├── run/
│   ├── events.jsonl            # append-only 证据和状态事件
│   ├── state.json              # 可重建缓存，不是真值
│   └── evidence/
│       └── AC1/
│           ├── attempt-1.stdout
│           ├── attempt-1.stderr
│           └── artifact.ext
└── milestones/
    └── step-summaries.md       # 只承载执行上下文，不承载 gate 真值

.ae/transactions/
└── F-NNN.jsonl                 # 稳定 finalization journal，不随 feature 移动
```

旧的 `goal.frozen.md`、`milestones/notes.md` 和 legacy plan 路径保留 reader 兼容，但新路径不再把它们当机器真值。

## 3. 配置与 rollout

在 `pipeline.yml` 增加暂时性 rollout 配置：

```yaml
proof_loop:
  mode: shadow   # off | shadow | enforce
```

语义：

- `off`：旧路径，仅用于回滚；
- `shadow`：旧路径继续决定行为，新 gate 同时计算并记录差异；
- `enforce`：新 gate 决定状态，旧脚本仅做兼容输出。

v1 正式版默认 `enforce`。该配置不是长期产品概念；删除旧路径后，`off/shadow` 一并移除，避免把临时迁移开关变成永久复杂度。

## 4. P0 — 冻结语义与故障样本

**目的**：先固定 v1 要防的错误，不先写一套看似完整的新系统。

### 工作包

| ID | 工作 | 量 | 主要产物 |
|---|---|---:|---|
| P0.1 | 定义 contract revision/pointer、typed proof、event、judge verdict 与 finalize journal schema | M | `docs/references/` 英文规格；JSON fixtures |
| P0.2 | 定义纯 reducer/evaluate 状态表和 material amendment 判定表 | S | 表驱动 fixture |
| P0.3 | 从真实历史提取七类 false-pass 样本 | M | zero-test、stale-verdict、contract-tamper、missing-artifact、missing-receipt、manual-unconfirmed、early-archive |
| P0.4 | 选定 4 个 dogfood 场景与旧路径基线 | S | 确定性代码、语义文档、manual、失败后修复 |
| P0.5 | 实测 CC 能力边界与保证措辞 | S | user-turn correlation、hook/Bash 边界、Task/Teams 非真值；拿不到 host credential 就标 `workflow_attested` |

### 主要影响面

- `docs/references/`：正式英文 schema 和语义说明；
- `plugins/ae/tests/fixtures/proof-loop/`：正反 fixture；
- `plugins/ae/tests/scripts/`：先写 failing tests；
- `plugins/ae/templates/pipeline.template.yml`：shadow rollout 配置。

### 退出条件

1. 每种输入只有一组 obligation status 与 finalize eligibility；workflow 动作明确不属于 gate。
2. 七类 false-pass 都有一个当前旧路径会误判或无法机械阻断的 fixture。
3. schema 不包含 Agent 名、runtime adapter、Teams topology 或知识图谱字段。
4. 评审者能仅凭 schema 说明 command/artifact/human 三类 proof 的生产者与裁决者。

### 撤退条件

如果 schema 为表达一个普通 feature 需要动态 DAG、数据库或通用 policy language，停止实现并继续缩小；这些统一进入 post-v1 backlog，不自动扩大 v2 的 Codex 移植范围。

## 5. P1 — Gate 内核（shadow mode）

**目的**：建立一个确定性、可重放、没有 LLM 判断的最小真值核。

### 工作包

| ID | 工作 | 量 | 实现要点 |
|---|---|---:|---|
| P1.1 | 新增 `ae-gate.py validate/render/freeze/check` | M | Python 标准库；稳定 JSON；不可变 revision；repo-relative 路径边界；稳定 renderer |
| P1.2 | 新增 append-only event writer | M | event ID 去重；原子 append/目录锁；原始输出单独落盘；不把 0600 误称跨同用户安全边界 |
| P1.3 | 新增 reducer：`status/evaluate` | M | 从 pointer + revision + events 重建 per-proof 状态与 eligibility；cache 不含 plan step |
| P1.4 | 建立 typed proof closure | M | `all_required_proofs`；direct assertions / bound judge / human attestation 唯一归约 |
| P1.5 | 建立 drift/stale 检测 | M | revision/pointer/event 绑定；source-set snapshot 含 dirty/untracked 内容 |
| P1.6 | 把旧 `loop-decide.sh` / `parse-review-verdict.sh` 接入 shadow adapter | M | 记录 old action 与新 obligation facts 的映射差异，不改变旧行为 |

### CLI 边界

`ae-gate.py` 只能：

- 校验 schema、摘要和路径；
- 写/读事件；
- 重放状态；
- 归约 proof 状态与 finalize eligibility；
- 最终阶段再做受约束的状态投影。

它不能：

- 调模型；
- 选择 Agent；
- 生成 AC；
- 修改产品代码；
- 判断测试覆盖或业务语义；
- 调度完整 workflow。

### 测试

- schema property cases：重复 AC、unknown mode、空 command、越界 artifact path；
- digest mutation：每个有效字段改变都被发现；
- event replay：乱序、重复 ID、旧 revision、损坏尾行；
- exhaustive obligation reduction table；
- crash simulation：append 前、append 中、cache 写前、cache 写后；
- 同一输入多次 `status` 字节一致。

### 退出条件

1. 删除 `state.json` 后，proof 状态能从 current revision + ledger 完整重建；plan step 由 plan/work 自己持久化，不混入 gate cache。
2. revision 任意 material 字段相对 pointer 漂移后，`record/status/evaluate` 全部非零退出。
3. 同一个 event 重放不双计数，旧 revision evidence 不污染新 revision。
4. Shadow diff 明确报告旧 verdict/action 与新 obligation facts/eligibility 的分歧，不自动修复或吞掉。

### 回滚

`proof_loop.mode: off`；新文件不参与旧路径。不能通过删除用户 ledger 回滚，ledger 保留为审计资料。

## 6. P2 — 契约所有权与显式锁定

**目的**：把“正确性边界”从 plan 作者手里交回用户确认的 contract。

### 工作包

| ID | 工作 | 量 | 主要文件 |
|---|---|---:|---|
| P2.1 | `/ae:discuss` 输出 draft contract | M | `skills/discuss/SKILL.md` |
| P2.2 | `/ae:plan` 支持无 discuss 的最小 draft，并只在 plan 中引用 AC ID | L | `skills/plan/SKILL.md` |
| P2.3 | Plan review 检查 recipe 可执行性、AC 覆盖与 proof strength | M | `skills/plan-review/SKILL.md` |
| P2.4 | 把现有 Step 5 改成明确的 contract approval | M | user 看 generated draft view + revision diff；批准才 freeze；记录实际 attestation assurance |
| P2.5 | 实现 amendment | M | `ae-gate.py amend` + user confirmation path |
| P2.6 | 添加 PreToolUse 早期保护 | S | manifest hook + guard script；最终仍靠 digest |
| P2.7 | 旧 `goal.frozen.md` migrate-on-touch | M | converter + explicit approval；不自动迁历史 done |

### 设计细节

- Analyze 只提供 facts，不能直接写 required AC。
- Discuss 生成 contract draft，但不产生锁。
- Plan 可以具体化 proof recipe；任何对 outcome/pass criterion/proof strength 的变化都在确认界面高亮。
- 用户批准的对象是生成式 draft view 的完整内容摘要，而不是只说“计划看起来不错”。
- Plan review 只能提出 amendment，不得把建议直接写入 locked contract。
- Worker、QA、reviewer 在受支持流程中只可提议 amendment，不写 revision/pointer；这是职责规则，不冒充 CC per-agent ACL。
- P0 若无法从宿主获得不可伪造的 user-turn credential，approval 明示为 `workflow_attested`；digest 证明内容一致性，不证明 actor 身份。

### 退出条件

1. 新 feature 没有明确 approval event 就不能进入 `/ae:work`。
2. `/ae:plan` 不再自动把自己写的 AC 当作已批准目标。
3. 直接改写 revision 而未同步 pointer/evidence 的 Edit/Bash 路径都在下一 gate 前被阻断；同权限主体协调重写整套状态明确不在 v1 安全承诺内。
4. 删除/弱化 required AC、降低 proof strength、扩大 out-of-scope 均触发 human amendment。
5. 纯实现步骤重排不触发 amendment。
6. 一个旧 `goal.frozen.md` feature 可被显式迁移；历史 done feature 无变化。

### 撤退条件

若简单任务平均需要两次以上额外人类确认，说明锁定粒度错误：保留“一次 contract approval”，把 recipe 的非 material 修正移到轻量 amendment，不退回阶段审批。

## 7. P3 — 证据账本与三类 Proof

**目的**：让“实际发生了什么”成为可重放事实，不再由 review 散文替代。

### 工作包

| ID | 工作 | 量 | 实现要点 |
|---|---|---:|---|
| P3.1 | Command runner | M | exact argv/cwd；HEAD + source-set manifest；dirty/untracked；exit/time/raw output；不猜业务语义或绕过 CC 权限 |
| P3.2 | Non-vacuity contract | M | recipe 必须自己 fail closed；adapter 可选，不硬编码少量框架为真值 |
| P3.3 | Artifact producer/locator | S | repo/feature path boundary；content digest；缺失即 invalid |
| P3.4 | Judge verdict recorder | M | 固定 schema；source-first；fresh-context/receipt 要求由 contract 指定 |
| P3.5 | Human evidence recorder | S | 精确问题、回答、revision、时间；与 amendment 授权区分 |
| P3.6 | 现有 collector 兼容层 | M | `collect-ac-evidence.py` 调新 runner；停止解析自由 Markdown |
| P3.7 | Evidence matrix renderer | S | review/dashboard 可读的 AC→attempt→adjudication 表 |

### Judge 最小协议

输入：

- 单条 AC；
- lock digest；
- proof ID、command evidence 或 artifact；
- required source set；
- 相关 test body / diff；
- 不含 worker 自评和 step summary。

输出：

```json
{
  "ac_id": "AC1",
  "proof_id": "P1",
  "value": "pass|fail|invalid|unavailable",
  "evidence_refs": [{"event_id": "...", "content_digest": "sha256:..."}],
  "source_snapshot_digest": "sha256:...",
  "rationale": "...",
  "citations": [],
  "independence": "fresh-context-claude|cross-family|human",
  "receipt": null
}
```

TL 不修复非法 JSON、不替 judge 补 severity、不把 unavailable 改写为结论；只记录 invalid event 并走 gate。

### 退出条件

1. 每次 attempt 都保留，成功不会覆盖失败。
2. 伪命令 `true`、零测试筛选、missing artifact、无效 judge schema 全部不能闭合 AC。
3. Command runner 的事实输出不包含“AC satisfied”语义断言。
4. Artifact/self-authored fact claim 按 contract 要求由 fresh-context 或 cross-family judge 评判。
5. Human AC 无用户 event 永远 pending。
6. 旧 evidence 可以导入，但默认 `unadjudicated`。

### 回滚

保留 ledger，关掉 enforcement。不要把 append-only history 转回覆盖式 `review.md` 真值。

## 8. P4 — 接管 Work、Review 与 Finalize

**目的**：让新 gate 真正成为唯一完成判据，而不是旁路报告。

### 工作包

| ID | 工作 | 量 | 主要修改 |
|---|---|---:|---|
| P4.0 | 先切换所有 lifecycle reader | M | status/navigation/review 统一按 feature ID + stable finalize journal 解析；禁止 plan/index verdict 定义 done |
| P4.1 | `/ae:work` 从 gate 读取 obligation facts | L | workflow policy 决定 retry/ask/amend/stop；gate 不调度 plan |
| P4.2 | 实现 proof-driven fix loop | M | attempt 绑定 proof/snapshot；cap 属于 workflow config；中断后历史可重放 |
| P4.3 | `/ae:review` 收窄到 coverage + sufficiency | L | 不再拥有 command 执行真值和 archive side effects |
| P4.4 | 新增 coverage guardian 两个触发点 | M | contract lock 前、final review；只能报告缺口 |
| P4.5 | `finalize` 唯一终态写入 | L | 稳定外部 journal；prepared 后原子 move 作最后权威写；投影可 reconcile |
| P4.6 | 统一 loop/review 语义矛盾 | S | edge-write 只在 terminal finalize 或明确独立阶段，不能同时两种说法 |
| P4.7 | enforcement 切换 | M | new features 默认 enforce；legacy shadow/migrate-on-touch |

### Finalize 事务步骤

1. 获取 `.ae/transactions/F-NNN.lock`，按 ID 确认 feature 只存在一个 lifecycle 路径；
2. 校验 current revision 与 source/evidence snapshot，重放 ledger，确认 `finalize_eligible=true`；
3. 向稳定的 `.ae/transactions/F-NNN.jsonl` 写 `finalize_started`；
4. 生成并校验归档审计摘要、source/target 与 ledger digest；
5. 写 `finalize_prepared`；
6. 将 `active/F-NNN-*` 原子 rename 到 `done/F-NNN-*`，作为最后一个权威状态变更；
7. reconcile plan display、feature index 与 roadmap；可选写 `finalize_observed`。

第 6 步前崩溃仍是 active；第 6 步后 critical state 已完整，恢复只补非权威投影。每一步幂等，重跑不能二次归档。roadmap 与知识图谱 edge-write 都不进入完成真值，失败只产生可见 drift/reconcile 工作。

### 人类中断

Work/Review 只因以下原因暂停：material amendment、manual AC、权限/不可逆操作、coverage gap、retry cap。普通 reviewer finding 能被现有 contract 裁决时，Agent 自行修复或记录为 out-of-scope，不逐条问人。

### 退出条件

1. Review 不能直接写 done 或 mv feature；绕过 finalizer 的测试失败。
2. stale review、hedge failure、manual 未确认、invalid evidence 均无法 finalize。
3. 一次 seeded defect 能经历 fail→fix→pass，ledger 保留完整历史。
4. 在任意 loop point 杀死会话，恢复后 action 与中断前一致。
5. Finalize 中途失败可安全重试，最多完成一次。
6. `proof_loop.mode: enforce` 下旧 verdict 与 notes 不能覆盖新 gate eligibility。

### 回滚

只在尚未 finalize 的 feature 上切回 shadow/off。已由新 finalizer 完成的 feature 不回写旧状态；如需撤销，走显式 reopen/amend 流程。

## 9. P5 — 编排降级为策略，删除重复机制

**目的**：Proof Loop 成为质量核心后，收回为旧 prompt-level 治理付出的 runtime 税。

### 工作包

| ID | 工作 | 量 | 决策 |
|---|---|---:|---|
| P5.1 | Review 改为 fan-out evaluator | M | 无相互依赖则普通 Agent；可并行也可顺序退化 |
| P5.2 | Teams 只保留于 discuss/consensus/真正协作开发 | M | 不再是 gate 前置条件 |
| P5.3 | Agent selection 改为 risk→role 小表 | L | 用户 force/exclude 保留；删除默认全量 selection ceremony |
| P5.4 | Cross-family 改为 proof seat | M | contract/risk 需要时调用，不每阶段固定加入 |
| P5.5 | 收缩 `agent-teams` / `agent-selection` | L | 保留宿主约束、隔离、timeout、receipt、shutdown；删除重复样板 |
| P5.6 | 删除旧 parser/gate/形态测试 | L | 仅在新 gate 已有等价或更强 mutation test 后删除 |
| P5.7 | 导航统一读 gate status | M | dashboard/status/next 不各自 grep 推断 lifecycle |
| P5.8 | 知识层降为非阻塞候选 | S | 不扩图、不把 graph health 放 completion critical path |

### 删除判据

一个机制满足任一条件即可候选删除：

- 只检查某句 prompt 或某个 heading 是否存在，而新 gate 已验证实际状态；
- 只为固定 Agent 编队服务，但没有独立 proof obligation；
- 产生的状态没有任何消费方；
- 与另一个 canonical helper 重复；
- 历史上从未阻止过一个由 v1 故障样本代表的真实 false-pass。

不得仅因“行数多”删除领域知识、风险 lens 或真正发现过问题的检查。先把保护对象映射到新 gate 或保留为策略。

### 退出条件

1. Agent Teams 关闭时，纯 command feature 可顺序完成。
2. Artifact feature 仍至少有 fresh-context evaluator；要求 cross-family 时缺席会停住。
3. 核心 `plan/work/review` 不再各自实现 contract/evidence/finalize 状态机。
4. 每个保留 reviewer 都对应明确风险或 proof seat；没有“人数本身=质量”。
5. 删除后的机制净数量下降，且七类 false-pass mutation test 仍全绿。

## 10. P6 — 迁移、Dogfood 与发布

**目的**：用真实 feature 证明 v1，而不是用自描述规则给自己通过。

### Dogfood 场景

| 场景 | 必须证明 |
|---|---|
| A. 小型确定性代码改动 | 无 Teams/无跨家族仍能从 contract 到 finalize；零测试 fail closed |
| B. 多文件重构 | plan 可重排，contract 不变；中断后恢复；多 attempt 保留 |
| C. 文档/事实性产物 | source-first fresh-context judge；错误引用被判 fail；worker 不能自评通过 |
| D. Manual/权限任务 | auto-pass 不跨 human；拒绝确认不归档 |
| E. 故意错误契约 | coverage guardian 指出缺 AC，由人决定 amendment 或 out-of-scope |
| F. Cross-family required | Codex 可用时记录 receipt；不可用时 human_required，不能降级 pass |

### 迁移

- 新 feature：直接 enforce；
- active/paused legacy feature：migrate-on-touch；
- done/abandoned：只读兼容；
- legacy free-text plan：可继续旧路径，但不能作为新 v1 release 证据；
- `goal.frozen.md` 保留原样，不改写历史。

### 发布工作

1. 更新 README/quickstart（仓库跟踪文档按 `CLAUDE.md` 使用英文）。
2. 更新 plugin version 与 changelog，只在 release 时 bump。
3. 为 contract revision/pointer、event schema、compatibility 与 recovery 写正式参考文档。
4. 记录 CC 版本与 hook/Agent 能力实测，不把 empirical 能力描述成契约。
5. 删除 rollout shadow 路径的明确 deadline；不能无限双轨。

### 发布门

全部满足才发布 v1：

1. [`acceptance-and-evaluation.md`](acceptance-and-evaluation.md) 的 G0–G7 全部通过；
2. 六个 dogfood 场景至少各完成一次；
3. 七类 false-pass 故障注入 100% fail closed；
4. 新 feature 的完成状态能从磁盘独立重放；
5. 没有任何 skill 能绕过 finalizer 写 done；
6. enforcement 下连续三项真实 AE-on-AE feature 无状态修复手工介入；
7. 旧/新 shadow 分歧全部有解释和 disposition；
8. 被新 gate 替代的旧 parser、重复状态机和永久 shadow 代码已删除；
9. v2 非目标没有以“顺手抽象”的形式进入实现。

## 11. 并行策略

在不破坏顺序约束的前提下：

- P0 schema、fault fixtures、dogfood 选择可并行；
- P1 event writer、reducer、closure tests 可并行，但必须共享冻结 schema；
- P2 discuss/plan drafting 与 legacy converter 可并行，approval/freeze 集成最后合并；
- P3 command/artifact/human 三条 producer lane 可并行，共享 event envelope；
- P4 work 与 review 可分别实现，但 finalizer 接口先冻结；
- P5 每个删除批次可并行审计，写入同一 skill 的改动保持单写者；
- P6 dogfood 可并行跑不同 feature，release 判定统一合成。

## 12. 主要文件影响面

### 必改

- `plugins/ae/skills/discuss/SKILL.md`
- `plugins/ae/skills/plan/SKILL.md`
- `plugins/ae/skills/plan-review/SKILL.md`
- `plugins/ae/skills/work/SKILL.md`
- `plugins/ae/skills/review/SKILL.md`
- `plugins/ae/scripts/ae-gate.py`（新增）
- `plugins/ae/templates/pipeline.template.yml`
- `plugins/ae/tests/scripts/`
- `plugins/ae/tests/fixtures/proof-loop/`（新增）

### 可能修改

- `plugins/ae/.claude-plugin/plugin.json`（只为早期 write guard hook）
- `plugins/ae/skills/agent-teams/SKILL.md`
- `plugins/ae/skills/agent-selection/SKILL.md`
- `plugins/ae/skills/dashboard/SKILL.md`
- `plugins/ae/skills/status/SKILL.md`
- `plugins/ae/skills/next/SKILL.md`
- `plugins/ae/agents/workflow/challenger.md`
- `plugins/ae/agents/review/*`
- `docs/references/`

### 兼容层，计划删除或瘦身

- `plugins/ae/scripts/check-harness.sh`
- `plugins/ae/scripts/collect-ac-evidence.py`
- `plugins/ae/scripts/parse-review-verdict.sh`
- `plugins/ae/scripts/loop-decide.sh`
- 只检查 prose shape、且已被行为/状态测试替代的相关脚本与 tests

### v1 不碰

- Codex 原生运行方式；
- 跨 runtime adapter；
- `.ae/graph` 的体系重建或改名；
- MCP transport 重构，除非它直接阻塞 required judge evidence；
- Web/UI/database/scheduler。

## 13. 风险控制

| 风险 | 触发信号 | 动作 |
|---|---|---|
| Gate 开始拥有 LLM 语义 | CLI 出现 prompt/model/agent 调用 | 停止并移回 skill/judge |
| Contract schema 过重 | 简单任务需要大量空字段 | 缩减 required schema，不加模板仪式 |
| 用户确认变多 | 每 feature >1 个非 manual 常规确认 | 审查 material 判定和 recipe amendment |
| Shadow 双轨拖延 | 两个 release 后仍两套真值 | 阻断新 feature，先完成 disposition/delete |
| Judge 伪独立 | 输入含 worker self-report 或同上下文自评 | evidence invalid；修 spawn/input contract |
| Finalize 非幂等 | 重试产生重复 move/roadmap 写 | release blocker，补 journal/recovery |
| “精简”误删知识 | 删除后真实故障漏出 | 按保护对象恢复单项，不回滚整个 P5 |
| 提前为 v2 抽象 | 出现 adapter/IR/provider-neutral API | 从 v1 移出，记录为 v2 输入 |

## 14. 完成定义

本计划完成不是“P0–P6 表格打勾”，而是：

> 任取一个 v1 feature，只读 current pointer、对应不可变 contract revision、`run/events.jsonl` 与稳定 finalize journal，一个全新 Claude Code 会话和确定性 gate 都能得到同一组 proof 状态与完成资格；revision 漂移、snapshot 过期、证据缺失或未决人类 proof 都不能经受支持的 plan/work/review 路径写成 done。Actor 身份真实性仍按已声明的 CC attestation assurance 展示，不伪装成密码学保证。
