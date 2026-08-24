# 证据 → 设计决策映射

> 规则：每条先给**观察**（何时、何处、如何复核），再给它**钉住的设计元素**。
> 一条证据钉不住任何设计的，删掉了；一个设计找不到证据的，写进了 design 的"待验证"而非本表。
> 除 E9 文献外，全部为 2026-08-22 本 session 实测或亲读。

## E1 · 跨家族席从未调用 backend，产出却无法与真品区分

**观察**：xfam-priority（codex-proxy 定义）读了正确文件、给出全场最深发现；事后核对其
tool_use 序列：Bash×5、SendMessage×2、ToolSearch×1（`select:SendMessage`）、codex MCP×0；
MCP 服务日志同窗口零条目。根因：spawn prompt 里"先自己读这些文件"覆盖了定义层
"first action: fetch backend tools"。
**钉住**：M4 两级断言（自述≠见证）；cast 层进入可信基（design §3.2）；
"形状无法区分"正是为什么只能靠宿主证据、不能靠输出质量鉴别。

## E2 · 对照组：定义没坏，投放层坏了

**观察**：同日会话 f23ea6b6，五个代理席（accum-codex/gemini/qwen、review-codex、
testgen-codex）全部实际调用各自 backend（MCP 日志可数）。同一份定义，失效只出现在
E1 的特殊 spawn prompt 下。
**钉住**：修复对象是 spawn 纪律，不是 agent 定义——纠正 BL-212 的误诊；
design §3.3"删掉了什么"最后一条。

## E3 · 同一合同，sonnet 服从、haiku 被挤掉；但合同的诚实降级生效了

**观察**：修正 prompt 后重跑：xf-codex（sonnet）到达 backend 并交付真实跨家族评审；
xf-gemini（haiku）未到达，自述原因是"取材料的细节要求把首要动作挤出去了"——但它按
合同在首行报 `BACKEND: not-reached` 且 FINDINGS 留空，没有代笔。
**钉住**：BACKEND 首行＋空手合同实测有效（直接观测的输出行为，不受下述更正影响）。

**更正（2026-08-22 终审时发现）**：档位归因作废。实测 `claude plugin validate`
发现 gemini-proxy.md 的 frontmatter 自 6bf9c58（2026-08-16，早于本实验六天）起
因未加引号的 `probe: [ ...` 行解析失败——宿主行为是**运行时以空 metadata 加载，
全部字段静默丢弃**。因此 run-2 中 xf-gemini 的 `model: haiku`、`tools:` 白名单、
`effort: low` 均未生效；按 CC 继承规则其实际模型很可能是会话模型（Opus）而非
haiku。对照的两席实为"完整配置的 codex-proxy vs 空配置的 gemini-proxy"——
第四个混杂变量（定义加载态），档位差异的结论不成立。归因需在修复 frontmatter 后
重跑双臂对照（同模型×定义好坏、好定义×档位）。这条更正本身是 E1 主题的又一实证：
declared ≠ effective，而且本仓专为此写的 check-declared-vs-effective.sh 没有拦住它。

## E4 · 宿主见证已在真实流程里跑通过一次

**观察**：讨论 001 Round 0 采信规则明写"由外部证据而非自述"：三个跨家族席自述
BACKEND: reached，以 MCP 服务日志独立确认 codex 2 / gemini 2 / openai-compat 1
（本地 20:41）。案卷：`.ae/discussions/001-patterns-into-ae/round-00/aggregation.md`。
**钉住**：`backend_invocation` 宿主事件不是设想，是已实践机制的账本化（design §3.2）；
7fbc4b0（问归档要可达性）是它在仓里的雏形。

## E5 · 僵尸目录：特性级实验固化成常驻检查的必然结局

**观察**：F-082 已归档至 done/，但 check-proxy-residual.sh L30 硬编码
`active/F-082-.../`，每次运行重建基线目录——今日实测 `active/F-082/trim-baseline/`
下三个快照仍在。且基线被删后 L82-87 重拍快照与自身比对，vacuous pass。
**钉住**：盲仪器宪法（design §7）；"脚本过时速度正比于编码的项目知识量"的具体案。

## E6 · 解析器注册表：能力名单 + 一条失真退出路径

**观察**：collect-ac-evidence.py L34 `KNOWN_PARSERS=(cargo-test.v1, pytest.v1, sh-tap.v1)`；
本 session 实测存在 verify 命令 exit 127 而脚本整体 exit 0 的路径（与 docstring 声明的
"command failed → exit 1"不符）。另：`cargo test 不匹配` 退出 0 输出"0 passed"——
空洞与否是对照 falsifier 的意义判断，解析器原则上答不了。
**钉住**：runner 取代收集器、解析器概念删除、空洞判定归判官（design §2）。

## E7 · BL-216 的三变量混杂：不能拿执行错误否证思路

**观察**：BL-216 里两个评审者同时在文件访问方式、demonstrate 指令两处不同，家族是第三
个混杂变量——该比较推不出"跨家族无价值"。用户裁定（原话）："不能因为本仓的执行错误
来说这个思路是错的……问题在于我们没有显性规定 Agents 要怎么验证。"
**钉住**：验证义务显性写进契约与席位合同，而非指望席位天赋（design §1.1、§3.2）；
同时是"对照实验要控变量"这条方法论在本仓的教训。

## E8 · 一条无人确认的 AC 几乎判死一个合格 feature

**观察**：本仓记录过一条追溯不到任何讨论决策的 agent 起草 AC，随后失败，几乎让一个
满足用户全部明示条件的 feature 被判失败（philosophy §三.3 收录的案例）。
**钉住**：人确认是唯一能拦住起草者盲区的位置（design §4）；确认必须可拒绝可修改。

## E9 · 文献三条（只保留改变了设计的）

- LLM 无法自纠推理（arXiv 2310.01798）→ 外部检查是必需品，不是加分项——M1–M4 的总前提。
- 判官自偏好（2410.21819）→ 跨家族在**判官位**有测量支撑 → §3.3 required 只设在
  adequacy/judge 两位。
- MAD 36 配置无稳定增益（2502.08788）→ 拒收新辩论位；也是 discuss 豁免拆分时
  "更多 agent ≠ 更好"的引证。

## E10 · 异族评审确实找到了同族整轮没看见的东西

**观察**：本 session Codex 对我方设计的交叉评审（BACKEND: reached，宿主可核）给出四条
同族多轮未见的发现：①判官量尺与 AC 同源的自证环；②"需求与 AC 语义对应"是 LLM 判断
不是盲检查；③隔离判官没有对应工单（致命）；④agent 起草的 recipe 是代码执行边界（致命）。
**钉住**：①→守门①补洞（§3.1）；②→该检查归判官不归仪器（§2 原则的边界样例）；
③→plan P2 显式工单；④→§8 整节。这条本身就是 M4 价值最直接的实证——
花在异族判官位上的钱，买到了四条同族买不到的发现。

## E11 · F-082/AC10：修订机制的现成回归样本（采自 finalized migration-map §3.1）

**观察**：F-082 的 frozen goal 至今仍含 AC10，而最终 review 声称"该 AC 经用户决定
移除"并给出 pass——修订既没有新 revision、也没有人类确认事件，散文一句话就改变了
验收范围。
**钉住**：amendment 事务（design §2.5：material 变更须新 revision＋人确认，旧证据
标 superseded、不继承 pass）；比 E8 更硬，因为它是**已发生**的仓内样本，直接进
P0 的 F6 类 fixture。
