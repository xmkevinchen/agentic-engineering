# AE 1.0 指导原则

> 本文件解释 AE 为什么存在。机器规则以 [`design.md`](design.md) 为准。

## 1. 根命题

> **软件工程的正确性，不能由执行它的同一上下文自行宣布。**

模型会变强，工具会变化，Claude Code 的编排原语也会漂移；但生成者与证明者必须分离这一点不会消失。AE 的工作不是替 Agent 思考，而是把意图、事实、判断和完成写入不同的权威边界。

## 2. 五条原则

### 2.1 边界由 Agents 起草、由人确认

Agent 读代码后起草 Intent、Scope、Acceptance Criteria 与 proof recipe；人类确认业务上什么算对。确认必须可拒绝、可编辑，不是只有“同意”的橡皮图章。

机器真值是确认后的 immutable Contract revision。Plan、review、Task 或后来的一段解释都不能改写它。

### 2.2 完成由证据决定

`exit 0` 只证明一个命令在特定输入与快照上退出为零；LLM `pass` 只证明某个 evaluator 给出判断。AE 通过 typed proof、provenance 与 deterministic reduction 决定它们是否足以支持 Contract。

失败、无效、不可用和过期证据都是历史；新 attempt 可以改变 current status，但不能删除或改写这些历史，更不能被一份漂亮报告跳过。

### 2.3 做法由 Agents 决定，但复杂度必须挣得

计划、TDD、subagent、Agent Team、cross-family、debate、Doodlestein 都是可替换策略。默认使用最简单的单 Agent；只有任务几何、proof independence 或实测收益要求时才升级拓扑。

一个 feature 同时只有一个 active mutation owner；v1 进一步用 durable repo lease 把受支持 AE product write 全局串行。并行化研究、怀疑和取证，不并行化产品决策权。

### 2.4 人在权威边界上出现

AE 必须在以下情况联系人：

- 初次确认 Contract 或 material amendment；
- Contract 声明的 `human` proof；
- 新权限、不可逆外部动作、安全或合规决定；
- 独立 coverage review 发现 Intent/Scope 没有 AC 覆盖；
- 继续工作必须改变目标、范围或产品取舍。

常规阶段切换、retry 或 reviewer 数量不需要逐项审批。用户始终可以主动中断；“只在边界出现”约束的是 AE 不制造无意义审批。

### 2.5 有价值的知识应复利，但不参与当前完成

长期知识只有在被未来工作实际读取、节省重复发现成本时才有价值。知识必须带来源与失效条件；它可以影响下一次 Strategy，不能倒写当前 Contract、Evidence 或 Gate。

Knowledge 是非阻塞产品能力，不是 Proof Kernel，也不是 1.0 发布真值。

## 3. 修订棘轮

最终规则不是“标准永远只能加不能删”，而是：

> **在当前 Contract revision 内，所有非人类执行层只能遵守或加严临时检查，不能弱化、删除或重解释已锁定 obligation。只有人类确认的新 revision 可以改变 material boundary，且旧 revision 永久保留。**

这一区分同时保护两件事：

- 执行者不能把标准降到自己刚好达到；
- 用户仍保有修正错误 AC、缩小范围、放宽要求或改变主意的最终权限。

Agent 临时多跑一项检查不自动把它变成 Contract obligation；若要永久增加或减少考题，必须走 amendment。

## 4. 三种独立性

不要把“独立”简化为多开几个 Agent：

1. **上下文独立**：判断者不继承实现者的工作叙事，只读 Contract、source set 与原始 evidence。
2. **职责独立**：同一 material claim 的生成者不能是其唯一通过依据。
3. **来源独立**：Contract 要求不同 model family 或 backend assurance 时，必须由可关联的外部调用满足；换一个同族实例或写一个标签不算。

独立性是 Contract 中的 proof requirement。Agent 数量只是满足它的一种策略。

## 5. 两个平面

AE 明确分开：

- **Truth Plane**：Contract、Evidence Ledger、Gate、Finalizer；
- **Coordination Plane**：Plan、Task、Team、mailbox、Agent 输出、diagnosis、hook telemetry、`/goal`。

协调平面可以丢失、重建、串行退化；proof/eligibility 真值必须可重放，lifecycle commit 必须从 matching target + external journal 恢复。任何协调信号只有经过专用 canonical producer、满足 event schema 与 provenance 后，才可能成为 Gate 的输入。

## 6. 简化原则

一项机制进入 v1 前必须回答：

1. 它保护哪个具体 failure？
2. 这个 failure 能否以 fixture 或 live behavior test 重现？
3. 更简单的 solo/确定性方案为何不足？
4. 它新增多少 token、延迟、状态与恢复表面？
5. 删除它时由什么机制继续保护同一性质？
6. 它替代、收紧或删除了哪一个现有机制；若只新增一层状态，为什么不可避免？

没有明确答案的 Pattern 不进入默认路径。一个只叠加新对象、却不减少歧义或关闭 failure 的层，默认不准入。行数减少、Agent 数增加、知识写入次数都只是诊断指标，不是质量本身。

确定性机械层应当是“语义盲”的：它可以认识版本化协议、schema、matcher、adapter 与 predicate，却不认识某个 feature ID、一次性的业务名词或硬编码项目路径。项目语义只能来自 human-confirmed Contract 与 versioned policy bundle。Bundled JUnit adapter 属于可复用协议；为 `F-082` 特写的路径/regex 则不是通用机制。所谓“盲”是可检查的依赖边界，不是 Agent 对自身独立性的声明。

## 7. 诚实边界

AE 1.0 是 fail-closed、tamper-evident 的受支持工作流，不是 OS 安全沙箱。拥有同一用户全部文件权限的恶意进程仍可同时修改 Contract、Ledger、Gate 程序与 Git 历史。

同样，Claude Code 当前若不给插件可独立验证的人类 principal credential，批准只能标记为 `workflow_attested`，不能宣称 `host_verified`。Digest 证明内容一致性，不证明 actor 身份。

AE 1.0 的承诺是：

> **在受支持的 AE 路径上，未经 admissible proof 的结果不能被包装为 done；不具备所需能力时必须显示 unavailable、请求人类或停止，不能静默降级。**

## 8. 不属于哲学的东西

- 生命周期阶段名和 `/ae:*` 命令布局；
- Agent Teams、subagent、worktree、cross-family 或未来 workflow；
- ReAct、Evaluator-Optimizer、Reflexion、ReWOO 等研究名称；
- reviewer 数量、模型名、目录字段或文件格式；
- v2 的 Codex/runtime 移植方式。

这些都可以替换，只要 Contract authority、evidence admissibility、deterministic Gate 与 human authority 不变。

## 9. 最终表述

> **契约管边界，证据管完成，策略按任务几何选择最小拓扑，CC 原语承载执行，人在边界变化时裁决。**
