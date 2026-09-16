# 交叉评审：fable-v1 对照 finalized/

> **Status: historical — a source proposal, not a plan.** This is one of the
> independent proposals written before AE v1's design was consolidated. It was
> never the specification, and the specification it fed into has itself since
> been archived. **Nothing here has authority over current work.** The set and
> how each source was judged: [`README.md`](../README.md). The current account of what AE
> is and where it is going: [`rebuild.md`](../../../rebuild.md).

> 评审协议：fable-v1 四件（README/design/evidence/plan）在**不读 finalized/ 的前提下**先行写完，
> 之后才通读 finalized/ 七件全文（README、philosophy、source-evaluation、design、
> acceptance-and-evaluation、implementation-plan、migration-map；design 以盘上当前版本为准，
> 含谓词白名单硬化后的 §3.2）。因此以下收敛是盲推导的双向印证，分歧是真分歧。
> 本文同时是我作为跨家族评审席的首件交付。BACKEND 说明：本评审无外部 backend——
> 评审者是 Claude（Fable），被评对象由 Codex 主导定稿，家族异源性由这一事实本身构成。

---

## 0. 总评

**finalized/ 应当作为 v1 规范采纳。** 它在我盲写的每一个对象上都给出了更完整的版本，
并补齐了我两版都缺的三块：finalize 事务与崩溃恢复、宿主行为矩阵（Teams 绑定/恢复/结果
通道）、迁移的 shadow→enforce→删除次序。source-evaluation 对我旧稿 6.4/10 的评分与
八条硬伤，我逐条核对后**全部承认**——其中 #2（绝对棘轮剥夺人类终权）我的 fable-v1
已独立修正为与 finalized 相同的语义（M5 松绑信封 ≡ "revision 内不可弱化、人签新
revision 可任意方向"），这条收敛是盲推导下发生的，可作双向印证。

但 finalized 有**两处高危工程缺口、两处中危缺口、一处交付风险、两项与操作者明示
意愿相悖的裁决**。逐条见 §2。

---

## 1. 盲推导收敛表（双向印证）

| 元素 | fable-v1 | finalized | 备注 |
|---|---|---|---|
| 公理 | 正确性不能由执行方自宣 | 同（措辞"同一上下文"更准） | 采纳其措辞 |
| 四对象 | 契约/策略/账本/门 | Contract/Strategy/Ledger/Gate | 完全一致 |
| 三种证明方式 | command/artifact/human，六值降标签 | 同，D7 | 完全一致 |
| 快照绑定 | manifest digest 含未提交内容 | 同，且**限定 source set** | 其版更优，见 §3 |
| 判执分离 | actor 校验＋新鲜上下文 | independence 三分（上下文/职责/来源） | 其三分法更准 |
| 自述≠见证 | BACKEND 首行=UX，宿主事件=权威 | "自拒只作 UX"，backend_correlated | 完全一致 |
| 棘轮 | revision 内只紧；松绑走人签 | D3 同 | 完全一致（双方各自修正了我旧稿的绝对版） |
| 投放层入可信基 | cast 是合同载体 | Definition/Seat Contract/Cast 三层 | 其 Seat schema 更完整 |
| 模式准入 | 必须删/换/紧 | §6 五问＋G7 准入规则 | 同源（Round 0 硬约束），其五问更可操作 |
| 拒收新辩论位 | MAD 证据 | §9.5 不默认 Debate | 一致 |
| ReWOO 位置 | analyze 不落 review | analyze 可 fan-out，review 单判官 | 一致 |
| discuss 不拆 | 豁免＋盘上检查点 | Team 只用于 peer exchange（更收窄） | 方向一致，其收窄更狠 |

十二处核心全部收敛。两个独立推导、一个共享证据库，落在同一结构上——这本身是
该结构正确性的最强旁证。

---

## 2. 发现（按严重度）

### XR-1〔高〕 `matched_tests` 没有生产者——解析器注册表的回魂通道

