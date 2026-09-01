# 业界 Agent 模式对照

> **Status: historical — a source proposal, not a plan.** This is one of the
> independent proposals written before AE v1's design was consolidated. It was
> never the specification, and the specification it fed into has itself since
> been archived. **Nothing here has authority over current work.** The set and
> how each source was judged: [`README.md`](../README.md). The current account of what AE
> is and where it is going: [`rebuild.md`](../../../rebuild.md).

> 为 AE 1.0 做的模式研究 · 2026-08-22
> 每条按：**出处 / 结论 / 与 AE 的关系 / 可能操作**。
> 名词不进入 AE 词汇表——这份是查证用的，不是要 AE 改称呼。

---

## 0. 怎么用这份文件

两个用途：

1. **认领名字**。AE 的机制如果业界已经有名字，就用它去找**已知的失效模式**，而不是自己重新踩。
2. **找反证**。凡是 AE 已经在做、而文献说"这么做没用"的，要么给出本仓的反例，要么改。

---

## 1. AE 机制 ↔ 业界名字

| AE 里的东西 | 业界名字 | 出处 |
|---|---|---|
| Harness Driven Loop（做→验→修→再验） | **Evaluator-Optimizer** | Anthropic 五模式之一 |
| 跨迭代的 findings 比对 + structural-plan-wrong 分类 | **Reflexion**（把反馈转成文字记忆带进下一轮） | Shinn et al. |
| AC coverage 判官 | **LLM-as-a-Judge** | 大量文献 |
| discuss 的 Debate Mode | **Multi-Agent Debate (MAD)** | 大量文献 |
| plan 冻结 AC + 步骤，work 执行 | **Plan-and-Execute** | — |
| work 内部的 edit→test→observe 循环 | **ReAct** | Yao et al. |
| 座位契约（结构化产出） | **structured output / guardrail** | OpenAI Agents SDK |
| 三个门、锚点校验 | **guardrail with tripwire** | 同上 |
| `.ae/knowledge` | **context engineering / episodic memory** | LangChain、Reflexion |
| Cast block | 无直接对应；最接近 **12-factor 之 "own your prompts"** | HumanLayer |

**结论：AE 没有发明任何一个新机制。** 十一条决策全部落在已有模式上。这是好消息——意味着每一条都有现成的失效模式可查。

---

## 2. 循环与自我纠错

### 2.1 LLM 不能靠自己纠正推理

