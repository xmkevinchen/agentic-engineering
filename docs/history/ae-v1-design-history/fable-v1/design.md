# AE v1 设计（合流版）—— 可执行的证明闭环

> **Status: historical — a source proposal, not a plan.** This is one of the
> independent proposals written before AE v1's design was consolidated. It was
> never the specification, and the specification it fed into has itself since
> been archived. **Nothing here has authority over current work.** The set and
> how each source was judged: [`README.md`](../README.md). The current account of what AE
> is and where it is going: [`rebuild.md`](../../../rebuild.md).

> 版本说明：盲写版存档于 `blind/`（独立推导记录，勿改）。本版按 `cross-review.md`
> 的逐条裁决更新：吸收 finalized/ 八项、codex/ 一项，自修四处（XR-1/2/3/4），
> 保留我方独有的七件。哲学层不变：`../claude/philosophy.md`。
> 吸收的判据只有一条：**它比我盲写的版本更好，且我能复述为什么。**

---

## 0. 推导起点与设计纪律

用户三目标（原话）：保留思想的前提下最大化精简 / 从业务出发保证 Agents 交付质量 /
让 Agents 越工作越聪明、越了解项目。

机制准入合并为六问（我方"删换紧"＋finalized 五问）：

1. 它杀死哪类**实测**失效？（指认不出的不进 v1）
2. 该失效能否用 fixture 或 live test 重现？
3. 更简单的确定性/solo 方案为何不足？
4. 它新增多少 token、延迟、状态与恢复表面？
5. 删除它时由谁继续保护同一性质？
6. 它删掉、替换或收紧了现仓的什么？（只加一层的是嫁接）

---

## 1. 两个平面（采纳 finalized 词汇；三问两律映射其上）

```
┌─────────────── 真值平面 ───────────────┐   Q1 契约 · Q2 账本+门+判官 · 唯一 finalizer
│ 契约 → 账本 → 门 → finalizer          │   L1/L2 是跨界规则
└────────────────┬───────────────────────┘
        canonical 事件边界（唯一入口）
┌────────────────┴───────────────────────┐
│ plan · worker · seat · Task · Team     │   自由域（Q3 知识供给此面）
│ mailbox · 诊断 · hook 遥测 · /goal     │   可丢失、可重建、可串行退化
└────────────────────────────────────────┘
```

协调面的任何信号（Task 完成、Team 消息、review 散文、hook payload、`/goal` 达成）
**永不**直接构成完成。它们只有经 canonical recorder、通过 schema 与 provenance
校验后才可能成为门的输入。

## 2. 契约（Q1）

### 2.1 载体：canonical JSON ＋ 生成视图（让步于 finalized，理由如下）

盲写版用单个 markdown 文件。改判：**机器真值是 canonical JSON revision，markdown
是单向生成的人类视图**——从 markdown 反向解析真值正是现仓的病根（grep 散文求状态），
不能再埋一次。目录形态采纳 finalized §14：

```
<feature>/
├── contract/
│   ├── revisions/R0001.json     # 不可变
│   ├── views/R0001.md           # 单向生成（生成器是盲仪器：确定性渲染，形式级）
│   ├── locks/R0001.lock.json    # revision digest + view digest + 批准记录
│   └── current.json             # 指针；临时文件+fsync+原子 rename 写入
├── plan.md                      # 自由域，只引用 AC/proof ID
├── ledger/events.ndjson         # 追加式
├── runs/RUN-*/                  # 原始输出、manifest、事件 payload
└── state/status.json            # 门的缓存，可删可重建
.ae/transactions/F-NNN.json      # finalize 日志，在可移动目录之外
```

**人确认的是视图**，lock 同时记录 revision digest 与 view digest——人读到的和机器
执行的由同一把锁绑住，视图失真即 digest 断链。current 权威是完整链：
pointer → lock → revision digest → 批准事件，四者互相匹配才算 current；
孤立的 revision、lock 或批准事件都不产生权威。

### 2.2 AC 形状（我方装置齐备＋finalized 字段合流）