**位置**：design §3.2 谓词白名单 `matched_count_at_least(field: matched_tests)`；
§4.1 "必须记录 matched tests/count 等 non-vacuity fact"；G3.3 与 F1 的判定都依赖该值。

**问题**：整个 F1（零测试假过）的关死路径压在 `matched_tests` 这一个事实上，但规范
从未说明**谁、如何**从任意测试框架的输出里算出它。可行实现只有两条路：runner 内置
按框架的解析器——这正是被淘汰的 `KNOWN_PARSERS` 注册表，会以每个新框架一次的速度
腐烂（本仓已实测过一轮）；或者 LLM 判官数——则 `matched_count_at_least` 不该出现在
**direct** closure 的确定性谓词表里。

**建议**：把计数规则挪进契约本身——recipe 增加声明式提取规则，例如
`count_rule: {kind: regex_line_count, pattern: "^test .+ ok$"}`。它是数据不是代码
（与"不能由 recipe 临时注入代码"相容），进 revision digest、被人看过、随契约冻结；
runner 只执行声明的提取——仪器执行形式、知识住在契约里，宪法两边都保住。
无 count_rule 的 command proof 不得使用 matched_count 谓词（schema 校验）。

### XR-2〔高〕 界内伪造 canonical 事件：F3 的 agent 变体没有 fixture

**位置**：design §6（envelope 无生产者真实性机制）、§10.3（PreToolUse "只是 early
guard"）、§1.2（"protected-path guard + digest 校验"）；F1–F7 与 AP-01–17 逐条核对。

**问题**：一个**善意的、界内的** worker seat 持有文件写权限，追加一条 schema 合法、
引用真实事件、digest 全部自洽的 `judge_verdict`——这不是威胁模型排除的"恶意进程"，
恰是本系统存在理由的那类失效（执行者自宣通过，F-065 一路记录的原型）。现有防线只有
hook 路径守卫（自认 early guard，且 hook 是会漂移的宿主特性）；Gate 的 digest 校验
验证不了 producer 字段的真实性——自洽的伪造事件对纯归约不可见。F3 测的是改契约，
F6 测的是散文旁路，AP-01 测的是无效引用；**合法引用的伪造判决**恰好落在三者之间。

**建议**：门增加一条交叉校验——每条 `judge_verdict` 必须能关联到一条 recorder 写入的
`dispatch` 事件（seat_id、contract digest、prompt digest 匹配），无 dispatch 配对的
判决按 `invalid` 归约。伪造成本从"追加一行"升到"同时伪造调度记录"，且校验在 Gate
内、不依赖 hook。补 **F8 fixture**：界内 seat 追加自洽伪造判决 → ineligible。

### XR-3〔中〕 Coverage review 席位的独立性来源悬空（先有鸡还是先有蛋）

**位置**：design §3.5、G1.7、P2.2。

**问题**：契约里的 `required_family/assurance` 管不到**契约自己的起草评审**——那时
契约还不存在。G1.7 只说 "fresh semantic evaluator"，该席位的家族与保证等级从何处
读取没有着落。而自偏好偏置的测量证据在这里适用性最强：起草者同族评审起草者的 AC 集，
正是"AC＋验证手段合谋把问题定义窄了"最容易漏过的位形（source-evaluation 自己列的
Claude 稿硬伤 #4）。

**建议**：写进 pipeline 级 policy（不随契约）：coverage 席位 fresh_context 必需；
可达异族时 `backend_correlated` 必需，不可达时显式 degraded 记录并提示人。
D5 dogfood 增加一臂：同族 coverage 与异族 coverage 对同一埋入缺口的检出对照。

### XR-4〔中〕 地板只有绑定机制，没有生长机制——Reflexion 无家可归

**位置**：design §3.2 project_floors（policy_digest 绑定，好）、§4.4"受版本控制的
考题"；§16 把 knowledge 整体降为非阻塞实验后，地板的演进循环随之被切断。

