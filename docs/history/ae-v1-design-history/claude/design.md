# AE 1.0 设计

> **Status: historical — a source proposal, not a plan.** This is one of the
> independent proposals written before AE v1's design was consolidated. It was
> never the specification, and the specification it fed into has itself since
> been archived. **Nothing here has authority over current work.** The set and
> how each source was judged: [`README.md`](../README.md). The current account of what AE
> is and where it is going: [`rebuild.md`](../../../rebuild.md).

> 草案 · 当前版本 0.14.2 · 2026-08-22
> 根：[`philosophy.md`](philosophy.md)。本文只写**机制**——哲学不重复。
> 主干来源：`../codex/`（只读来源，不再并行维护）。主干细节引它，不复述。
> 实测：[`evidence.md`](evidence.md)　业界坐标：[`patterns.md`](patterns.md)

---

## 0. 这份文档做什么

哲学定了五句和一条棘轮。本文回答：**在 Claude Code 上，这五句各由什么机制承担。**

每一节标注它来自哲学的哪一句，以及**它删掉了什么**。说不出删掉什么的机制不进本文。

---

## 1. 主干：四个核心对象

> 哲学：边界由 Agents 起草、由人确认 · 完成由证据决定

采用 Codex 提案的对象模型，此处只记落地所需的最小形状；字段全集、reducer 归约表、finalize 事务步骤见 `../codex/design.md` §4–§8。

| 对象 | 承担 | 关键约束 |
|---|---|---|
| **Acceptance Contract** | 什么算做完 | 不可变 revision + current pointer；**agent 起草 draft，人确认后才成为 revision**；material change 走 amendment，旧 revision 与旧证据标 superseded 而非删除 |
| **Execution Strategy**（`plan.md`） | 怎么做 | 可自由重排、替换、放弃重做；**引用 AC ID，不复制 AC 内容** |
| **Evidence Ledger** | 事实历史 | append-only；失败不被新成功覆盖；每条事件绑 `contract_digest` + `source_snapshot.manifest_digest`（**不只 HEAD**——同一 commit 下 staged/unstaged/相关 untracked 变化即令旧证据过期） |
| **Gate** | 完成资格 | 只算 `obligation status[] + finalize_eligible`；**retry / ask-human / amend / stop 不进 Gate**，由 `/ae:work` 决定 |

**删掉的**：`plan.md` 兼任验收标准这个双重身份；`notes.md` / `review.md` / `LOOP_ITER` / trace 四份并行状态记录；散落在多个 skill 里的完成判定。

---

## 2. 三种证明模式

> 哲学：完成由证据决定

`command` | `artifact` | `human`。原六种 `verify_by`（unit/integration/e2e/contract/judge/manual）降为 `command` 的 `scope` 元数据——**它们是 test scope，不值得复制六套控制流**。

| 模式 | 谁执行 | 谁判断 | 记什么 |
|---|---|---|---|
| `command` | 确定性进程 | 机械 assertion 关闭 `closure.kind=direct`；需充分性判断时由引用该事件的 judge 关闭 | argv/cwd、退出码、原始 stdout/stderr、执行前后 snapshot digest、attempt |
| `artifact` | — | 隔离上下文 judge，先读契约声明的 source set，再读 artifact | 结构化 verdict；格式无效 / source 不可达 / 缺 receipt → `invalid`/`unavailable`，**不得补写成 pass** |
| `human` | — | 人 | 精确问题、选择、时间、对应 revision 与 AC、是仅确认观察还是授权契约变化 |

**非空洞性的责任在 recipe 自己**：需要证明"至少跑了一个测试"，recipe 必须自带能 fail closed 的筛选或断言。**runner 不猜测试框架**——那是 `KNOWN_PARSERS` 落地即失效的原因。

**多维与地板**：一条 AC 的证明可以是**一组** obligation，不限一条。另有与 AC 内容无关的**地板**——改了代码就适用（无回归、新代码真的执行过、相关层级测试绿），由项目在 `pipeline.yml` 一次性声明，不逐条 AC 重写。

