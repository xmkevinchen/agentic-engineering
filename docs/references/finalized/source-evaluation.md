# 来源方案客观评价与裁决记录

> 评价对象：`../claude/`、`../codex/` 与补充方案 `../fable-v1/` · 评价日期：2026-08-22

本文件回答三个问题：Claude/CC 输出本身处于什么成熟度；Codex 规范骨架补足了什么；Fable 补充方案最后有哪些内容值得吸收或必须拒绝。评分是工程就绪度判断，不是文风或模型能力排名。

## 1. 评价方法

使用同一组、等权重的七个维度审查 Claude 与 Codex 两份来源，分数取算术平均并四舍五入到一位：

- 问题诊断；
- 逻辑/authority 一致性；
- 证据质量；
- 当前 Claude Code 可实现性；
- 迁移风险控制；
- 简化能力；
- 验收闭合度。

数字只是把工程判断显式化，便于发现评价不对称；逐项证据与 hard issue 比总分更重要。

Fable 顶层“合流版”明确读取并吸收了 finalized/Codex，不是第三个同条件独立样本；其 `blind/` 只有方案自身的独立性声明，没有 host-attested context/input 隔离。因此本文件对它使用同一工程标准逐 issue 裁决，但不再给一个与前两份并列的综合分，也不把结构相似当作“独立收敛证明”。

证据优先级为：当前仓库可复现事实 > 当前官方 CC 文档 > 原始论文/官方工程文章 > 二手总结 > 推断。单次或混淆变量实验只作为线索，不作普遍因果结论。

## 2. Claude/CC 输出评价

### 2.1 总评

`../claude/` 是一份很强的“现状取证 + 哲学压缩 + 设计增量”，但不是可单独实施的完整 v1。它最强的是发现真实失效、主动更正错误和要求删掉无价值机制；最弱的是规范自足性、信任边界、当前 CC host state 与发布故障门。

等权综合工程就绪度：**6.3 / 10**。

| 维度 | 分数 | 判断 |
|---|---:|---|
| 问题诊断 | 9.0 | collector 假绿、人类确认缺席、自行 waiver、relay 失真均有仓内锚点与实跑记录。 |
| 逻辑一致性 | 5.5 | 四对象主干稳定，但绝对棘轮与 amendment、agent 自拒与外部证明直接冲突。 |
| 证据质量 | 7.5 | 主动标注混淆变量并留下错误更正；样本小，部分外部结论被过度外推。 |
| 当前 CC 可实现性 | 5.0 | 认识 Skill/Agent/MCP/Hook，但未建模 Teams on/off、named Agent、结果通道和恢复限制。 |
| 迁移风险控制 | 5.5 | shadow、删除置后与逐项恢复正确；缺 authoritative cutover 和完整 legacy 双读方案。 |
| 简化能力 | 7.0 | “说不出删什么就不进设计”很强；knowledge、固定指标与跨家族主张又引入新范围。 |
| 验收闭合度 | 4.5 | 有退出条件，但缺系统的 false-pass、攻击、事务崩溃与宿主故障矩阵。 |

### 2.2 最强的贡献