**问题**：谁在什么时机写出新的 PF 条目？规范没有回答。逃逸缺陷→新地板条目→后续
契约必引，是"验证手段随失败演进、只紧不松"的唯一落地路径（操作者明示要求）；
没有它，地板是一份静态考卷，Q3（越工作越聪明）失去承重部分。

**建议**：与 knowledge 降级解耦——地板目录本就不是知识图，是版本化 policy：
`.ae/policies/floors/`，finalize/retrospect 步产出候选条目（带来源 event 引用），
人确认后入册（policy 变更=人签，与松绑同一信封）；后续 revision 的 coverage review
检查适用地板是否被引用。这一条完整保留在 fable-v1 design §1.5，可直接并入。

### XR-5〔高·交付风险〕 计划是编制齐整团队的尺寸，操作者是一个人

**位置**：implementation-plan 全文。P0 一期 8 个工作包、7 个标 M（"M=一个独立
feature"）——**行为未变之前先做八个 feature**；P0–P6 合计 40+ 工作包，L 级 12 个。

**问题**：不是计划错了——每一项都能自证必要——是尺寸与操作者不匹配：单人兼职按此
执行是数月到数季，最大风险从"假过"变成"永远停在 0.14.2 的完美规范"。用户对我旧稿
的批评（教科书式、量等于无）与此对偶：那份薄得没实质，这份厚得跑不完。

**建议**：finalized 作为**规范**（目标不变量）全部保留；执行按 fable-v1 plan.md 的
纵向切片重排（P0–P5，单期 0.5–2 天，每期可运行物＋故障注入出口＋删除清单），并预注册
一张 **v1-solo 硬门子集表**：F1–F7 全保、R-01–12 全保（runner 是安全面，不裁）、
G0–G3 核心项保、G4 裁到四个 finalize 崩溃点、G5 裁到已实测的宿主事实＋每次 dispatch
前 re-probe、G7 移到发布后观察。裁掉的每一项标注"deferred"而非删除，1.0.x 补齐。
shadow 纪律采纳（我方计划原缺此环，是错的）：enforce 前至少一个真实 feature 双轨并
处置全部分歧。

### XR-6〔用户裁决项〕 两处与操作者明示意愿相悖

1. **知识层三个月死刑条款**（design §16"三个月真实收益为零时删或重设计"）直接抵触
   操作者原话："我其实并不觉得一定要给死刑标准，项目只要是不停推进的，文档总是有用，
   文档充当的更是实际实现的索引。" 工程上（不阻塞完成路径）双方已一致；分歧只在
   kill 条款本身。建议：保留 read-hit 观测，删去自动死刑，处置权留给人。
2. **`.ae/graph` 不更名**（D14）——操作者曾明示"改成 .ae/knowledge"。finalized 的
   迁移期兼容理由成立，但这是排序问题不是否决问题。建议：1.0 后首个 minor 更名，
   写进 roadmap 而非 scope-out。

两项都不是工程对错，是需求忠实度——列出，由人裁。

---

## 3. 我方让步（finalized 优于 fable-v1 盲写版之处，逐条采纳）

1. **source set 限定的 manifest**：我方对全工作区取摘要，任何无关文件改动都会作废
   全部证据——单人日常工作流下这会天天误伤。finalized 限定在契约声明的 source set
   且"set 外变动不 stale"，正确。**采纳，撤回我方 M2 的全区版。**
2. **七态证明状态**（pending/passed/failed/invalid/unavailable/stale/superseded）：
   我方三值是它的投影，代数核心不变，但 invalid≠failed、unavailable≠pending 的区分
   是诚实降级的前提。采纳七态，三值降为展示投影。
3. **finalize 事务**：journal 在可移动目录外、崩溃点唯一恢复语义、双 finalizer 仲裁
   ——我方计划完全没有，采纳。
4. **assurance 是类型化谓词不是单一等级链**：backend_correlated 换不来 human
   approval——我方二分（attested/verified）太粗。采纳五值＋按事件类校验合法组合。