**出处**：[Large Language Models Cannot Self-Correct Reasoning Yet](https://arxiv.org/abs/2310.01798)（Huang et al.）

**结论**（摘要原文）：*"LLMs struggle to self-correct their responses without external feedback, and at times, **their performance even degrades after self-correction**."* 论文定义 **intrinsic self-correction** = 仅凭自身能力纠正，无外部反馈。

配套研究指出瓶颈在**发现错误**而不是改正错误：模型找不到自己推理链里的毛病（[SELF-INCORRECT](https://arxiv.org/pdf/2404.04298)）。

**与 AE 的关系**：这是 D2「仪器和判官不互相替代」的最强外部支撑，而且比我原来的论证硬——我原来的理由是本仓 9/9 的 relay 失真，那是关于转述的；这条是关于**自我纠错本身**的。

它同时是一条**警告**：AE 的 loop 如果只有 LLM 自评（review verdict）而没有外部反馈（退出码），不仅无效，**可能变差**。而 1.4 节记录的现状正是"有效验收 = 一个 LLM 说 pass + 全局测试绿"——半个外部反馈。

**可能操作**：
- 在 `design.md` D2 引这条，替换掉现在纯靠本仓证据的论证
- P0 的"让真值来源活过来"因此不是优化，是**从"可能有害"回到"可能有效"**
- 任何一处 LLM 自评没有外部信号垫底的地方，标为已知有害构造

### 2.2 Reflexion：把反馈写成文字带进下一轮

**出处**：[Reflexion: Language Agents with Verbal Reinforcement Learning](https://arxiv.org/abs/2303.11366)（Shinn et al., NeurIPS 2023）

**结论**：不更新权重，把环境反馈转成文字摘要存进 episodic memory，下一轮作为额外上下文。HumanEval pass@1 **91% vs GPT-4 无反思的 80%**。

**已知限制**（论文自陈）：依赖 LLM 的自评能力或启发式评估器，反馈质量不稳定，**无收敛保证**；且"假设反思步骤产出因果正确的诊断，**当反馈信号是二元 pass/fail 且任务需要多步操作时，这个假设系统性失败**"。

**与 AE 的关系**：F-048 loop 的 `LOOP_FINDINGS` 记录 + 跨迭代比对，就是 Reflexion 的形状。而**AE 的反馈信号恰恰是二元的**（测试绿/红、verdict pass/fail），正落在论文说会系统性失败的那一档。

F-048 的 "findings 跨迭代不变 → structural-plan-wrong / 变化中 → fixable" 分类，其实是 AE 自己摸出来的缓解措施——**给二元信号补一个"是否在收敛"的维度**。

**可能操作**：
- 把这条写进 `design.md`，让那个分类有理论依据而不只是经验
- 考虑让 loop 的反馈**不止二元**：失败时带上"哪条 AC、哪个断言、期望什么实际什么"，这正是 Reflexion 说的 semantic gradient
- 知识层（D6）的写入时机可以对齐 Reflexion：**loop 结束时把"这次学到什么"写进记忆**，而不是靠 agent 主动想起来查

### 2.3 Self-Refine 与 Evaluator-Optimizer

**出处**：[Anthropic · Building Effective AI Agents](https://www.anthropic.com/engineering/building-effective-agents)

**结论**：Evaluator-Optimizer = 一个 LLM 产出、另一个 LLM 评估并给反馈，循环。适用条件是 *"clear evaluation criteria, and iterative refinement provides measurable value"*。

**与 AE 的关系**：这就是 AE 的 loop 的正式名字。**"clear evaluation criteria" 正是 AC 四问要生产的东西**——所以 D1（AC 出生地）不是 AE 的偏好，是这个模式的适用前提。

**可能操作**：`design.md` 第三节把 loop 认领为 Evaluator-Optimizer，并把 AC 四问明确写成"这个模式的前提条件"。

---

## 3. 判官：LLM-as-a-Judge 的三种偏见

**出处**：[Self-Preference Bias in LLM-as-a-Judge](https://arxiv.org/pdf/2410.21819)；综述见 [Weights & Biases](https://wandb.ai/site/articles/exploring-llm-as-a-judge/)、[Deepchecks](https://deepchecks.com/llm-judge-calibration-automated-issues/)

**结论**：三个已测的系统性偏见——

| 偏见 | 内容 |
|---|---|
| **Position bias** | 系统性偏好排在前面的那个。缓解：随机化顺序并对两种顺序取平均 |
| **Verbosity bias** | 偏好更长的回答，与信息量无关 |
| **Self-preference / self-enhancement** | **偏好同一模型家族的产出**；"当判官本身属于被评估的模型集合时，中立性是脆弱的" |

另有一条：判官在**相对比较**上比在**绝对质量评分**上可靠得多。

**与 AE 的关系——这条推翻了我之前的判断。**

我在 D5 里写过："跨家族要证明的是它在 clean context 之上还多给了什么"，并把跨家族的价值定位成"能力路由 + 发散"。**self-preference bias 就是那个"多给的东西"，而且它是被测量过的**：干净上下文消除不了同族偏好，换家族可以。

这给跨家族一个和"能力路由"完全无关的、更硬的理由：**判官位换家族，是为了消除自我偏好，不是为了找个更强的脑子。**

**可能操作**：
- **改写 D5**：跨家族在判官位的理由从"能力路由"改为"**消除 self-preference bias**"，能力路由降为次要
- **E2 实验的假设要改**：原来问"换家族比同族隔离多给了什么"，现在有了预测——**如果被评的产出来自 Claude，Claude 判官会系统性偏袒**。实验设计变成：同一份产出，Claude 判官 vs 非 Claude 判官，看 pass 率差异
- **判官位的输出改成相对比较**：不是"这条证据够不够"（绝对评分），而是"A、B 两份证据哪份更能支撑这条 AC"——文献说这样更可靠
- 判官读到的多份证据要**随机化顺序**（position bias），这是零成本的
- **verbosity bias 是 AE 的现实风险**：AE 的证据 bundle 越长越容易被判"充分"

---

## 4. 多 agent：负面证据比我想的强得多

### 4.1 Multi-Agent Debate 的实测表现

**出处**：[If Multi-Agent Debate is the Answer, What is the Question?](https://arxiv.org/html/2502.08788v1)；[The Cost of Consensus: Isolated Self-Correction Prevails Over Unguided Homogeneous Multi-Agent Debate](https://arxiv.org/html/2605.00914v1)；[ICLR Blogposts 2025 · Multi-LLM-Agents Debate](https://d2jud02ci9yv69.cloudfront.net/2025-04-28-mad-159/blog/mad/)

**结论**：
- **36 组实验（4 模型 × 9 benchmark），现有 MAD 方法没有一个对普通 Chain-of-Thought 取得超过 20% 的胜率**
- MAD 随推理预算增加**不能有效 scale**
- 无引导的辩论相对自我纠错**不值它的 token 成本**；对 7–8B 指令模型，**隔离的自我纠错在成本-准确率上一致更优**
- 失效原因：**纠正旧错误的同时引入新错误**

**但有一个明确的例外**：其中一篇的标题就是 *"Stop Overvaluing Multi-Agent Debate — We Must Rethink Evaluation and **Embrace Model Heterogeneity**"*，另一篇的负面结论明确限定在 **unguided homogeneous** 上。

**与 AE 的关系——方向和初稿写反了，此处为更正。**

AE 的 discuss **本来就是异质的，而且独立先行**，两个条件都满足文献指出的例外：

- `discuss/SKILL.md:157`：跨家族 spawn 是"one per ENABLED ENTRY in `pipeline.yml` 的 `cross_family` 表"；Round 0 编制为 **2 跨家族 + 2 Doodlestein**，跨家族是一等参与者
- `agent-teams/SKILL.md` Debate Mode 的 **Round 1 = "Independent Research (no cross-talk)"**——各自独立读代码、形成立场、只向 TL 汇报，之后才相互挑战

所以文献不是在否定 AE 的设计，而是在**给一个已知缺陷重新定价**：

> **异质是这套多 agent 成立的条件，而这个条件在运行时会被静默拿掉。**

一个跨家族座位没接通 backend，异质辩论就降级成同族辩论——正是 36 组实验里没赢过 CoT 的那一档。降级是静默的：产出形状不变，只有专门追问才会暴露。

而 AE 自己知道这个风险：`discuss/SKILL.md:183` 明写提防 *"same-family output wearing a cross-family [label]"*。

**2026-08-22 的 1.0 试跑里它发生了一次，三条通道全部核实——但成因不是原先以为的那个。**

| 通道 | 结果 |
|---|---|
| agent 自述 | "not-reached，我没有调用任何 Codex MCP 工具" |
| host transcript 的 `tool_use` 序列 | 全部 8 次：Bash×5、SendMessage×2、ToolSearch×1（查的是 `select:SendMessage`）。**codex MCP：0** |
| MCP server 日志 | 该日志确实记录调用（`"Calling MCP tool: codex"`，带运行时长与完成记录）；试跑窗口内**零记录** |

**关键对照——同一天另一个会话里，三个家族的 proxy 全部正常调用了各自 backend：**

```
accum-codex   → mcp__plugin_ae_codex__codex        × 1
accum-gemini  → mcp__plugin_ae_gemini__chat        × 3
accum-qwen    → mcp__plugin_ae_openai-compat__chat × 1
review-codex  → codex × 1        testgen-codex → codex × 1
主会话        → 0 次 MCP 调用（全部经 proxy）
```

**通路是好的，agent 定义也是对的。** 能调的那些第一个动作就是 `ToolSearch(select:mcp__plugin_ae_codex__codex)` 然后调用，而 `codex-proxy.md` 开头两句正是：

> *"Your opinions come from querying Codex, **not from your own analysis**."*
> *"**First action, before reading anything**: your backend tools may arrive deferred… Fetch them:"*

**真正的成因是 spawn prompt。** 试跑那次的 spawn prompt 第二行写着 *"Read these files yourself before answering"*——与定义层的 *"before reading anything"* 直接冲突，且 spawn prompt 赢了；同一份 prompt 的座位契约还写了 *"No prose section, no 'OpenAI perspective' narrative"*，把这个座位存在的理由一并压掉。

**这修正了 BL-212 的诊断。** BL-212 记的是"没有任何 agent 定义写明加载 deferred 工具的步骤"——**定义写了，而且是第一句**。真实的失效模式是：

> **一条与定义层首要动作冲突的 spawn 先导指令，会静默地把跨家族座位降级为同族座位，而产出形状完全看不出区别。**

**可能操作**：
- **修正 BL-212 的诊断**：从"定义缺步骤"改为"spawn prompt 可覆盖定义层首要动作"
- 落 `design.md` D11 的具体形态：**proxy 自检——若在 fetch backend 工具之前就被要求读文件或给结论，拒绝执行并报告冲突**。不需要脚本，由被覆盖的那个 agent 喊出来
- **跨家族座位产出附一句 backend 到达与否的自述**，作为座位契约必填字段——试跑中唯一让降级暴露的手段
- **这是反对削减跨家族 spawn 机制的证据**：那 ~288 行正是用来生成不会犯这种错的 spawn prompt 的；一份手写的 spawn prompt 当场踩中


### 4.2 写单线程 / 读可并行

**出处**：[Cognition · Don't Build Multi-Agents](https://cognition.com/blog/dont-build-multi-agents)、[Multi-Agents: What's Actually Working](https://cognition.com/blog/multi-agents-working)；[LangChain · How and when to build multi-agent systems](https://www.langchain.com/blog/how-and-when-to-build-multi-agent-systems)；[Anthropic · Multi-Agent Research System](https://www.anthropic.com/engineering/multi-agent-research-system)

**结论**：
- 原始原则：*"Actions carry implicit decisions, and conflicting decisions carry bad results."* 冲突的是**隐含决策**，不是文件句柄
- *"multi-agent systems work best today when writes stay single-threaded and the additional agents contribute intelligence rather than actions"*
- Cognition 验证有效的三个模式：**Code-Review Loop**（每 PR 约 2 个 bug、58% 严重，且 reviewer 拥有与 coder 分离的干净上下文时更好）、**Smart Friend**（能力路由，双方都需前沿模型）、**Manager Delegation**（结构化 map-reduce）
- 成本：agent ≈ chat 的 4×，multi-agent ≈ 15×；多 agent 在广度优先研究上强 90.2%，但 *"most coding tasks remain poor fits"*

**与 AE 的关系**：D7 轴一的依据。注意 Code-Review Loop 的成立条件是 **clean context**，而 reviewer 读的是真 PR——**clean ≠ blind**。

**可能操作**：见 `design.md` D7，已落地。

---

## 5. 规划：ReAct / Plan-and-Execute / ReWOO

**出处**：[ReAct vs. Plan-and-Execute 对比](https://atlan.com/know/ai-agent/react-vs-plan-and-execute-agent-architecture/)；[ReWOO 原文](https://arxiv.org/abs/2305.18323)；[LangChain · 3 Years of Graph Engineering](https://www.langchain.com/blog/3-years-of-graph-engineering-with-langgraph)

**结论**：

| 模式 | 形状 | 已知失效 |
|---|---|---|
| **ReAct** | 每次工具调用后重新思考 | 重复推理、目标漂移、原地打转、**一步失败就脱轨**（无主计划可退）；每个 Thought 都是一次 API 调用，慢且贵 |
| **Plan-and-Execute** | 先出完整计划再执行 | **planner 在看到任何工具输出前就承诺**；第 2 步意外，第 3 步已写好且错；重规划贵 |
| **ReWOO** | Planner / Worker / Solver 三段，计划里用占位符，工具并行跑，最后合成 | 只 2 次 LLM 调用，**token 效率 5×**、延迟降 50–70%；代价是完全不看中间观察 |

LangChain 三年回顾：**结构可预测时用图，任务本质 agentic 时强塞进确定性路径是错的**——他们自己的 deep research 从预定义 graph workflow 退回 agentic core loop。

**与 AE 的关系**：AE 前半 Plan-and-Execute、后半 ReAct，两个坑各踩一个。BL-216 记录的 F-082 案例（AC10 追不到决策、Step 8 不在任何 deferred 行）正是 Plan-and-Execute 的典型失效。

**ReWOO 是我之前完全没考虑的一个方向**：AE 的 review 阶段——多个 reviewer 各自跑、最后合成——就是 ReWOO 的 Worker/Solver 形状。若把 review 显式按 ReWOO 组织（planner 先定要查哪几件事 + 占位符，workers 并行取证，solver 合成），可以拿到 5× 的 token 效率，而且它天然是 fan-out，与 D7 一致。

**可能操作**：
- `design.md` D8 的顺序论证可以引 Plan-and-Execute 的已知失效，把"计划是投影不是契约"从主张变成引证
- **新增候选**：review 阶段按 ReWOO 重组，作为 D7 fan-out 的具体实现形态。待评估
- 前半程"让 LLM 自主"引 LangChain 的退回案例

---

## 6. 工程规范

### 6.1 12-Factor Agents

**出处**：[humanlayer/12-factor-agents](https://deepwiki.com/humanlayer/12-factor-agents/3-the-12-factors)（Dex Horthy）

**十二条**：Natural Language to Tool Calls · **Own your prompts** · **Own your context window** · **Tools are structured outputs** · **Unify execution state and business state** · **Launch/Pause/Resume with simple APIs** · **Contact humans with tool calls** · **Own your control flow** · Compact Errors into Context · **Small, Focused Agents**（限制在 3–20 步）· Trigger from anywhere · **Stateless reducer**（`f(events) -> next_action`）

**与 AE 的关系**——逐条对：

| 因子 | AE 现状 |
|---|---|
| Own your prompts | ✅ SKILL.md / agent 定义都是版本管理的源码 |
| Own your context window | ⚠️ review bundle 46KB vs 自陈 10KB 上限 |
| Tools are structured outputs | ⚠️ 座位契约是这个方向，但跨家族仍产出散文（D5 要改） |
| **Unify execution state and business state** | ⚠️ AE 有 `notes.md`、`review.md`、`LOOP_ITER`、trace ndjson **四个并行的状态记录** |
| Launch/Pause/Resume | ⚠️ loop 有 disk-backed 迭代状态（≈checkpointer），但只在后半程 |
| **Contact humans with tool calls** | ❌ 主干上 `plan`/`work`/`review` 零个 `AskUserQuestion`（D3 要改） |
| Own your control flow | ✅ AE 自己拥有 loop，不外包给框架 |
| **Small, Focused Agents（3–20 步）** | ⚠️ AE 的 skill 动辄几十步（`discuss` 10 步 × 每步多轮） |
| Stateless reducer | ❌ AE 的 loop 依赖上下文中的状态 + 磁盘状态混合 |

**可能操作**：
- **"Unify execution state and business state" 是一条 AE 没想过的精简线索**：四个并行状态记录合成一个事件日志，可能一次性削掉可观的 runtime 税，同时让 Launch/Pause/Resume 变简单
- "Contact humans with tool calls" 给 D3 一个具体形态：**中断就是一次工具调用**，而不是流程里的一个阶段
- "Small, Focused Agents 3–20 步"是对 `discuss` 861 行的一个外部判据

### 6.2 OpenAI Agents SDK：guardrail / tripwire / 结构化输出

**出处**：[Guardrails · OpenAI Agents SDK](https://openai.github.io/openai-agents-python/guardrails/)；[Evaluating OpenAI Agents SDK](https://futureagi.com/blog/evaluating-openai-agents-sdk-2026/)

**结论**：
- 三原语：agents / handoffs / guardrails
- guardrail 是一个返回 `tripwire_triggered` 布尔的函数；为真则 Runner 立即抛出并中止
- `output_type` 强制产出为校验过的结构
- **关键警告**：*"SchemaFidelity scores whether the parsed output_type instance carries the **right field values**, not just whether it parsed, because **the structured-output guarantee hides semantic drift inside well-typed fields**."*

**与 AE 的关系**：最后那句是 BL-215 结尾那个发现的**独立行业确认**——本仓测到的是"一个格式完全合规、带真实 span、内容却是编造的 P2"。业界给它起了名字：**semantic drift inside well-typed fields**。

**这一条直接支持 D2 的三明治设计**（仪器 → 判官 → 仪器）：结构化只能保证形状，**内容还得再验一次**。

**可能操作**：
- `design.md` 引这句，把"结构化 relay 挡不住编造"从本仓孤证升级为有名字的已知问题
- 三个门可以认领 **guardrail + tripwire** 这个名字，并借用它的形态：**返回布尔、为真即中止**，而不是产出一段需要人读的报告

---

## 7. 这轮研究推翻或改写了什么

| # | 原来的判断 | 现在 | 依据 |
|---|---|---|---|
| 1 | 跨家族的价值是"能力路由 + 发散"，在判官位上是否优于同族隔离**未知** | **判官位换家族有被测量过的理由：消除 self-preference bias**。干净上下文消除不了同族偏好 | §3 |
| 2 | ~~AE 的辩论是同族的，落在被证伪那档~~ **（初稿断言，已核实为错）** | AE 的 discuss **本来就异质且独立先行**（`discuss/SKILL.md:157`、Debate Mode Round 1）。文献的负面结论限定在 *unguided homogeneous*，AE 两个条件都不属于 | §4.1 |
| 3 | ~~BL-212：agent 定义没写明加载 deferred 工具的步骤~~ **（已核实为错）** | 定义写了且是第一句。真实失效是 **spawn prompt 的先导指令覆盖定义层首要动作**，静默把异质降级为同族。三通道核实见 §4.1 | §4.1 |
| 4 | AE loop 的自评环节是"有待加强" | **无外部反馈的自我纠错可能使表现变差**，不只是无效 | §2.1 |
| 5 | F-048 的"findings 跨迭代比对"是经验做法 | 它是 Reflexion 的形状，**且正好在补 Reflexion 已知的二元反馈失效** | §2.2 |
| 6 | "结构化 relay 挡不住编造"是本仓孤证 | 有名字：**semantic drift inside well-typed fields** | §6.2 |
| 7 | review 的 fan-out 只是编排选择 | **ReWOO 给它一个 5× token 效率的具体形态**，此前未考虑 | §5 |
| 8 | AE 的状态记录是实现细节 | 12-factor 的 **"unify execution and business state"** 指出四个并行状态记录本身是精简线索 | §6.1 |

**其中第 1、3 条合起来改变 D4 和 D5 的方向**：不是"跨家族按需开启以省钱"，而是**"异质是多 agent 成立的前提，所以必须保证它真的发生"**——重点从"要不要开"移到"开了有没有真的接通"。

**一条方法学记录**：本文件初稿断言"AE 的 Debate Mode 是同族辩论"，未读 `discuss/SKILL.md` 即下结论，事实相反。同一次会话中还有一次同类错误（用一次混淆变量的对照去质疑跨家族价值）。两次都是**先有结论、未核对能推翻它的事实**——正是 `design.md` D2 验证义务第一条（"能打开的东西必须打开"）要防的那件事。留在这里作为该义务确有必要的本仓证据。
