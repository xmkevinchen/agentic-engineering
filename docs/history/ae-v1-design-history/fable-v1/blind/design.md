# AE v1 设计 —— 可执行的证明闭环

> 哲学层见 `../../claude/philosophy.md`（五条款＋棘轮，已定稿，不重写）。
> 本文是它的机器化：五条款压缩为**三问两律**——Q1 契约、Q2 证据与门、Q3 知识，
> L1 自证不算数、L2 只紧不松；"Agents 管执行"即自由域声明。同一哲学，两种投影。

---

## 0. 推导起点与设计纪律

用户的三个目标，原话：

1. 保留思想的前提下最大化精简
2. 从业务出发保证 Agents 交付质量
3. 让 Agents 越工作越聪明、越了解项目

本文的设计纪律，防的就是"堆叠材料"这个失效：

- **机制准入**：每个机制必须指认它杀死的那类**实测**失效（README 的 F1–F5）。指认不出的不进 v1。
- **模式准入**（Round 0 用户裁定的硬约束）：一个业界模式落进 AE，必须能**删掉、替换或收紧**
  某个既有位置。只加一层的是嫁接，拒收。
- **删除举证**：每一节末尾说明它删掉现仓的什么。说不出的一节要重写。

---

## 1. 对象模型：四个对象＋一个层

### 1.1 契约（`<feature>/contract.md`）—— Q1 的归属

什么算做完，业务语言，Agents 起草、人确认。**起草读代码的人（agent）最清楚什么可验，
确认担责任的人（人类）最清楚要什么**——两步缺一不可，且起草者不能确认自己起草的东西（L1）。

修订机制：一个文件，逐修订追加，最新在顶。

```markdown
---
revision: 2
confirmed: 2026-08-22 by human      # 确认本身也写入账本(contract_confirm 事件)
---
## r2（变更：AC3 收紧匹配阈值）
### AC1 归档后的 feature 目录不会被任何常驻脚本重建
falsifier: 删除 active/F-08x 后运行全套检查，目录再次出现
mode: command
verify: plugins/ae/tests/run-suite.sh && test ! -d .ae/features/active/F-082-*
scope: regression
floor: knowledge/checks.md#zombie-dirs（若无适用条目写 "none applicable"）
red_at_freeze: no        # 回归类冻结时应绿；新行为类应红——实测须与声明一致
```

AC 模板强迫的是**思考**，不是填表——这是用户"AC 是倒逼"的落点。三个装置：

- **证伪问句**（falsifier）：写不出"什么实测结果能证明它没做到"的 AC 不是 AC，是愿望。
- **AC 预算**：默认 ≤7 条；超出必须在契约头部写明为什么这个 feature 天然更宽。
  守门①同时挑战不足与过量（用户原话："AC 够不够，是不是太多"）。
- **地板槽位**（floor）：起草时必须查 `knowledge/checks.md`，逐条声明适用或不适用——
  知识层的读取命中由此产生（§1.5）。

**删掉了什么**：plan.md 兼任验收标准的双重身份；六值 `verify_by` 的六套控制流（§2）；
"冻结时全红"这类一刀切（red_at_freeze 按条声明——回归 AC 冻结时合法为绿）。

### 1.2 策略（`<feature>/plan.md`）—— 自由域

怎么做、拆几步、开几个 agent、用什么模式。**Agents 自有，随时整份重写，永远不是真值来源。**
本设计对它只有一句话，这句话就是全部设计。

**删掉了什么**：plan 冻结、plan 审批、plan 与验收的一切耦合。

### 1.3 账本（`<feature>/ledger.jsonl`）—— 证据的唯一居所

追加式事件流，哈希链防篡改。每行一个事件：