1. **问题不是模型不会做，而是声明没有独立证明。** [哲学命题](../../ae-v1-design-history/claude/philosophy.md#二一条命题)准确指出 AE 的产品价值，不依赖某一代模型能力。
2. **本仓取证而非抽象批评。** collector 从未正确运行、self-check 豁免 harness、硬编码 feature 路径、人类确认缺席和 executor waiver 均有具体代码证据，见 [evidence §1](../../ae-v1-design-history/claude/evidence.md#1-诊断的三处取证)。
3. **方法学诚实。** 对混淆变量、错误的 BL-212 诊断和错误的同族 Debate 判断均主动更正，见 [evidence §10.4–10.7](../../ae-v1-design-history/claude/evidence.md#104-方法学记录)。
4. **Instruction Delivery 是真实边界，但原因果归因必须撤销。** Backend 未达而输出仍形似正常，以及声明配置与 effective 配置可能分离，足以要求 canonical Seat/input/host binding；但 Fable 终审发现 gemini-proxy frontmatter 在实验前已解析失败，因此“模型档位/任务密度导致首要动作被挤掉”的 E3 归因无效，必须修复后重测，见 [`../fable-v1/evidence.md`](../../ae-v1-design-history/fable-v1/evidence.md)。
5. **Recipe 被识别为代码执行边界。** [执行计划阶段 1](../../ae-v1-design-history/claude/plan.md#阶段-1--一条最小纵向切片)把 sandbox、timeout、网络/密钥、cwd 与破坏性命令策略提到前置位置，这是 Codex 初稿没有充分强调的风险。
6. **删除纪律与能力/常态区分。** 先保存历史 fail 档案、替代后逐项删除，以及 `〔能〕/〔常〕` 两类退出条件，能防止一次性演示冒充稳定工作流。

### 2.3 不能原样进入最终版的硬问题

1. **不是自包含规范。** [Claude design §1](../../ae-v1-design-history/claude/design.md#1-主干四个核心对象)把 schema、reducer 和 finalizer 继续外链到旧 Codex 目录；多处 D 编号也已失配。
2. **绝对棘轮剥夺人类最终权限。** [哲学中的“AC 可加不可删”](../../ae-v1-design-history/claude/philosophy.md#贯穿五者的一条棘轮)与错误 AC、material amendment 和范围可变同时成立不了。最终修正为“当前 revision 内不可弱化；人类确认的新 revision 可向任意方向变更，历史永久保留”。
3. **仍让 Agent 证明自己遵守了指令。** [Cast 棘轮](../../ae-v1-design-history/claude/design.md#32-cast-棘轮)依赖被覆盖的 Agent 自己拒绝；frontmatter 静默失效和 backend 未达都说明 declared prompt/metadata 与 effective delivery 不能由席位自证，自述只能增加可见性，不能成为 proof。
4. **没有关闭 AC 与 recipe 的共同自证。** 同一上下文可能起草 Intent→AC→rubric→recipe，独立 judge 只能判断证据是否满足这套窄定义，无法发现定义本身漏掉了用户意图。
5. **缺实时 host state。** fan-out/Teams 讨论没有处理当前 CC 的 named Agent→teammate、return/mailbox 差异、一 session 一 Team、resume 不恢复 teammate、Task 状态滞后等事实。[官方 Agent Teams](https://code.claude.com/docs/en/agent-teams)
6. **Recipe 安全只写了工作项，没有攻击验收。** symlink/path traversal、写 Contract/Ledger、输出炸弹、timeout/fork、网络/secret、并发污染、sandbox 不可用等没有唯一预期。
7. **没有明确 shadow→enforce→唯一 finalizer→退役旧生产调用路径的权威切换。** Gate 一直停在 shadow，计划却已开始删除旧机制。
8. **Knowledge 发布门会被游戏化。** 把 `.ae/graph` 政名、自然 read hit > 0 与三个 feature 的 token 非退化作为 1.0 硬门，既扩大核心范围，也不足以支持统计结论。
9. **没有先验证插件是否按 intended metadata 加载。** 当前 CC 2.1.231 的 `claude plugin validate plugins/ae` 对五个核心 Skill 与 gemini-proxy 报 frontmatter parse error；先修 bootstrap、再采 baseline 是实施前置，不能在 metadata 已被丢弃时推断真实 Agent/tool 行为。

## 3. Codex 输出评价

Codex 方案的优势是规范闭合：immutable Contract、typed proof、统一 event envelope、pure reducer、唯一 finalizer、shadow/enforce、migrate-on-touch、G0–G7、在 Fable 补充前的 F1–F7 与 AP-01–AP-17 均已形成完整骨架。

等权综合工程就绪度：**7.3 / 10**。

| 维度 | 分数 | 判断 |
|---|---:|---|
| 问题诊断 | 7.0 | 能定位多 truth/finalizer 问题，但最初不如 Claude 侧深入当前 collector、instruction-arrival 与具体失败样本。 |
| 逻辑一致性 | 7.5 | Proof Kernel 主干清楚；初稿对 revision ratchet、attempt 选择、Ledger head 与 finalize commit 仍留实现歧义。 |
| 证据质量 | 6.0 | 结构推理和官方宿主资料较强，仓内实跑/反例密度低于 Claude 侧。 |
| 当前 CC 可实现性 | 7.5 | 主动建模 Agent/Team/host state；初稿仍高估 per-invocation tool narrowing，且需 live matrix 收口。 |
| 迁移风险控制 | 8.5 | shadow→enforce、migrate-on-touch、唯一 finalizer、reader cutover 与恢复顺序最完整。 |
| 简化能力 | 5.5 | 初稿同时容纳 Selector、Workflow bridge、knowledge lane 等过多表面，存在把 v1 做成平台的倾向。 |
| 验收闭合度 | 9.0 | G/F/AP、runner attacks、crash/replay 与 dogfood 骨架最强，虽需把条件式预期继续拆成唯一 fixture。 |

它的不足是初稿偏“大而全”：文档体量大；Instruction Arrival 和 recipe 安全最初不够突出；Dynamic Workflow、完整 Pattern Selector 与 knowledge event 若同时进入 v1，会推迟核心纵向切片；原 Contract 示例也尚未完全锁定 `required_independence/family/assurance`。

因此最终版没有照搬 Codex，而是保留其 Proof Kernel，收窄执行层：

- v1 不发布 Dynamic Workflow preset；
- Pattern Selector 先实现为小型 decision table + dispatch record，不造 DSL/runtime；
- knowledge 与 `.ae/graph` 从 completion path 解耦，但不重命名、不作为发布门；
- command proof 的 recipe policy 与攻击测试提前；
- Instruction Delivery Contract 成为正式边界。

## 4. 关键冲突裁决

| 议题 | Claude 强项 | Codex 强项 | Finalized 决定 |
|---|---|---|---|
| 产品中心 | “执行者不能自宣正确” | Executable Proof Loop | 哲学采用前者，机器架构采用后者 |
| Contract | Agents 起草、人确认、业务视图 | revision/pointer/digest/amendment | 合并；人类可通过新 revision 修改任何 material 字段 |
| 棘轮 | 所有层只能收紧 | material amendment | 收紧仅约束当前 revision 内的非人类执行者 |
| Proof | 三模式、non-vacuity、project floor | typed closure、ledger、reducer | 合并；floor 也进入 revision digest |
| Coverage | 意图与 AC 的漏项守门 | fresh evaluator | 独立 semantic adjudication；不得伪称零知识 instrument |
| Recipe | 明确是代码执行边界 | canonical runner/event | runner policy 是 P1 前置，sandbox 能力不足时 fail closed 或显式人工路径 |
| Instruction | Agent Definition + Cast、真实事故 | Seat Contract + attestation | Definition + canonical Seat Contract；Cast 是人类视图，自拒只作 UX |
| Patterns | 隐含决策/交流两轴 | proof constraints + task geometry + host state | 最小拓扑 decision table；一个 mutation owner |
| Cross-family | backend 到达实测、自偏好动机 | family lineage/assurance/attestation | 仅在 Contract 要求或实测值得时使用；不能宣称“消除”偏差 |
| Teams | 独立先行再挑战 | 当前 CC binding/降级 | 普通 review 用匿名 subagent；Team 只用于 peer exchange |
| Dynamic Workflow | 认为需 opt-in | 完整证据桥设计 | v1 不发布；未来必须先有 workflow→ledger bridge |
| Knowledge | 读命中与失效条件 | 非核心、不能影响 Gate | 保留非阻塞 telemetry 实验；不重命名、不作发布门 |
| 实施顺序 | 依赖图、纵向切片、删除最后 | P0–P6 完整工作包 | 依赖驱动的 P0–P6，每阶段都有可 dogfood 纵向结果 |
| 验收 | `〔能〕/〔常〕`、真实产出抽查 | G/F/AP、crash/replay/host | 合并；正确性硬门与价值观测分开 |

## 5. 最终继承与淘汰

### 继承

- Contract / Strategy / Ledger / Gate 四对象；
- Agents 起草、人类可拒绝/修改后确认；
- append-only 历史、工作树 source-set snapshot；latest attempt 可更新 current 状态，但旧失败不删除；
- `command / artifact / human` 三种 proof mode；
- instrument → semantic judge → instrument 的闭环；
- Definition 与 task-time Seat Contract 分层；
- backend reachability 的外部 attestation；
- 冲突的是隐含决策而非文件句柄；
- 独立先形成结论，再进行有限挑战；
- 先量、纵向切片、shadow、enforce、退役最后；
- 每个删除项必须有保护对象和替代 mutation test。

### 修正或淘汰

- 绝对“AC 只能加不能删”；
- Agent 自述、自检、自拒作为权威控制；
- transcript scraping、Task、Team、mailbox、`/goal` 或 review prose 参与 completion；
- 默认 cross-family、默认 debate、固定 Doodlestein/reviewer 编制；
- Pattern 名称进入用户生命周期或新建通用编排 DSL；
- Dynamic Workflow 进入 v1 必需路径；
- `.ae/graph → .ae/knowledge` 的 v1 重命名；
- read hit > 0、SKILL 行数、模板数、token 绝不增加、三个样本即证明非退化；
- 预设“删 27 留 6”；
- 对 `TeamCreate/TeamDelete` 或特定 CC 版本 API 的语义绑定。

## 6. 评价边界

本评价确认了关键代码锚点与当前官方 CC 文档，但没有把六类 dogfood 全部重新跑一遍，也没有用小样本声称统计性因果。所有宿主事实必须在实现阶段由 capability probe 再确认；本文件的评分不进入 Gate 或 release reducer。

## 7. Fable 补充方案的最终裁决

### 7.1 定位

[`../fable-v1/README.md`](../../ae-v1-design-history/fable-v1/README.md) 自己把顶层方案定义为读取 finalized/Codex 后的“合流版”，所以它适合做 adversarial cross-review，不适合重新成为第三套 authority。`blind/` 可以保留为研究档案，但“没有读过什么”不能由产出者自证；它只提供候选问题，不能为 finalized 的正确性加票。

Fable 的最大价值不是另一套架构，而是把已有主干上的 omission/producer-confusion 问题说得更尖锐；其最大风险则是用一组较弱的 Ledger、runner 与 finalizer 重新实现已经闭合的 Kernel，并把关键正确性依赖延期。

### 7.2 吸收，但按 finalized 信任模型重写

1. **AC-level falsifier。** 吸收“什么可观察结果足以证伪该 AC”作为人类视图与 fresh coverage 的语义问题；它进入 revision digest，但 Gate 不解析这段自由文本，也不替代 typed assertion。
2. **字段完备的 approval view。** 吸收 recipe/security/floor/material-diff 全展示与 schema-field→view golden coverage；高风险摘要不能代替完整字段。
3. **Floor catalog 全量处置。** 每个 active floor 恰有一个 `bound` 或经 coverage 审理的 `not_applicable`；缺项、重复与伪 N/A 都不能 activation。
4. **Floor 演进闭环。** 逃逸缺陷可产生带原始 refs 的非权威 proposal；后续 human-confirmed release feature 可发布 exact-digest immutable 单-floor extension，未来 Contract 逐次 opt-in 并快照，不原地改 policy、不追溯旧 Contract，也不伪称 project-wide promotion。
5. **Seat producer-confusion 防线。** 把 F8 改写为 `dispatch → raw seat_result → judge/coverage normalized event` 全字段等式、Ledger-seq 顺序、Ledger-defined normalization authorization 与专用 producer ACL 的联合 fixture；不是仅凭一个 dispatch ID 或 producer role。
6. **Runner wrapper/child 分域。** “canonical recording 成功”与 child exit/signal/timeout 分开；在要求 `exit_code_in [0]` 的 fixture 中，child exit 127 + recorder success 仍必须保存 127 并得到 failed proof。
7. **盲仪器与实施纪律。** 机械层只认识版本化协议，不硬编码 feature/业务路径；机制准入增加“实际替代/收紧/删除什么”；迁移项区分 `verified_read` 与 `inferred_pending_audit`；单人实施保持一条 integration critical path。

这些吸收项已经分别落入 [`design.md`](design.md)、[`philosophy.md`](philosophy.md)、[`acceptance-and-evaluation.md`](acceptance-and-evaluation.md)、[`implementation-plan.md`](implementation-plan.md) 与 [`migration-map.md`](migration-map.md)。

### 7.3 明确拒绝

- approval 即 activation、pointer 代替单调 `contract_activated`，以及跨 revision 复用旧 pass；
- Agent 自定义 regex/count parser、mandatory `red_at_freeze`、AC 数量 hard cap；
- 只事后检测 protected path、默认声明式网络策略、继承宽 env、弱 source manifest；
- 无完整 seq/head/attempt cardinality 的 Ledger 与缺 lease/no-clobber/双 parent fsync/at-commit snapshot 的 finalizer；
- 仅按时间窗关联 backend、缺 input/result digest 仍声称 `backend_correlated`；
- 硬编码 `haiku < sonnet < opus < fable`、任意 prompt 行数上限或“异族可达就全局 required”；
- 所有 feature 强制第二次最终人工验收；需要人验收时继续使用 Contract 中显式 `human` proof；
- v1 重命名 `.ae/graph`、按三个月无读取自动处死 knowledge lane；
- 用所谓“1.0.0 hard-gate 子集”延期 JCS、product delta、activation、lineage、writer lease、legacy discriminator 等真值依赖。

### 7.4 Fable 终审后的再裁决

Fable 最终自评在 [`../fable-v1/cross-review.md`](../../ae-v1-design-history/fable-v1/cross-review.md) 中正式撤回 `count_rule`，承认 producer ACL + operation token、canonical coverage author anchor 与 finalized 的 Ledger/finalizer 强于其方案；这些更正提高了该评审记录的方法学价值，但不提升其 authority。

终审新增四项按事实处理：

- **接纳 E3 作废。** 不再把模型档位或 prompt 密度写成已证因果；P0 修复六个 frontmatter 后做受控重测，实际 provider/model/profile 仍只作 telemetry，不进入硬编码 tier Gate。
- **接纳 bootstrap 证据升级。** 五个核心 Skill 的裸冒号与 gemini-proxy 未引号 probe 必须有真实 negative regression；`check-declared-vs-effective.sh` 没拦住这类空 metadata，不能继续被当作充分防线。
- **接纳 provider spike 前置，拒绝降标。** 在大规模 schema 实现前先验证首发平台隔离可行性；`declared_only` 只可导致 command `unavailable` 或显式 human/artifact amendment，不能让未隔离命令产生 proof authority。
- **部分接纳项目 floor 路径。** v1 增加由 `policy_extension_release` 产出、经 human proof 批准 exact digest 的 immutable 单-floor extension；未来 Contract 可显式选择并复制本地快照。它是 opt-in project library，不是全局 promotion；proposal/文件存在本身不获得 authority。Plugin-global floor 继续随插件 bundle 发布。

终审所谓“两项待用户裁决”在本最终版已有明确决定：`.ae/graph` 在 v1 不更名；knowledge 的 30/60/90 日数据只交人 review，不设三个月自动死刑。因此不再把它们留作实施期悬案。

### 7.5 最终结论

最终 v1 不取三份文档的并集，也不再保留三套可选实现。它保留 finalized 的 activation/Ledger/reducer/finalizer/runner 骨架，吸收 Fable 经终审仍成立的增量，并以 G0–G7、F1–F8 与可执行 migration disposition 关闭新增承诺。`claude/`、`codex/` 与 `fable-v1/` 都只保留为来源/审计材料；`finalized/` 是本档案在设计定稿时采用的唯一规范。