5. **Seat Contract schema**：我方的 BACKEND 首行合同是它的 UX 层；proof_ids、
   mutation_rights、stop 条件、result_schema 的完整规格采纳。
6. **单一 mutation owner ＋ 唯一 finalizer**（D6/D11）：我方未言明。采纳。
7. **F-082/AC10 现成回归样本**（migration-map §3.1：frozen goal 仍含 AC10 而 review
   声称经用户同意移除并 pass）——比我方 E8 更硬的 amendment 机制锚点。采纳入 fixture。
8. **AC 的 `source_refs`（钉到具体 user turn）**：把每条 AC 拴回一句用户原话，
   正面关死"无来源 AC"类。采纳进我方模板。

## 4. 建议并入 finalized 的 fable-v1 元素（除 XR 修复外）

1. **falsifier 行**：每条 AC 写"什么实测结果证明它没做到"。写不出证伪问句的 AC 是
   愿望不是标准——比 consequence_if_missing 更早暴露空 AC。schema 加一行，成本≈0。
2. **AC 预算 ≤7＋超额说明**：G1 目前没有契约膨胀守卫；20 条空洞 AC 能合法通过全部
   现有门。守门①同时挑战不足与过量（操作者四问原话）。
3. **red_at_freeze 声明与冻结实测**：新行为 AC 冻结时该红、回归 AC 该绿，实测须与
   声明一致——抓"AC 在冻结时已经绿=根本没测新东西"这类空洞，coverage review 的
   可执行性检查（G1.7）验不出这个。建议进 G1 新条目。
4. **席位规格含模型档位**：同一合同 sonnet 服从、haiku 被密度挤掉（evidence E3，
   三通道核实）。Seat Contract 加可选 `minimum_capability_tier`，dispatch 事件记录
   实际档位——服从性是档位函数，不是措辞函数。
5. **去规定性瘦身的模型侧依据**：Fable 迁移指南实测结论"为旧模型写的过度规定性
   prompt 降低新模型输出质量"——给 P5 的 skill 瘦身（8214 行）一个方向性判据：
   步骤散文降为目标＋约束＋检查点，而不只是"薄控制器"的结构性要求。

## 5. 裁决建议

采纳 finalized 为规范，附六项修订（XR-1/2 必修，XR-3/4 应修，XR-6 两项交人裁决，
§4 五项低成本并入）；执行按 XR-5 的单人纵向序列重排，硬门子集预注册。
fable-v1 的 design/plan 不另立门户——它的存留价值是：盲推导收敛记录（§1）、
evidence.md 的证据→决策映射（finalized 引用的实测大多源于此，集中存档便于回溯）、
以及本文。

---

## 附：合流执行记录（2026-08-22，随 v2 更新写入）

前文裁决已执行进 fable-v1 四件（盲版存档 `blind/`）。落点与状态：

**让步八项** → 全部落地：source-set manifest（design §4.2）、七态（§5.1）、finalize
事务（§5.3）、类型化保证（§6.2）、席位合同 schema（§6.3）、单一 owner＋唯一
finalizer（§3/§5.3）、F-082/AC10 样本（evidence E11、plan P0）、source_refs（§2.2）。
另追加让步第九项：**canonical JSON＋生成视图**取代盲版 markdown 单文件（§2.1）——
从 markdown 反向解析真值是现仓病根，不能再埋一次。

**我方并入建议五项** → falsifier / AC 预算 / red_at_freeze / count_rule /
minimum_capability_tier 全部进本方案 schema（§2.2/§2.3/§6.3）；是否进 finalized
由其维护者定。

**XR 状态更新**（finalized 在本评审期间并发硬化，如实重判）：
- XR-1（matched_tests 生产者）：**仍然成立**——G3.3 与谓词表继续引用该事实而无
  生产者定义；count_rule 方案照旧提交（本方案已内置）。
- XR-2（界内伪造判决）：**部分被吸收**——新 G2.7 的 host-attested evaluator context
  锚点覆盖了 required fresh context 情形；无该要求的 proof 仍无防护。我方的
  judge↔dispatch 无条件配对（§5.2）作为补集保留，F8 fixture 照立。