```json
{"ts":"...","actor":{"seat":"qa-1","model":"sonnet","definition":"ae:workflow:qa"},
 "ac":"AC1","kind":"command_run",
 "payload":{"cmd":"...","exit":0,"output_digest":"...","output_tail":"..."},
 "snapshot":{"head":"b8f6804","manifest_digest":"..."},
 "prev":"<上一事件哈希>","hash":"<本事件哈希>"}
```

事件种类（封闭集）：`command_run` `artifact_recorded` `judgement` `human_ack`
`contract_confirm` `backend_invocation` `floor_change`。

**manifest_digest** 是 M2 的核心：对**工作区实际内容**（含 staged/unstaged/untracked）
取摘要，不是 HEAD。HEAD 相同不代表代码相同——"测试在 X 上过了"而工作区早已不是 X，
是本仓实测过的失效类（F2）。门拒绝 snapshot 不匹配当前工作区的证据。

**删掉了什么**："最后一份漂亮报告"式的验收文档——历史即报告，失败不被覆盖，
状态可从磁盘重放（这同时是 harness loop 断点续跑的前提，与 F-048 的盘上循环同构）。

### 1.4 门（gate）—— 纯代数，v1 仅有的两件盲仪器之一

```
对当前契约修订 rN 的每条 AC:
  证据集 E = ledger 中该 AC 的事件，满足:
             hash 链完整 ∧ snapshot.manifest_digest == 当前工作区摘要
  最新判决 J = E 中最近的 judgement 事件，满足:
             J.actor 与被判证据的产生者 actor 不同源（席位与上下文均不同）
  verdict(AC) = green   若 J 存在且 J=green
              = red     若 J 存在且 J=red
              = unproven 其余一切情形          ← 没跑 ≠ 挂了 ≠ 过了，三值缺一不可
done(rN) ⟺ ∀AC: green
         ∧ 不存在未被 human_ack 覆盖的 floor_change{direction: loosen}
         ∧ rN 有 contract_confirm 事件
```

门**只懂**哈希、相等性、时间序——一个业务名词都不认识。它永远不回答"这条 AC 该不该绿"，
只回答"按记录在案的判决与绑定规则，它现在是什么色"。该不该绿是判官的事（§3）。

**删掉了什么**：F1 失效的全部变体——"检查存在"与"检查跑过"从此是机器可分的两件事
（本 session 已落的 db954b6 是它的雏形）。

### 1.5 知识层（`.ae/knowledge/`）—— Q3 的归属，棘轮的记忆

用户的定义即设计：**把以前人工维护的文档变成 Agents 生成维护；文档是实现的索引；
项目在推进，文档就有用——不需要死刑标准。** 但 v1 给它一个可测的承重角色：

```
.ae/knowledge/
  map.md        实现索引：模块→职责→关键文件（archaeologist 的输出有了固定去处）
  checks.md     验证地板：scope 标签化的最低检查集，只紧不松
  lessons/      每 feature 归档时的教训蒸馏（现有 F-082 归档写盘是雏形，扩展之）
```

接线（没有接线的知识层是堆积，philosophy §四已判"图健康"假指标——测写入侧是错的）：

- **写**：review 抓到的逃逸缺陷、被推翻的判决，归档时凝成 checks.md 新条目或 lessons。
  这是 Reflexion 在 AE 的唯一落点：**验证手段本身随失败演进**。
- **读**：契约模板的 floor 槽位强制查询；守门①检查"查过地板没有"。
- **命中指标**：下一份契约是否引用了它。读取侧命中是唯一健康度，写入侧统计全部废除。
- **棘轮**：checks.md 条目任何人可加可紧；删除或放宽 = `floor_change{loosen}` 事件，
  门要求 human_ack 覆盖（M5）。`.ae/graph` 更名 `.ae/knowledge`（既定决策）。

**删掉了什么**：graph-*.py 八件写入侧机械（§7）；"知识库要不要死刑标准"这个争论本身。

---

## 2. 证明方式：三种，不是六种

六值 `verify_by` 的运行语义只有三类，其余差异是 scope 标签：

