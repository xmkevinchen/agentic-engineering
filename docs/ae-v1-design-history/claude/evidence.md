# AE 1.0 · 证据附录

> 基线 v0.14.2 · 2026-08-22
> 本文件只放事实与出处，不做主张。主张在 `design.md`。
> 未经本仓实测的引用（业界调研）单独标在 §5。

---

## §1 诊断的三处取证

支撑 `design.md` §一「一个 agent 声称某事为真，而没有任何东西去核对」。

### 1.1 验收通道从落地起就没成功执行过

`plugins/ae/scripts/collect-ac-evidence.py:34`：

```python
KNOWN_PARSERS = ("cargo-test.v1", "pytest.v1", "sh-tap.v1")
```

三个硬编码字符串。三个叠加的原因导致它对每一条 AC 返回 collector-integrity-failure：

1. markdown backtick 未剥离 → 实际执行 `` `sh … `` → exit 127
2. 剥离后 parser 被推断为 `sh`，不在上面的元组里
3. 本仓没有任何 feature 声明过 `exit_code_only: true`

这条通道是 `/ae:review` Check 7 判断"证据是否空洞"的依据，也是 F-049 隔离判官的输入来源。两者一起失效。

### 1.2 唯一的自检器豁免了最该检的对象

`check-declared-vs-effective.sh` 存在、在标准套件里（`ae-run-tests.sh:29`）、跑出来是绿的：

```
  ok    manifest single-source       6 assertion(s) agreed
  ok    declared tools + probes      15 assertion(s) agreed
  ok    exempt, with a reason        check-harness.sh          ←
  ...