```json
{"id": "AC-01",
 "criterion": "业务上可观察的完成条件",
 "source_refs": ["user:turn-17"],
 "consequence_if_missing": "缺失时的用户影响",
 "falsifier": "什么实测结果能证明它没做到",
 "red_at_freeze": false,
 "proofs": [ ... ]}
```

- `source_refs`（采纳）：每条 AC 钉回一句用户原话，关死"无来源 AC"类（E8、F-082/AC10）。
- `falsifier`（我方）：写不出证伪问句的 AC 是愿望。它同时是判官判空洞的量尺。
- `red_at_freeze`（我方）：新行为 AC 冻结时该红、回归 AC 该绿；冻结时实测一遍，
  实测与声明不符即契约不合格——抓"AC 冻结时已经绿＝根本没测新东西"。
- **AC 预算 ≤7**，超额须在契约头部说明。守门①同时挑战不足与过量。

### 2.3 Proof：以 mode 为判别子的 tagged union（采纳，含 XR-1 自修）

| mode | 专有字段 | closure | 可闭合事件 |
|---|---|---|---|
| `command` | source_set, recipe, count_rule? | direct 或 judge | command_result（direct）；+judge_verdict（judge） |
| `artifact` | source_set, artifact_contract, rubric | judge | artifact_observation + judge_verdict |
| `human` | question, response_schema, acceptance_rule | human | human_attestation |

direct closure 的断言来自**谓词白名单**（不是可执行表达式）：`exit_code_in`、
`signal_is_null`、`matched_count_at_least`、`output_not_truncated`、
`manifest_unchanged`、`artifact_exists_with_digest`。

**XR-1 的解**（我方给 finalized 的修补，同样进本方案）：`matched_count_at_least`
的输入事实必须有生产者——recipe 声明式提取规则：

```json
"count_rule": {"kind": "regex_line_count", "pattern": "^test .+ ok$"}
```

它是数据不是代码，进 revision digest、被人看过、随契约冻结；runner 只执行声明的
提取。**无 count_rule 的 command proof 不得使用计数谓词**（schema 校验拒绝）。
知识住在契约里，仪器只执行形式——宪法两边保住，解析器注册表无处回魂。
未声明 count_rule 时空洞判定归判官（常设指令：证据须显示 falsifier 被实际行使）。

### 2.4 地板（floors）：绑定采纳 finalized，演进保留我方（XR-4）

- 存放：`.ae/policies/floors/`——版本化 policy，**不在知识层**（盲写版放 checks.md，
  改判：地板是考题不是笔记，须 digest 绑定）。
- 绑定：契约引用适用条目并锁 policy digest；运行时改 pipeline.yml 降不了当前考题。
- **演进环（我方，finalized 缺失）**：finalize/retrospect 步从逃逸缺陷与被推翻判决
  产出候选条目（带事件引用）→ 人签入册（policy 变更与松绑同一信封）→ 后续契约的
  coverage review 检查适用地板是否被引用。这是"验证手段随失败演进、只紧不松"的
  唯一落地路径（Reflexion 的跨特性投影）。

### 2.5 修订与 material change（采纳，压缩表述）

Intent/Scope/AC/proof/recipe/断言/required_*/地板绑定的任何变化＝material，须新
revision＋人确认；计划顺序、实现方案、编队、retry 上限不是。棘轮（与哲学一致）：
当前 revision 内非人类执行层只能遵守或加严，不能弱化；人签的新 revision 可向任意
方向变更；旧 revision 与证据永久保留标 superseded。**新 revision 不继承旧 pass**——
门按显式兼容规则重判，不许复制 verdict。

### 2.6 守门①：coverage review（含 XR-3 自修）

冻结前，新鲜上下文评审双向检查：Intent/Scope 每条 material 主张→至少一条 AC；
每条 AC→可溯源；每条 required proof→能实际运行或显式 unavailable/human 路径；
外加四问（够不够/多不多/覆盖真实业务没有/异族视角缺什么）与"查过地板没有"。

**席位独立性来源**（XR-3）：契约管不到自己的起草评审——该席位的要求写在 pipeline
级 policy：fresh_context 必需；异族 backend_correlated 可达时必需，不可达时显式
degraded 记录并提示人。自偏好偏置在"起草者同族审起草者的 AC 集"这个位形上最强，
这正是它必须异族的原因。coverage 只产出 gap finding 交人处置，不能批准契约。