| mode | 语义 | 事件由谁写 |
|---|---|---|
| `command` | 进程执行：runner 跑命令，捕获 exit/输出 | **只有 runner**。agent 自己跑了不算证据 |
| `artifact` | 产物存在：路径＋内容摘要入账，判官读内容裁决 | runner 记录，判官判决 |
| `human` | 人回答：陈述入账 | 人（经前台交互），流程保证非密码学（诚实边界，philosophy §六） |

**runner**（v1 第二件盲仪器）：读契约某条 AC → 在 timeout、项目 cwd、净化环境
（无凭证注入）下执行 verify → 写 `command_run` 事件。它知道怎么跑一个字符串并记录，
永远不知道这个字符串是什么意思。

**空证据归判官，不归解析器。** 旧 collect-ac-evidence.py 用 KNOWN_PARSERS 数测例数防
"跑了个寂寞"——但 `cargo test 不匹配任何测试` 退出 0、输出 "0 passed"，是否空洞是**意义
判断**：只有对照 AC 的 falsifier 才能回答"这次运行到底试没试图证伪它"。所以 v1 把空洞
判定写成判官的常设指令（"证据必须显示 falsifier 被实际行使；0 例运行判 unproven 不判
green"），解析器注册表整个删除。机器测量、LLM 判意义——F-065 的原则，这次贯彻到底。

**删掉了什么**：六套 verify_by 控制流；KNOWN_PARSERS 及其"declared≠supported"整个分支；
按测试框架逐个适配解析器这条永远追不完的路。

---

## 3. 判官与证明边界（M3＋M4）—— 本方案实测密度最高的一节

### 3.1 判执分离（M3）

- 判官是**独立席位、新鲜上下文**：不是执行 agent 的自我检查，不共享其会话。
- 门用 actor 字段机械校验"判决者≠证据产生者"；判官**读什么**受限：AC＋该 AC 的证据
  ＋必要的代码，不读执行过程的叙事（叙事是说服，证据才是输入）。
- 已知残余（本 session Codex 交叉评审发现，如实记录）：判官的量尺来自同一份契约——
  它验"证据满足 AC"，验不出"AC＋验证手段合谋把问题定义窄了"。这个洞由**守门①**补：
  充分性挑战发生在契约冻结前、由跨家族席执行，问的是四件事——AC 够不够 / 是不是太多 /
  覆盖没覆盖真实业务 / 别的家族会不会想到别的重点（用户原话的四问）。
- **两个守门员分工**（用户定式）：守门①（discuss）保证业务需求被正确理解；
  守门②（review）保证被确定的需求被合格验收。challenger 的终局角色在守门①：
  挑战 AC 本身正确性的最后一道关卡。

### 3.2 证明边界（M4）：自述与见证是两个世界

本 session 的核心实测（evidence E1–E4）：一个跨家族席可以**读对文件、产出全场最深的
发现、形状与真品无法区分——而从未调用 backend**。因此：

- **两级断言**：`workflow_attested`（agent 自述，含 BACKEND 首行）与 `host_verified`
  （宿主核对 MCP 服务日志后写入的 `backend_invocation` 事件）。
- **标签规则**：产出要挂"跨家族"标签，必须 host_verified。只有自述的降为
  `workflow_attested`，门在 done 汇总里如实标注 degraded，是否接受由人决定。
- **席位合同**（run-2 实测有效）：首行 `BACKEND: reached|not-reached`；not-reached 时
  FINDINGS 必须留空——宁可空手，不可代笔。同族输出戴异族标签，比没有异族更糟。
- **席位规格含模型档位**：同一合同、同一位置，sonnet 服从、haiku 被任务密度挤掉首要
  动作（run-2 实测）。模型档位是席位规格的一部分，不是实现细节。