**删掉的**：六套控制流；`KNOWN_PARSERS` 及一切框架枚举；`check-harness.sh` 里 `(unit|integration|e2e|contract)` 那个硬编码正则；"LLM 说 pass 即完成"。

---

## 3. 指令到达层

> 哲学：做法由 Agents 定 · 每一层只能收紧
> **这是主干来源没有的一层，也是本仓两次实测失效的所在。**

`codex-v1` 的威胁模型列了「模型偏离长 prompt」，但没有机制对着它。今天两次降级都发生在**从 spawn prompt 到 agent 的那一段**：一次先导指令与定义层首要动作冲突，一次任务密度把它挤掉。两次产出的形状都与真品无法区分（`evidence.md` §10.3、§10.5）。

### 3.1 两层，按持久性划

| 层 | 内容 | 谁出 | 何时定 |
|---|---|---|---|
| **Agent 定义** | 关注面 · 通用工程领域知识及由它衍生的提问角度 · 输出契约 · 边界 · **断言义务** | AE | 一次，跨任务不变 |
| **Cast** | `Role` / `Angle` / `Why` | TL | 每次 spawn |

**位置规则**：项目特定的事实**只能进 Cast，不能进定义层**。这让"AE 不含项目事实"从自觉变成可检——定义层文件里出现具体项目名或路径即违规（现成违规样本：一个发布脚本硬编码了作者本机某 feature 目录）。

**措辞收窄**：AE 不含**项目事实与业务逻辑**；它可以、并且应该包含**通用工程领域知识**（注入、N+1、循环依赖、竞态）。那正是专门化的价值来源。

### 3.2 Cast 棘轮

> **Cast 可以收窄，不可以放松。**

一句 `Angle: quick sanity check` 事实上就取消了 demonstrate 义务。这不是推测——纪律已被违反过一次，违反者是撰写它的人，且无任何机制发现。

**执行形态**：定义层首要动作被 spawn prompt 覆盖时，**由被覆盖的那个 agent 拒绝执行并报告冲突**。不用脚本。可测——把那份 spawn prompt 原样重跑，看它拒不拒绝。

### 3.3 到达自述与外部证明

跨家族座位的产出**必须以 `BACKEND: reached|not-reached` 开头**，且要求它核对自己的工具调用记录而非猜测。

**但自述不是证明**——那仍是 agent 为自己作证。证明来自 **MCP server 日志与 host transcript**。两者分工：**自述让失败在第一行可见，外部记录让它可证。**

### 3.4 编排两轴

| 轴 | 决定 | 规则 |
|---|---|---|
| **冲突面** | 能不能并行 | 携带「别人必须与之一致」的隐含决策 → 单线程；不携带 → 并行 |
| **交流** | Teams 还是 fan-out | 生成要交流；检查**先各自独立形成结论，再相互挑战**——交流在结果层，不在过程层 |

轴一不是"读/写"：写自己的观察产物无隐含决策（可并行）；改共享代码有（单线程）；跑验证无（并行且更好，因为独立才不共享偏见）。**收窄**：写测试代码要看落点——同一文件、共用 fixture/端口/DB 状态则退回单线程。

**删掉的**：222 行编队配比规则；`check-cast-block.sh` 那类只数字段的格式校验；把 Teams 全套协议用在不需要交流的场合（评审、并行研究、判官、跨家族独立验证——这四类改 fan-out）。

---

## 4. 跨家族

> 哲学：做法由 Agents 定

**不是第二条质量路径，是 harness 上"独立判断"座位的一种供给方式。**

| 位置 | 跨家族供什么 |
|---|---|
| 契约起草（discuss） | 发散——对"业务上什么算对"的另一种理解 |
| 仪器 | 无关（零知识，无家族之分） |
| **判官** | **消除 self-preference bias**——判官系统性偏袒同族产出，隔离上下文消除不了。这是被测量过的理由，与"哪个模型更强"无关 |
| **覆盖守门** | 同上 |

**后果**：跨家族**不再有自己的输出通道**。坐判官位就交 verdict schema，坐守门位就交覆盖缺口。散文只在发散位合法。这把 relay 失真问题**取消**而不是修好——检查侧不产生散文，就没有散文要转述。