## 3. 策略（自由域，但复杂度必须挣得）

"怎么做"仍归 Agents——但采纳 finalized 的两条默认（advisory，不进门）：

- **最小拓扑阶梯**：solo → 匿名 subagent（return-only）→ 独立 fan-out →
  Team（仅当参与者必须交换证据或测试竞争假设）→ human。升级须记 dispatch 理由。
- **单一 mutation owner**：一个 feature 同时只有一个产品变更执行者；其余席位只读
  产品源、写自己的隔离产物。冲突单位是"必须让别人保持一致的隐含决策"，不只是文件。

修复循环：一次 attempt 内自适应执行；attempt 失败必须写结构化 `diagnosis` 事件
（failed refs / expected / observed / hypothesis / next）——**诊断是下一步的梯度，
永远不是真值**（codex 对 Reflexion 的界内投影，与 §2.4 的跨特性投影互补）。
跨 attempt 只有一个有界 evaluator→optimizer 环；cap 由策略读取 attempts 决定，
门不算 cap。

## 4. 账本（Q2 之一）

### 4.1 事件封套（合流版）

```json
{"schema_version": "ae.event.v1", "event_id": "EV-...", "idempotency_key": "...",
 "kind": "command_result", "feature": "F-123", "contract_revision": "R0001",
 "contract_digest": "sha256:...", "proof_id": "P-01", "run_id": "RUN-...", "attempt": 1,
 "producer": {"context_id": "...", "role": "runner", "family_instance": null,
              "model_tier": "sonnet"},
 "source_snapshot": {"manifest_ref": "runs/RUN-.../source-manifest.json",
                     "manifest_digest": "sha256:..."},
 "payload_ref": "runs/RUN-.../events/EV-....json", "payload_digest": "sha256:...",
 "gate_build": "git:...", "prev": "<链>", "hash": "<链>", "created_at": "..."}
```

追加式＋哈希链；重复 idempotency_key 同 payload 返回原事件、异 payload 拒绝——
不许静默写两份事实。`producer.model_tier` 是我方字段（E3：服从性是档位函数）。

### 4.2 source manifest：限定 source set（让步 1，撤回盲写版全区摘要）

盲写版对全工作区取摘要——任何无关文件改动都作废全部证据，单人日常流下天天误伤。
改判采纳：manifest 只覆盖契约声明的 source set（glob 解析为排序真实路径，逐文件
内容摘要，含 staged/unstaged/declared-untracked），**set 外变动不使 proof 过期**；
判官发现 source set 漏了相关来源时，proof invalid ＋ coverage finding，不许现场扩大。

### 4.3 事件权威白名单（采纳）

| 事件类 | 可否闭合 proof |
|---|---|
| `command_result` | 仅 direct closure 且断言全真 |
| `artifact_observation` | 否，等判官 |
| `judge_verdict` | 可，须满足 refs/独立性/家族/保证 |
| `human_attestation` | 仅其绑定的 human proof |
| `backend_invocation` | 否，只供 provenance/assurance |
| `contract_approval` / `dispatch` / `diagnosis` / `seat_result` / `floor_change` | 否 |
| hook/Task/Team/mailbox/`/goal` 遥测 | 否，且不经 recorder 不成事件 |

归约用白名单，不用"除黑名单外可信"。

## 5. 门（Q2 之二）

### 5.1 七态（让步 2）＋三值投影

`pending / passed / failed / invalid / unavailable / stale / superseded`，互斥、
有确定优先序。盲写版三值降为展示投影：green={passed}，red={failed}，其余全部
阻塞——invalid≠failed（程序违规≠真挂）、unavailable≠pending（能力缺席≠还没跑）
的区分是诚实降级的前提。

### 5.2 closure 代数