- **投放层（cast）在可信基内**：spawn prompt 能覆盖定义层首要动作（run-1 实测），
  所以 cast block 不是提示技巧，是合同载体；其"只可收窄不可解除定义层义务"受棘轮约束。

### 3.3 跨家族的位置：按席位，不按全局

self-preference bias 有测量支撑的位置是**判官位**；讨论位的跨家族只是发散加成。
pipeline.yml 的 `cross_family:` 平表保留（它管"有哪些家族可用"），新增按位使用策略：

```yaml
cross_family_seats:
  adequacy: required    # 守门①充分性挑战：有可达异族则必须
  judge:    required    # 守门②判官位：同上
  debate:   optional    # 讨论位：默认关，按需开
# required 而无家族可达 → 事件记 degraded，人裁决是否继续
```

**删掉了什么**：跨家族全局开关的一刀切成本；"reviewer 数量代表质量"的隐含前提；
BL-212 的误诊路径（定义没坏，投放层坏了——修 prompt 纪律，不重写定义）。

---

## 4. 人的接口

必然出现两次：**确认契约 rN**（含每次边界变更）与**终验收**。
异常出现四种：松绑信封（M5）、`human` mode 的 AC、判决争议升级、范围变更
（棘轮只作用于强度，任何方向的范围变动都要重新确认——philosophy 的界）。

确认必须**可拒绝、可修改**，且放到人面前的是业务高度的 AC，不是 recipe——看不懂的
东西无法被拒绝，只能被橡皮图章。批准的真实性照实说：宿主没有"这句来自人类"的可验证
凭证，人的批准是流程保证（philosophy §六），说不清这一点就会在最不该含糊的地方含糊。

**删掉了什么**：逐阶段审批；plan 确认；"零打断=信任"的错觉（零打断和十次无效打断在
"人不在环里"上等价）。

---

## 5. 闭环与阶段动词

阶段名是入口与心智模型，不是本体（philosophy §五）。v1 的动词映射：

- **analyze**（可选）：ReWOO 落点——planner＋占位符＋并行 worker＋solver 匹配"并行
  研究"，产出喂给 discuss。它**不**落在 review：评审是"看了代码才知道下一步"的
  串行判断，占位符结构不成立（讨论 001 topic-03 的结论方向）。
- **discuss**：产出契约草案＋守门①。Round 0 机制保留（framing 冻结、外部证据采信——
  它在本 session 抓住过真问题）。
- **plan**：自由域。
- **work**：F-048 盘上 harness loop 原样保留（它已是"状态在盘上、断点可续"的正确形状），
  接线只有一处：verify 一律经 runner 走账本。Evaluator-Optimizer 即 work 内 QA 微环，
  已存在，归位不新增。
- **review**：判官逐条 → 门代数 → 守门②。
- **归档**：知识写入（§1.5）＋地板收紧。

**12-factor "small focused agents (3–20 步)" 的处置**（讨论 001 topic-05）：该规则约束
的是执行 agent；discuss（861 行）是 TL 编排协议，其每一轮都落盘、可从盘恢复——补偿
控制已在。v1 承认违反、豁免拆分：拆成微 skill 会把一次上下文风险换成 N 次交接风险，
而 MAD 证据（36 配置无一稳定优于 CoT）警告"更多 agent ≠ 更好"。豁免的代价要付：
861/756/595 行的 skill 按 Fable 迁移指南的实测结论（"为旧模型写的过度规定性 prompt
**降低**新模型输出质量"）做去规定性瘦身——步骤描述降为目标＋约束＋检查点，见 plan P5。

---

## 6. 模式判决表

准入判据：必须删掉/替换/收紧某处。逐一判决：