**删掉的**：288 行跨家族管道里为"平行路径"而存在的部分（独立契约、relay 格式、TL 综合）；"跨家族默认全开"的成本模型。

---

## 5. 知识

> 哲学：知识让下一次更便宜

主干来源把这层推到 v1 之外。哲学第四句需要它有归宿，故 v1 取**最小形态**：

1. **读命中记录**——这次任务用了库里哪几条。这是判断这层去留的唯一依据，现在值为零（没人在数）。
2. **知识三问**（AE 出题，agent 填）：这件事贵到不该再被发现第二次吗 / 证据是什么 / **它在什么条件下失效**。
3. **供给方向反转**——不是 agent 去查，而是**碰到某文件或符号时系统把已知的坑推给它**。匹配键必须零知识（路径、符号名）：语义查询要求 agent 先知道自己不知道什么，而那正是这层要解决的。

**内容类型的重心是验证手段的教训**，不是架构决策——后者一个 feature 出一条，前者每次失败都出一条，且天然自带失效条件。

**预先写好的删除条件**：**三个月后读命中为零，删掉这一层。**

**删掉的**："图健康"这个假指标（它测写入侧）；`.ae/graph` → `.ae/knowledge`（用户数据，须在 1.0 发布前完成，否则之后要带迁移）。

---

## 6. 职责与棘轮

> 哲学：每一层只能收紧

主干的职责表见 `../codex/design.md` §7。一条硬规则：

> **同一个上下文不能既生成一个 material claim，又成为该 claim 的唯一通过依据。**

棘轮逐层落地：

| 层 | 可以 | 不可以 |
|---|---|---|
| 契约 | 加 AC | 删/弱化 AC |
| 验证手段 | 加维度、把判断升级为可执行检查 | 降级、放宽区间 |
| Cast | 收窄职责 | 解除定义层义务 |
| 计划 | 整份重写 | 重写真值 |

**一处必须分清的界**：棘轮作用在**标准的强度**上，不作用在**范围**上。范围任何方向的变动都要重新确认——"顺手把这个也做了"是范围变动，不是收紧。

---

## 7. 人的确认点

> 哲学：边界由 Agents 起草、由人确认 · 人只在边界上出现

三类，此外不出现：

1. **契约 revision 的确认**（初次锁定与每次 amendment）。**必须可拒绝、可修改**，否则是橡皮图章；放到人面前的是业务口径的生成视图，不是 JSON 与 recipe。
2. **`human` 证明模式**——`auto_pass` 永不覆盖它。
3. **覆盖守门指出一块无 AC 覆盖的需求**——给人的是二选一：补一条 AC，还是确认它不在本次范围内。守门员不能自己选。

**删掉的**：逐阶段确认；`goal.frozen.md` 里那句指向不存在事件的注释。

---

## 8. 保证边界

见 `philosophy.md` §六。一句话：**在受支持的路径上，未经验证的东西不能被包装成"已完成"**；批准的真实性是**流程保证，不是密码学身份**，无宿主凭证时只标 `workflow_attested`。

---

## 9. 与现状的差异

落地时要**删除**的（每一项都有本文某节作为替代）：

| 现状 | 替代 | 本文 |
|---|---|---|
| 六种 `verify_by` 驱动六套控制流 | `command`/`artifact`/`human` | §2 |
| `KNOWN_PARSERS` 与框架枚举 | recipe 自证非空洞 + 退出码 runner | §2 |
| 四份并行状态记录 | 单一 append-only ledger + 可重放 reducer | §1 |
| 222 行编队配比规则 | 编排两轴 | §3.4 |
| 跨家族的独立输出通道 | 座位契约 | §4 |
| 只数字段的格式校验 | 消费方拒绝 | §3.2 |
| "图健康"指标 | 读命中 | §5 |
| 逐阶段确认 | 三类确认点 | §7 |
| 约 27 个形态匹配脚本 | 零知识仪器（6 个）+ 上述替代 | §2 §3 |

**验收这份设计的方式**：删除清单里的每一项都真的被删掉，且被替代物覆盖。**只加不减，就是本文自己反对的东西。**