```
proof passed ⟺ 当前 contract digest 匹配
            ∧ 当前 source manifest 满足快照规则
            ∧ 所需事件类存在且 schema 合法
            ∧ 所有引用的事件/产物存在且 digest 匹配
            ∧ closure 规则为真（direct 谓词全真，或判官判决 pass）
            ∧ 独立性/家族/保证地板满足
            ∧ [XR-2] judge_verdict 配对到 recorder 写入的 dispatch 事件
              （seat_id、contract digest、prompt digest 匹配；无配对 → invalid）

finalize_eligible ⟺ 全部 required proof passed ∧ 适用地板全 passed
                  ∧ 无未决 material amendment / human proof
                  ∧ 无未被人签覆盖的 floor 松绑
```

XR-2 的意义：界内善意执行者追加一条 schema 合法、引用真实、digest 自洽的伪判决——
现有 hook 守卫（early guard）拦不住、纯 digest 校验看不见。配对校验把伪造成本从
"追加一行"升到"同时伪造调度记录"，且校验在门内、不依赖宿主 hook。残余照实说：
连 dispatch 一起伪造的界内行为者仍防不住，hook 路径守卫为纵深，同用户恶意进程
在威胁模型外。

门不做的事（采纳）：不调模型、不选席位、不建 Task/Team、不决定 retry/re-plan/
ask-human、不读散文猜判决、不把"没有数据"解释成通过。

### 5.3 唯一 finalizer 与事务（让步 3，盲写版完全缺失）

done 只有一个写入口。事务：验 pointer/lock digest → 锁内重新 evaluate → 写
`PREPARED` journal（于 `.ae/transactions/`，可移动目录之外）→ 同文件系统原子
move active→done → 目标目录追加 finalized 事件 → journal `COMMITTED` → 重建投影。
四个崩溃点唯一恢复语义：move 前崩＝仍 active，重放重试；move 后崩＝done 是事实，
恢复器只补记录；source/target 并存或 journal 截断＝fail closed 交人；双 finalizer
并发＝持锁者继续，另一方得 already-finalized。review 散文、Task 完成、手工 `mv`
都不是受支持的完成路径。

## 6. 判官与证明边界

### 6.1 独立性三分（采纳，替换盲写版单条"判执分离"）

1. **上下文独立**：判官不继承实现叙事，只读契约、source set、原始证据；
2. **职责独立**：同一 material 主张的生成者不能是其唯一通过依据；
3. **来源独立**：required 家族/保证须由可关联的外部调用满足——换同族实例或写个
   标签不算（family 按权重谱系计，同谱系多实例算一个来源）。

独立性是契约中的 proof requirement，agent 数量只是满足它的一种策略。

### 6.2 保证等级：类型化谓词，不是单一高低链（让步 4）

| 值 | 含义 | 适用 |
|---|---|---|
| `canonical_recorded` | canonical runner/recorder 产生并绑定 digest | command/artifact/judge |
| `host_recorded` | CC 宿主记录可关联到一次操作 | 调用 provenance |
| `backend_correlated` | 宿主/MCP 记录关联到外部 backend 的调用/输入/输出 | 异族判官席 |
| `workflow_attested` | 前台人机交互可关联，无独立人类凭证 | 批准、human proof |
| `host_verified` | 宿主提供可独立验证的人类凭证（须 P0 实测存在） | 批准、human proof |

`self_reported` 永不满足 required assurance。各值不能互相折算——backend_correlated
换不来人类批准，host_verified 也证明不了测试跑过；schema 按事件类校验合法组合。

### 6.3 席位合同（采纳 schema，＋我方档位字段）

```yaml
schema_version: ae.seat.v1
seat_id: review-P-02-a1
objective: adjudicate P-02 only
contract_revision: R0001
proof_ids: [P-02]
source_set_ref: R0001/P-02
allowed_tools: [Read, Grep, Glob]
mutation_rights: none
required_independence: fresh_context
required_family: non_author_family
required_assurance: backend_correlated
minimum_capability_tier: sonnet        # 我方（E3）：服从性是档位函数，不是措辞函数
result_schema: ae.judge.v1
authority: result_is_input_not_gate
stop: [source_unavailable, backend_not_correlated, contract_digest_mismatch]
```