| 模式 | 判决 | 它删/换/紧了什么 |
|---|---|---|
| ReWOO | 收进 analyze | 换掉串行研究的上下文占用与逐步依赖 |
| Reflexion | 收进 checks.md 演进 | 换掉"验证手段一次设计定终身"；紧了地板 |
| Evaluator-Optimizer | 归位 work QA 微环 | 已存在；命名归位，删掉重复引入的诱惑 |
| LLM-as-Judge + self-preference | 收进 §3.3 按位跨家族 | 删掉全局开关；紧了判官位要求 |
| Multi-Agent Debate | **拒收**（不新增任何辩论位） | 36 配置无稳定增益；已有 discuss 辩论不扩张 |
| Plan-and-Execute | 已是 plan→work 本身 | 无需引入；防止当新词再买一次 |
| guardrail/tripwire | 已是门＋盲检查 | 同上 |
| 12-factor small agents | 执行 agent 适用；discuss 豁免（§5） | 紧了执行 agent 的定义纪律 |

---

## 7. 盲仪器宪法与死刑名单

**宪法**：机械件只许懂形式（退出码、摘要、哈希、相等性、schema 形状、环境探测），
不许懂内容（业务名词、特性路径、解析器名单、项目结构假设）。理由是实测的：脚本的
过时速度正比于它编码的项目知识量；懂内容的检查在项目前进的瞬间开始说谎。

已确证违宪（本 session 亲读/实测，案卷在 evidence.md）：

1. **check-proxy-residual.sh** —— L30 硬编码 `active/F-082-...`；feature 已归档，脚本
   每次运行**重建僵尸目录**（今日实测 `active/F-082/trim-baseline/` 三个快照仍在）；
   基线被删后 L82-87 重拍基线自比对，vacuous pass。一个特性级实验被固化成常驻检查——
   这不是这个脚本写坏了，是这**类**脚本必然的结局。处置：删除；其中形式级的部分
   （frontmatter 工具声明 vs 正文引用一致性）若要保留，改写为不含特性路径的通用检查。
2. **collect-ac-evidence.py** —— KNOWN_PARSERS 能力名单；实测存在 cmd exit 127 而脚本
   exit 0 的路径。处置：runner 取代，解析器概念删除（§2）。
3. **graph-\*.py ×8** —— 写入侧健康度，测的方向就是错的（§1.5）。处置：删除，
   替代物是归档时判官对知识层的 lint（LLM 判，非脚本判）。

合宪示例（保留）：check-agent-teams.sh（环境探测＝形式）、jargon-tripwire（形式级
文本判据，CLAUDE.md 明列）、run-suite 骨架。其余 38−上述 按宪法在 P5 逐一过堂——
**未亲读的不预判死刑**，只立判据与程序。

---

## 8. 安全边界（正面处置，不再是被评审指出的洞）

Agent 起草的 verify 命令**就是代码执行**。v1 的决定：

- **不造假沙箱**。CC 的 bash 本就以用户权限无沙箱运行；AE 在其上宣称隔离是谎言，
  谎称安全比没有安全更糟。
- 真实缓解三件：①verify 命令字符串冻结在**人确认过的契约修订**里——人看见过每一条
  会被 runner 执行的命令；②runner 强制 timeout＋项目 cwd＋环境净化（不继承凭证类
  变量）；③命令变更＝契约修订＝重新过人。
- **残余风险明写**：网络未封禁；文件系统权限＝当前用户权限；恶意但通过人眼的命令
  防不住。这与 philosophy §六"AE 不是安全沙箱"同一条诚实边界。

---

## 9. 与现仓的接续

v1 不是推倒重来——本 session 已有三笔提交是 M1/M4 的雏形：db954b6（存在的检查必须是
跑过的检查）、921c841（findings 合同只校验不修补）、7fbc4b0（问归档 backend 是否可达）。
F-065"machines measure, LLM judges"是 M3 的先声。**v1 做的是把散在 38 个脚本、
24 个 skill 里的同一个直觉，收敛成四个对象＋一个层＋两件盲仪器，然后把不再承重的
部分删掉。** 精简不是目标函数外加的约束，是收敛的自然结果。