- XR-3（coverage 席位独立性）：**收窄**——新 G1.7 已锚定 candidate-author 上下文
  独立；家族维度仍未定，建议照旧（policy 级：异族可达则必需）。
- XR-4（地板演进环）：**仍然成立**——floors 绑定已硬化（G1.8 扩展），生长机制仍
  空缺；本方案 §2.4 为完整提案。
- XR-5（团队尺寸计划）：本方案 plan v2 的"1.0.0 硬门子集预注册"即具体对案——
  降声明范围不降单项标准。
- XR-6（两项用户裁决）：不变，待裁：知识层三个月死刑条款（抵触操作者明示立场）、
  graph 更名时机（本方案已让步排到 1.0 后首个 minor，只余 kill 条款一项实质分歧）。

---

## 终审（对完成版 finalized/，2622 行全量重读 · 2026-08-22）

> 评审方法：七件全读（design 1165 / acceptance 368 / implementation-plan 505 /
> migration-map 254 / philosophy 115 / source-evaluation 138 / README 77）；
> 可实测断言全部实测（`claude plugin validate`、check-agent-teams.sh L14、
> frontmatter 破坏源头与时间线的 git 取证）。

### 总判

**采纳为最终规范。** 完成版把中途快照遗留的每一处实现歧义都收掉了：activation 单调
权威链、producer ACL＋operation token、attempt 括号与槽基数、committed 语义
（done 不被未来变更 stale）、rollout lock 的 legacy 判别、JCS 字节形式、
R-10/AP-02 拆双臂、指标 null≠0。我在中途快照上找的六处，四处已被更强的机制解决。
剩余两处不是规范错误，是**可交付性**与**目标覆盖**问题——加两项前置 spike 与两项
用户裁决，见下。

### XR 逐条终判

| # | 中途快照判 | 终判 | 依据 |
|---|---|---|---|
| XR-1 matched_tests 无生产者 | 成立 | **已解决**（方式异于我方提案）：observation adapter 封闭注册表——adapter ID/schema/build digest 契约绑定，artifact 缺失/解析失败→invalid，合法 0→failed。我方 count_rule 被明文拒收（"不允许 Agent 注入 regex"——注：我方版本是契约冻结、人签过的声明式规则，非运行时注入，但 adapter 路线对结构化输出更稳，**撤回 count_rule**）。遗留观察项：adapter 注册表是逐框架生长的维护面，治理了腐烂没有消灭它，且"谁在何时写新 adapter"与地板同构地未定 |
| XR-2 界内伪造判决 | 部分吸收 | **已解决，强于我方提案**：recorder 填充全部封套字段（caller 不可覆盖）＋按 endpoint 的 producer ACL＋operation token＋attempt 事件集 digest＋host 生成的 independence 锚。我方 dispatch 配对是它的子集 |
| XR-3 coverage 席独立性 | 收窄 | **已解决**：coverage_review 成为 canonical 事件，绑定 candidate digest、受控 input manifest、candidate-author 锚。家族维度仍无要求——降级为可选建议（起草者同族审起草者 AC 集仍是自偏好最强位形），不再作 finding |
| XR-4 地板有绑定无生长 | 成立 | **成立且被结构化收窄**：绑定侧彻底解决（bundle/digest/内联展开），但 floor 的 `policy_source_ref/digest` **必须命中 plugin bundle entry**——项目级地板在 v1 结构上不可表达。逃逸缺陷→本项目新考题→下一契约必考的 Reflexion 环没有 v1 路径；knowledge lane 只收候选不出考题。这是把用户第三目标（越工作越聪明）的承重部分整体顺延出 v1 的**结构性选择**，应向用户显式承认而非默认 |
| XR-5 团队尺寸计划 | 成立 | **成立且加重**：P0–P6 增至约 50 个工作包（L 级约 20 个，L=跨多 skill 的独立 feature）；新增 Node+Ajv 工具链、14 份 schema、JCS、durable lease、rollout lock。最重的一条：P0.8 要求**资格认证原生子进程隔离 provider**且"找不到合格 provider 则 P1 与 1.0 都不能宣称通过"——首发平台是 macOS，sandbox-exec 自 10.8 起弃用、profile 语言无文档，这个发布门有相当概率把发布无限期挂起，或倒逼悄悄降标（规范自己禁止降标）。建议：①provider 资格 spike 提到一切之前（它 gate 全局）；②若不可资格化，采用我方 declared/enforced 两档（declared=人签过策略、tamper-evident，不称 guarantee）作为已定义的降级路径，而不是临场发明 |
| XR-6 两项用户裁决 | 待裁 | **原样保留进了定稿**：§16 知识层三个月死刑条款（仍抵触操作者明示立场）；D14 不更名。照旧交人裁 |