三层输入：Agent Definition（稳定职责，版本化）／Seat Contract（本次任务的 canonical
调度输入）／Cast 视图（人类可读投影，非机器真值）。项目事实进席位合同不进通用定义；
席位合同可收窄定义权限、不能解除其义务。`BACKEND: reached|not-reached` 首行与
not-reached 时留空 FINDINGS 保留为 **fail-fast UX**（E3 实测有效）——权威始终是
宿主侧 `backend_invocation` 事件（E1/E4）。dispatcher 记录席位合同 digest、实际
宿主绑定与 prompt digest——这正是 §5.2 配对校验的另一半。

### 6.4 跨家族按席位；两个守门员

`cross_family_seats:` 配置（adequacy: required / judge: required / debate: optional；
required 而不可达→degraded 事件＋人裁决）。守门①（discuss/coverage）保证业务需求被
正确理解——challenger 的终局角色：挑战 AC 本身正确性的最后一道关卡；守门②（review
判官）保证被确认的需求被合格验收。判官每 proof 一席、新鲜上下文、source-first、
结论必须带 refs、不读执行叙事。不默认 Debate（MAD 证据）；Team 只用于 peer exchange。

## 7. 人的接口

必然两次：确认契约 rN（确认的是**视图**，锁绑视图与真值）与终验收。异常：material
amendment、human-mode proof、coverage gap 的范围处置、新权限/不可逆外部动作/安全
合规、cap 后需改目标或取舍。确认必须可拒绝可修改；批准的真实性照实标
`workflow_attested`（宿主给出可验证人类凭证前不许自称 host_verified；digest 证明
内容一致性，不证明 actor 身份）。常规阶段切换与 retry 不打断人。

## 8. 宿主绑定（新增节，补盲写版缺口）

调度前记录能力快照并 **live re-probe**（配置字符串非空≠能力开启）：

```yaml
cc_version / invocation_mode: interactive|print|sdk / teams_enabled
agent_binding: anonymous_subagent|named_teammate / result_channel: return|mailbox
team_resumable: false / sandbox: {available, level} / backends: {codex: ..., gemini: ...}
```

已实测的 CC 事实（会漂移，用 live test 覆盖，不写成永久哲学）：Teams 开启时带
`name` 的 Agent 成为 teammate 且 **idle 通知不携带结果**——期望 return 结果的普通
评审/研究席必须用匿名 subagent；一个 session 一个隐式 Team；resume 不恢复
teammates；Task 状态可能滞后；`TeamCreate/TeamDelete` 已移除。hook payload 是遥测
与纵深（PreToolUse 挡契约/账本直改），不经 recorder 不成证据；`/goal` 是
continuation UX，账本 pending 时门胜出；Dynamic Workflow v1 不发布、不做 required
路径。

## 9. 闭环与阶段动词

```
需求 → analyze(可选, fan-out 研究) → discuss: 契约草案 + 守门①
 → 【人: 确认视图 → R0001】 ←──────────── material 变更回此
   → plan(自由域, 最小拓扑) → work: 单一 owner + runner 记账 + 有界修复环(盘上可续)
     → review: 判官逐 proof + 门归约 + 守门②
       ├─ failed/invalid → 回 work    ├─ 边界问题 → amendment → 【人】
       └─ eligible → 【人: 验收】 → finalize 事务(唯一入口) → 归档: 教训+地板候选
```

阶段名是入口不是本体。work 的 F-048 盘上 harness loop 原样保留，verify 一律经
runner 走账本。12-factor small-agents 约束执行 agent；discuss 豁免拆分（盘上检查点
为补偿控制），但其 861 行按 §12 的去规定性纪律瘦身。

## 10. 模式判决表