[declared-vs-effective] every pair evaluated and agreed
```

声明与生效的比对器，把验收本身列为豁免。

### 1.3 一个发布出去的脚本硬编码了作者本机的目录

`plugins/ae/scripts/check-proxy-residual.sh:30`：

```sh
FEATURE="$REPO/.ae/features/active/F-082-agent-orchestration-conventions"
BASELINE="$FEATURE/trim-baseline"
```

四层：

1. **路径已死**：F-082 的 `index.md` 记 `done: 2026-08-22`，已 mv 到 `.ae/features/done/`。
2. **缺失分支是静默自愈**（`:82-87`）：baseline 目录不在 → `mkdir -p` + 拷贝当前 proxy 定义作为新基线 → 打印 `[residual] baseline captured … (first run)` → 继续。**于是它拿当前文件和当前文件自己比，永远报零缩减。** `trim-baseline/` 三个文件的时间戳是 `2026-08-22 13:54`，正是归档当天——目录是被脚本重建出来的。
3. **重建出的残留使 `active/` 非空**：`/ae:dashboard` 从 `.ae/features/active/*/index.md` 读，这个目录没有 `index.md`；同时它的存在让「active 为空」的 empty-state 提示永远不会触发，尽管实际有 0 个进行中的 feature。
4. **自检器放行**：`check-declared-vs-effective.sh` 对它的判定是 `feature-scoped lint — feature state absent; not applicable here`。

它同时还在 grep 一句英文：

```sh
'not a paraphrase of'
```

### 1.4 主干上没有人类确认点

```
grep -rln 'AskUserQuestion\|ExitPlanMode\|EnterPlanMode' plugins/ae/skills/
→ next · roadmap · setup · agent-selection · analyze · discuss
```

`plan` / `work` / `review` 三个都不在命中里。而 `/ae:review` Check 7 描述 `goal.frozen.md` 为 "the immutable acceptance standard written at **plan-approval**"——一个 `plan` 从不执行的事件。

### 1.5 执行者可以自行豁免自己的验收标准

`/ae:review` Check 7 的 WAIVED AC 分支：reviewer 须 grep `<milestone-dir>/notes.md` 里的 `WAIVED_AC <AC-id>: <reason>`，存在即接受豁免。**这一行由执行者自己写。** review 检查的是它在不在，不是它该不该。

---

## §2 LLM 检查 LLM 的实测失败率

来源：BL-215（F-082 Step 8 relay 审计）。

- **9 次采样，9 次失败**，其中 3 次 blocking
- **32 处 hedge 被删**，出现在 9 次里的 8 次——审计称其为"最一致的缺陷"
- backend 归属声明中 **20% 无支撑**，1.4% 完全无据
- 加入的跨家族声明有方向性：对另一家族的批评能穿过 relay，给它的肯定被丢弃
- **最好的一次采样，是在审计当天、在修完该 feature 所有已知缺陷的树上跑出来的**

BL-215 自己的结论：结构化 relay 也堵不住——"唯一两次抓住它的，都是有人拿声明去比对了代码"。

### 2.1 输入通道的对照（BL-216 第 4 条）

同一个任务，两个 reviewer：

| | 输入 | 是否被要求 demonstrate | 结果 |
|---|---|---|---|
| A | 真文件 | 是 | 建复现树、跑脚本、改脚本确认测试能抓到回退、扫 118 份真实 transcript；每条 finding 可复现；找到最严重的缺陷 |
| B | 散文转述 | 否 | 报了一个在 3395 个事件里出现 **0 次**的格式的 P1，附最小复现输入 |

BL-216 原文：这两个条件都由 spawn 它的 skill 设定，**哪一条都没有在任何地方被要求**；产出 A 的那条指令是临时手写进一个 prompt 的。

**注意**：A 与 B 还同时在"是否跨家族"上不同（B 经 proxy）。**这是一次混淆变量的比较，不能用它判家族差异。** BL-211 对同类实验也写明："a directly observed occurrence worth reproducing under blind conditions, not a measured rate."

---

## §3 体量与分布

### 3.1 总量

```
24 个 skill，SKILL.md 共 8214 行
19 个 agent，1993 行
35 个运行期脚本，~65 个测试脚本
```

### 3.2 三类分布（按文件）

| 类 | skill | 行数 |
|---|---|---|
| **思想** | analyze 400 · discuss 861 · plan 393 · work 595 · review 756 · backlog 71 · retrospect 209 | **3285**（40%） |
| **工具** | dashboard 237 · status 136 · next 245 · roadmap 365 · plugin-stats 204 · think 176 · trace 156 · testgen 125 · consensus 296 · team 134 · code-review 269 · plan-review 168 | **2511**（31%） |
| **runtime 税** | agent-teams 781 · agent-selection 375 · setup 555 · test-plugin 406 · knowledge-refresh 301 | **2418**（29%） |

3285 + 2511 + 2418 = 8214 ✓

**已知不精确**：分类按文件划，而税混在思想文件里（`discuss` 861 行归入思想，其中轮次管理、批量评分、deferred 逐项裁决、team 生命周期是税）；反过来 `agent-teams` 归入税，但其中约 200 行的三个 mode 是思想。**真实的税高于 29%。** 按 section 重切是 `plan.md` 2.1。

### 3.3 agent-teams + agent-selection 的 1156 行

| 用途 | 行数 |
|---|---|
| 多 agent 提升讨论质量的机制本身（Debate / Discussion / Investigation 三个 mode + Groupthink Prevention + UAG） | ~200 |
| 跨家族管道（proxy 契约、backend 路由、deferred 工具加载、超时、TL fallback、attestation、relay 格式） | ~288 |
| 通信 / 生命周期机械（Cast block 语法、必填 `Agent()` 字段、lateral comm、trace emission、shutdown 握手） | ~150 |
| 选择规则（`agent-selection` `## Rules`） | ~222 |
| 进度面板管理（`Skill step progress tracking`，与多 agent 无关，错位在此文件） | ~114 |

### 3.4 脚本分档

**零知识仪器（6）**：`loop-decide`（`(verdict, iter, cap) → action`，纯算术）· `verify-contract`（执行别人声明的 jq 断言）· `check-relay-attestation`（backend 是否被调用）· `check-family-reachability` · `probe-manifest-precedence` · `next-bl-id`

**本该是仪器却写成形态匹配器（1）**：`collect-ac-evidence.py`

**形态匹配器（~27）**：`check-cast-block`（grep `"Angle:"`）· `check-shutdown-canonical`（grep `"shutdown_response"`）· `check-proxy-residual`（grep 英文句）· `proxy-dup-sentences` · `check-harness`（awk 匹配行形态）· `validate-feature-frontmatter` · `validate-trace` · `risk-floor-lenses` · `cross-family-counter` · `check-agent-teams` · `check-cross-family` · `parse-review-verdict` · `check-declared-vs-effective` · `ae-test-plugin-regression-layer1` · `read-family-table` · 4 个 trace 管道 · 8 个 graph-*

---

## §4 知识层现状

`graph-writeback-health.py` 实际输出：

```
[writeback-health] queries: 19 (yes: 3, no: 16, undisposed: 0, yes-rate: 15%)
                   by skill: analyze 6(y2/n4) · discuss 4(y0/n4) · plan 5(y1/n4) · review 4(y0/n4)
[writeback-health] accepted edges by source: lint: 0, untagged: 27, writeback: 0
[writeback-health] rejected proposals by source: untagged: 5
[writeback-health] locate-step invocations in traces: 11 vs query records: 19 (gap: -8)
```

两点：

1. **write-back 路径接受的边是 0。** 六个 skill 被要求执行的 write-back forcing function，产出零条被接受的边；全部 27 条来自未标记来源。
2. **测的全是写入侧处置**——"这次查询要不要写点东西下来"。没有任何指标记录读取侧收益（这次任务用了知识库里的哪几条、省掉了什么）。

`.ae/graph/` 现有内容：`log.md`（93 行）、`index.md`、5 个 `synthesis/syn-*.md`、`themes/`、`archive/`。

---

## §5 业界调研（外部来源，非本仓实测）

### 5.1 Claude Code 自身架构

Claude Code 是单线程主循环（`while(tool_call)`），**没有 DAG、没有 classifier、没有 RAG**，8 个核心工具，刻意用可调试性和透明度换掉多 agent 编排。
→ [ZenML LLMOps Database](https://www.zenml.io/llmops-database/claude-code-agent-architecture-single-threaded-master-loop-for-autonomous-coding)

### 5.2 Anthropic：workflow 与 agent 的划分

*"Workflows are systems where LLMs and tools are orchestrated through **predefined code paths**."* 对应的 agent 是"LLM 自主导向其过程与工具使用"。五个 workflow 模式：Prompt Chaining · Routing · Parallelization · Orchestrator-Workers · Evaluator-Optimizer。指导原则是从最简单的方案开始，只在简单方案被证明不够时才增加复杂度。
→ [Building Effective AI Agents](https://www.anthropic.com/engineering/building-effective-agents)

**对 AE 的意义**：是 code paths，不是 prose paths。散文协议既没有确定性代码路径的可靠性，也没有 LLM 自主的适应性。

### 5.3 多 agent 的成本与适用边界

- agent ≈ chat 的 **4×** token；multi-agent ≈ **15×**
- 多 agent（Opus 4 lead + Sonnet 4 subagents）比单 agent Opus 4 强 **90.2%**——**但那是广度优先的研究任务**
- 明确点名不适用："domains requiring shared context across all agents or heavy inter-agent dependencies—**like most coding tasks**—remain poor fits"
→ [Multi-Agent Research System](https://www.anthropic.com/engineering/multi-agent-research-system)

### 5.4 并行的真实约束是「冲突的隐含决策」

**原始原则**（Cognition 两条原则之二）：*"Actions carry implicit decisions, and conflicting decisions carry bad results."* 其 Flappy Bird 例子里冲突的是**画风**——两个 subagent 各自做了一个对方看不见、却必须与之一致的决策。冲突面不是文件句柄。

**"读可并行、写要单线程"是这条原则的有损代理**，是二手来源的压缩表述。它对三类动作会误判：agent 写自己的观察产物（在写，但无隐含决策，可并行）；跑验证（产出是发现与证据，可并行且并行更好）；改共享代码（真正需要单线程的那一类）。`design.md` D7 轴一采用原始原则，不采用读/写代理。

| 来源 | 表述 |
|---|---|
| Cognition | *"multi-agent systems work best today when **writes stay single-threaded** and the additional agents contribute **intelligence rather than actions**"*；只读 subagent 类似工具调用，安全 |
| LangChain | *"Read actions are inherently more parallelizable than write actions"*；写冲突后果远比读冲突严重 |
| Anthropic | 适合独立方向的广度探索，不适合共享上下文 / 强依赖 |

→ [Cognition: Multi-Agents What's Actually Working](https://cognition.com/blog/multi-agents-working) · [Cognition: Don't Build Multi-Agents](https://cognition.com/blog/dont-build-multi-agents) · [LangChain: How and when to build multi-agent systems](https://www.langchain.com/blog/how-and-when-to-build-multi-agent-systems)

### 5.5 Cognition 验证有效的三个模式

1. **Code-Review Loop**：独立 review agent 每个 PR 抓约 2 个 bug，58% 为严重；**且 reviewer 拥有与 coder 分离的干净上下文时效果更好**（避免共享偏见与 context rot）。注意 reviewer 读的是真 PR——**clean ≠ blind**。
2. **Smart Friend**：主模型配更强模型咨询，成立条件是 *"capability-routing rather than difficulty-escalation"*，且双方都得是前沿模型。
3. **Manager Delegation**：结构化 map-reduce，而非无结构 swarm。

### 5.6 ReAct 与 Plan-and-Execute 的失败模式

| 架构 | 失败模式 |
|---|---|
| ReAct | 重复推理、目标漂移、原地打转、一步失败即脱轨（无主计划可退回） |
| Plan-and-Execute | planner 在看到任何工具输出前就承诺；第 2 步一意外，第 3 步已写好且是错的；重规划成本高 |

→ [ReAct vs. Plan-and-Execute](https://atlan.com/know/ai-agent/react-vs-plan-and-execute-agent-architecture/)

### 5.7 LangGraph 的持久化与中断

每个 superstep 的状态落盘、按 thread 组织，支持恢复、时间旅行、HITL；`interrupt` 暂停执行、持久化状态、从同一 checkpoint 精确恢复——**HITL 是一等特性而非变通**。
→ [Durable execution](https://docs.langchain.com/oss/python/langgraph/durable-execution)

**对 AE 的意义**：F-048 的 disk-backed 迭代状态就是 checkpointer，升级点就是 interrupt。AE 已有这两个原语，缺的是**均匀性**——只在后半程有。

### 5.8 何时用图、何时不用

LangChain 三年 graph engineering 回顾：结构可预测时用 graph；任务本质上 agentic 时强塞进确定性路径是错的——他们自己的 deep research 从预定义 graph workflow **退回**到 agentic core loop，GPT Researcher 做了同样的转向。
→ [3 Years of Graph Engineering with LangGraph](https://www.langchain.com/blog/3-years-of-graph-engineering-with-langgraph)

**对 AE 的意义**：前半程（analyze→discuss→plan）是探索性的，应让 LLM 自主；后半程（work→verify→fix）结构可预测，用确定性骨架。即前半 ReAct、后半确定性循环。

### 5.9 agent harness 的形式定义

四个充要条件：T1 agent loop（reasoning/action/observation）· T2 tool interface · T3 context management · **T4 至少一个独立于模型的控制机制**。缺任一条即落入 generator / isolated SDK / naive wrapper / **demo without guarantees**。区分 agent harness（acts during）与 evaluation harness（acts after）。
→ [What makes a harness a harness](https://arxiv.org/html/2606.10106)

**对 AE 的意义**：T4 被列为必要条件——"独立于模型的控制机制"不是 AE 的自选动作，是这个领域独立收敛到的必需品。

### 5.10 AE 可用的代码面

| 代码面 | 现状 | 约束 |
|---|---|---|
| MCP server | AE 已在用（gemini、openai-compat，TypeScript） | 无 opt-in 门槛；保留逐工具调用记录（BL-212 靠它抓到问题） |
| 脚本 + Bash | 35 个 | 只适合零知识的事 |
| Claude Code Workflow 工具 | 已存在：`script` 收 JS，`agent()` / `pipeline()` / `parallel()`，JSON Schema 在 tool-call 层强制 | **要求用户显式 opt-in**，只能是重活的可选加速器，不能作为默认底座 |

---

## §6 相关 backlog 条目

| ID | 主题 |
|---|---|
| BL-211 | agent 定义里的自传式举例给了模型一个模板去匹配；被 prime 的 proxy 制造出源材料里不存在的比较 |
| BL-213 | 一个方案因为它被引用的理由被证伪而遭裁撤，从未按自身价值评估过；guard 无后继导致决策"散文里采纳、实践中失效" |
| BL-215 | prose relay 的审计（本文件 §2） |
| BL-216 | harness 从未按它施加于别人的标准检查过自己（本文件 §1） |

---

## §7 Cast 层（支撑 D9 / D11）

`agent-teams/SKILL.md` § Cast Block Syntax 的要点：

- **四个字段全部强制**：`Agent` / `Role` / `Angle` / `Why`
- **双写**：stdout（用户可见）+ 嵌入 spawn prompt 的 `prompt:` 字段（agent 可收）
- **位置**：有 PRIMARY CONTEXT BUNDLE 时在 position 2（bundle 之后、任务指令之前）
- **成本目标**：≤200–300 token、≤8 行（目标非硬限）
- **机械验证**：`grep -c "📋 Cast:"` 数数量；`grep -cE "^\s*(Role|Angle|Why):"` 数字段——**只验格式，不验内容**

**设计理由（原文）**：*"agents stay generic; routing/role is delivered via cast block in spawn prompt at spawn time."* 这是针对 "Routing lateral" 反模式（禁止 agent `.md` 内含条件路由逻辑）的正面模式。

**`challenger.md` 是迁移参考，且迁移是真做了的**：其 `## Mode-conditional behavior` 段落只是一个指针——"mode 从 cast 的 `Role:` 来，协议步骤由 spawning skill 嵌入，不在本文件"——不是残留的模式分支。此处**未发现 declared-vs-effective 缺口**。

## §8 守门员现状（支撑 D10）

触发点实测：

| 调用方 | 守门员 |
|---|---|
| `discuss` Step 9（post-conclusion） | 4 个 doodlestein |
| `plan` Step 4 | **3 个**（strategic / adversarial / regret，**无 scope-reducer**） |
| `review` | **无** |

两处错位：`review` 一个门都没有；`plan` 唯独缺 SUBTRACT，而 plan 正是范围膨胀的落点。

四个 doodlestein 的规模与成熟度差异：`adversarial` 33 行、`regret` 33 行、`strategic` 34 行（均只有 Task/Instructions/Shutdown）；`scope-reducer` 94 行，含 Empirical anchor 与硬规则 *"If you cannot quote the specific clause that breaks if removed, reclassify the mechanism as Defer."*

## §9 agent 名册结构（支撑 D9）

19 个 agent、1993 行。`## 🧠 Your Identity` 出现在 **12** 个里；`What you've seen` 出现在 **10** 个里（三个 proxy 已按 BL-211 修掉）。

新旧两批结构不同：旧式为 Identity → What you've seen → Critical Rules → Checklist → Output Format → Worked Examples；新式（三个 proxy + `scope-reducer`）为 先做什么 → HARD GATE → 断言前必须证明什么。

四个 review/* 各约 108–126 行，其中 Output Format / Report 模板 / Nit cap / Team Communication Protocol 为四者共用样板，真正角色特化的约 20–30 行。


---

## §10 1.0 试跑实测（2026-08-22）

用 1.0 的设计（fan-out 座位 + 座位契约 + 事后相互挑战）评审 `plan.md` 本身。三个座位：判官位（阶段退出条件是否足以证明该阶段主张）、守门位（三目标 × 十一决策 ↔ 工作项，双向覆盖）、跨家族位（优先级与盲点）。

### 10.1 产出

约 38 条 finding，全部带 file:line。抽查 9 条引用，**全部成立**。与 TL 独立通读得出的 7 条比对，三处独立收敛：基线污染、0.4 无验收、跨阶段依赖。

**四遍都是 Claude**（跨家族座位未接通，见 10.3），故这是同族内收敛，不构成跨族验证。

### 10.2 后台座位的产出不自动回流

三个座位完成后进 idle，**产出全部滞留**；TL 第一次索取（"deliver your output"）不足，需明确"用 SendMessage 发给 main，纯文本我看不到"才拿到。

→ 反证 `plan.md` 初稿"通信机械 150 行可压到 60 行"的估计。

### 10.3 跨家族座位未达 backend——三通道核实

| 通道 | 结果 |
|---|---|
| agent 自述 | not-reached |
| host transcript `tool_use` 序列 | Bash×5、SendMessage×2、ToolSearch×1（`select:SendMessage`）。**codex MCP：0** |
| MCP server 日志 | 该日志记录调用（`"Calling MCP tool: codex"` + 时长 + 完成）；试跑窗口内零记录 |

**对照组**（同日另一会话 `f23ea6b6`）：

```
accum-codex   → mcp__plugin_ae_codex__codex        × 1
accum-gemini  → mcp__plugin_ae_gemini__chat        × 3
accum-qwen    → mcp__plugin_ae_openai-compat__chat × 1
review-codex  → codex × 1     testgen-codex → codex × 1
主会话        → 0 次 MCP 调用
```

能调用的 proxy，工具序列均为：`ToolSearch(select:mcp__plugin_ae_codex__codex)` → 调用 → `ToolSearch(select:SendMessage)` → 发送。

**成因**：`codex-proxy.md` 定义首句为 *"First action, before reading anything: … Fetch them"*，而试跑的手写 spawn prompt 第二行为 *"Read these files yourself before answering"*，先导指令冲突且 spawn prompt 胜出；座位契约中的 *"No 'OpenAI perspective' narrative"* 进一步压掉该座位的存在理由。

**这修正 BL-212 的诊断**：定义层写了加载步骤且在首句；真实失效是 spawn prompt 可覆盖定义层首要动作，且降级是静默的。

**唯一让其暴露的**：spawn prompt 里一句"核对你自己的工具调用记录，不要猜"。

### 10.4 方法学记录

同一次会话中，TL 两次在未核对可推翻事实的情况下下结论：(a) 用一次混淆变量的对照质疑跨家族价值；(b) 未读 `discuss/SKILL.md` 即断言其 Debate Mode 为同族辩论（事实相反，见 `patterns.md` §4.1）。两次均由后续核查更正。

留档作为 `design.md` D2「验证义务第一条：能打开的东西必须打开」确有必要的本仓证据——违反者是撰写该条目的人。

### 10.5 第二次跨家族试跑：同一失效再现，但**检测机制生效了**

修正 spawn prompt 后重跑（去掉与定义层 "First action" 冲突的先导指令，明写 "Nothing in this prompt overrides it"，并把 `BACKEND: reached|not-reached` 定为输出第一行）。派出两个座位。

| 座位 | 模型 | 工具序列 | 到达 backend |
|---|---|---|---|
| `xf-codex` | **sonnet** | Bash·Bash·Read·**ToolSearch(select:mcp__plugin_ae_codex__codex,…)**·Read·Read·Read·**codex** | **是**（回执 `call ok`，threadId 有值） |
| `xf-gemini` | **haiku** | Read·Read·ToolSearch(select:SendMessage)·SendMessage | 否 |

**backend 可用性已排除**：`GEMINI_API_KEY` 已设、`dist/index.mjs` 存在、gemini MCP 历史日志中有 19+3+3 次成功调用。两份 proxy 定义的首要动作**逐字相同**。

**失效机制（agent 自述，未经润色）**：

> *"The task instructions were specific and dense about extracting exact document sections and sending them to the backend… **The Cast layer instruction to fetch tools first was crowded out by the detailed material-handling requirements.**"*

它另外把 "send to backend" 理解成了向另一个 agent `SendMessage`——该措辞对该模型层级存在歧义。

**两次失效的机制不同**：

| | 第一次 | 第二次 |
|---|---|---|
| 机制 | 先导指令**冲突**（"read these files first" vs "before reading anything"） | 任务描述**密度**挤掉首要动作 |
| 产出 | 用自身分析冒充跨家族发现，形状与真品不可分 | **FINDINGS 留空**，第一行如实 `not-reached` |
| 发现方式 | 事后追问 + 三通道核查 | **产出第一行，零成本** |

修掉第一种机制的同时引入了第二种。**同一份 prompt，sonnet 扛住了密度，haiku 没有。**

### 10.6 由 10.3–10.5 得出的结论

1. **这条指令无法靠措辞变可靠。** 它已是首句、已加粗、已写 "before reading anything"；两次、两份不同 prompt、两种不同挤出机制。**修法必须是结构性的。**
2. **模型层级影响指令遵守度**：同等密度下 sonnet 守住、haiku 未守。**一个座位若全部价值就是那次工具调用，不应配会跳过它的模型。**
3. **spawn prompt 越密，定义层首要动作越易被挤掉。** 材料处理细节应留在 agent 定义内，spawn prompt 只给任务。
4. **到达自述提高可见性，但它不是证明。** ——本条为初稿结论的更正。初稿写的是"真正兜底的是到达自述那一行"，**这与 D2「LLM 不能做自己的证人」冲突**：自述是 agent 为自己作证。两次运行中真正确立事实的都是 **MCP server 日志与 host transcript**，即外部通道。正确的表述是：**自述让失败在第一行可见，外部记录让它可证；两者不可互替。**（更正来源：跨家族评审，见 §10.7 第 1 条 d 项）
5. 因此 `check-relay-attestation.sh`（读归档、外部）**不是被自述取代，它才是证明环节**；自述是零成本的前置信号。定位应为：**自述在产出第一行报告，日志/transcript 核查提供不可自证的确认。**


### 10.7 跨家族评审（Codex，`BACKEND: reached`，thread 01a02bae）

第二次试跑中 `xf-codex` 座位打通 backend 并逐字转述。这是本会话中**唯一一次真正的跨家族评审**（前两次分别为冒充与未达）。四条主要发现，均经复核认可：

1. **认识论自证循环**：`需求 → AC → recipe → 证据` 前三项可由同一业务 agent 产生，而判官的 rubric 又来自该 agent 填写的 AC 第 3 问。判官能发现"证据没证明 AC"，**不能发现"AC 与验证手段共同把问题定义窄了"**。其 d 项进一步指出 D11 复制了同一自证结构，并据此更正了本文件 §10.6 第 4 条。
2. **D2 与 D10 的直接边界矛盾**：D10 主张 challenger 的"该需求无 AC 对应"可过仪器；但**语义上的"不对应"是 LLM 判断，不是零知识检查**。仪器至多确认引用存在。D3 第三条中断"噪音由仪器过滤"因此落空。
3. **计划缺少判官的实施项**（标为致命）：runner（0.1–0.3）、锚点检查（1.4）、跨家族座位（1.8）均有工作项，**隔离判官及其 verdict 契约没有**，而 P1 退出条件 2 直接假设它存在。
4. **执行 agent 撰写的 recipe 是一个代码执行边界**（标为致命）：全套文档未提 sandbox、超时、网络/密钥权限、工作目录限制、并发隔离或破坏性命令策略。recipe 由 agent 撰写、受仓库内容影响，**不仅可能假绿，还可能改代码、改测试数据、改冻结文件、改验收脚本本身**。本仓已有无意实例：`check-proxy-residual.sh` 重建自身基线并与自身比较（§1.3）。

另有两条：**基线硬前置不可执行**（采集器 K.1/P2.1 等本身标为"需新增"，形成计划级死锁——该缺陷由本轮修复基线污染时引入，为同类第三次）；**评估设计不足以支撑因果结论**（E1 单次单条件、E2 无真值标签与盲评、3 feature 不足以判定非退化；且 hedge 计数与 D2"未验证成为字段"互为混淆）。

Codex 总体判断（原话）：*"这套设计最强的是对『自证』和『形态匹配』的警觉；最明显的盲点则是把这些原则落实到真正的信任边界时，仍多次依赖 agent 自检、agent 自述和 agent 可写的仓库状态。"*