### 本轮新发现（全部实测）

**N1 · P0.0 证实，且后果比计划写的重。** `claude plugin validate` 实测失败六件：
think/plan/review/work/discuss 五个 skill＋gemini-proxy。共因已诊断：五个 skill 的
description 裸写第二个冒号（`… Recommended: Sonnet or above`）；gemini-proxy 是
未加引号的 `probe: [ …`（6bf9c58 引入，2026-08-16）。宿主行为是**运行时以空
metadata 加载、全部字段静默丢弃**——即六天来这六个定义的 model/tools/effort 声明
全部未生效。本仓专防此类漂移的 check-declared-vs-effective.sh 未拦住。这是
declared≠effective 的最尖锐展品，P0.0 从"卫生修复"升格为"证据链修复"。

**N2 · 我方 E3 作废自我更正。** run-2 的"sonnet 服从、haiku 被挤掉"实为
"完整配置的 codex-proxy vs 空配置的 gemini-proxy"（第四混杂：定义加载态；
xf-gemini 实际模型按继承规则很可能是 Opus）。已更正 evidence E3 并把 spec/seats
§7 档位序降为待重测假设。BACKEND 诚实降级那半不受影响（直接观测）。建议：P0.0
修复后重跑双臂对照（同模型×定义好坏、好定义×档位）——低成本，且直接校准
minimum_capability_tier 该不该存在。

**N3 · correlator 缺口有现成具体解。** migration-map §5 明言 gemini 封顶
host_recorded"除非新增 correlator"、openai-compat 的 family 是 caller 输入不可信。
我方 spec/seats §5 的方案即该 correlator 的实现：两座桥是本仓自有代码
（plugins/ae/mcp-servers/），在桥内落 `{ts, tool, model, input_digest,
output_digest}` 宿主侧记录（agent 不可伪造），各约 20 行。建议纳入 P2.7，
让 gemini/openai-compat 升到 backend_correlated。

**N4 · check-agent-teams.sh 误判实锤。** L14 `[ -n "$VAR" ]`——env=`0` 判为开启，
与 migration-map §4.1 断言一致。

### fable-v1 的处置

规范让位于 finalized；本目录保留价值收敛为四件：盲收敛记录（§1，双向印证的证据）、
evidence.md（实测档案，含 E3 更正的方法学记录）、三件仍活的贡献（N3 桥内
correlator、declared/enforced 降级档、单人硬门子集法——对应 XR-5 的两条建议）、
以及本评审链本身（中途快照→执行记录→终审，含一次对自己证据的作废更正）。
count_rule 正式撤回。

### 给实施的三条前置建议（按序）

1. **今天就修 P0.0**（六件 frontmatter，改法已诊断：description 加引号、probe 行
   加引号），随后重跑 E3 双臂对照——两小时内能完成，直接决定档位字段去留。
2. **provider 资格 spike 前置**：在写任何 schema 之前先证明 macOS 上存在可资格化的
   隔离 provider；不可资格化即启用 declared 档预案，避免发布门挂死。
3. **两项用户裁决出结论**（知识死刑条款、更名时机），避免实施到 P4.8 时再返工。