| 模式 | 判决 | 删/换/紧了什么 |
|---|---|---|
| ReAct | 一次 attempt 内的默认动作循环（已是事实，命名归位） | 防再买一次 |
| Evaluator-Optimizer | 跨 attempt 唯一有界修复环 | 删多头修复循环 |
| Reflexion | 两个投影：界内 diagnosis 事件（非真值）＋跨特性地板演进（人签） | 换掉"验证一次定终身" |
| Plan-and-Execute | 即契约(稳)+策略(变)本身 | 防再买一次 |
| ReWOO | analyze 的 fan-out/fan-in 形状 | 换掉串行研究占用；不落 review |
| LLM-as-Judge | 语义 proof provider，永不是门 | 紧判官位（异族 required） |
| MAD | 拒收新辩论位；Team 仅 peer exchange | 删默认辩论成本 |
| guardrail/tripwire | 即门＋盲检查＋hook 纵深 | 防再买一次 |
| 12-factor small agents | 执行 agent 适用；discuss 豁免＋瘦身 | 紧定义纪律 |

## 11. 知识层（Q3）

- `map.md`（实现索引）＋ `lessons/`：**非阻塞**，归档触点维护。不设死刑条款——
  判据是项目是否仍在推进（操作者立场：文档是实现的索引，项目推进它就有用）；
  读取命中作为发布后观测，不作发布门（防游戏化——此界限我方与 finalized 一致，
  分歧只在自动 kill 条款，已列为用户裁决项）。
- 地板已迁出至 `.ae/policies/floors/`（§2.4）——知识层里承重的那部分其实是 policy，
  分开之后知识层可以安心地轻。
- `.ae/graph` 更名 `.ae/knowledge` 排到 1.0 后首个 minor（迁移期兼容优先；用户
  偏好已记录在案，只是排序不是否决）。
- read-hit 仍是 plan P4 的**段位出口**：一条真实教训落盘且下一份契约引用它——
  接线的存在性证明，不是命中率指标。

## 12. 盲仪器宪法与删除纪律

宪法不变：机械件只许懂形式（退出码、摘要、哈希、相等性、schema、环境探测），
不许懂内容（业务名词、特性路径、解析器名单）。count_rule（§2.3）是宪法的标准解法
范式：知识进契约，仪器执行声明。

删除纪律（采纳 finalized，替换盲写版"逐一过堂"的松散表述）：

- 每个删除项需 `保护对象 → 替代机制 → mutation test` 三元组闭合后才删；
- 删除的测试不能是套件变绿的原因，旧失效在新套件中仍须被拦；
- **条件保留类不整批砍**：cast/shutdown/declared-vs-effective/reachability 等检查
  守的是宿主漂移，须逐个由 live behavior test 接替后才动；
- 不设"删到 N 个"的表演指标；行数、agent 数、写入量只是诊断。

已确证违宪三例不变（E5/E6/§evidence）：check-proxy-residual.sh（僵尸复活）、
collect-ac-evidence.py（解析器注册表＋失真退出）、graph-*.py 写入侧健康度。

## 13. 安全边界

不造假沙箱；runner 强制的最低攻面（采纳 R-01..12 为 P1 出口，此处列风险类）：
argv 数组＋无隐式 shell / cwd realpath 限界拒 symlink 逃逸 / timeout＋进程组终止 /
输出上限＋截断标记 / 最小 env 白名单不继承凭证 / 网络默认 deny 按契约明示 /
契约·账本·门·事务路径永不在写白名单且前后校验 / run 锁与共享 fixture 串行 /
要求隔离而宿主不可用→unavailable 不裸跑 / TOCTOU：run 前后各算一次 manifest。
**不能可靠阻止但能检测的，标 tamper-evident，不许写成 guarantee。** 真实缓解的
根仍是：人确认过每条会被执行的命令（recipe 在人签的 revision 里）。

## 14. 与现仓接续

本 session 已落三笔为雏形（db954b6 / 921c841 / 7fbc4b0）；F-065 是 §6.1 的先声；
F-082/AC10（frozen goal 仍含 AC10 而 review 声称经用户同意移除并 pass）是 amendment
机制的现成回归样本。迁移次序采纳：**runner 安全先于执行 agent 起草的 recipe；
删除晚于 enforce 与替代 mutation test**——这两条不可交换；其间 shadow 至少覆盖
一个真实 feature 并处置全部分歧后才 enforce。v1 仍是收敛不是推倒：把散在 35 个
脚本、24 个 skill 里的同一直觉收敛成四对象＋两平面＋两件盲仪器，再按 §12 纪律删。
