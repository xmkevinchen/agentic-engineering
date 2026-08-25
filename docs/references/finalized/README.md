# AE 1.0 Finalized

> 唯一规范 · Claude Code 首发实现 · 2026-08-23

## 一句话

> **边界由 Agents 起草、由人确认；完成由可重放证据决定；执行策略按任务几何选择最小够用拓扑；任何边界变化回到人。**

AE 1.0 的本体是一个 **Executable Proof Loop**，不是固定的 analyze/discuss/plan/work/review 流程，也不是多 Agent 编排框架。

```text
Human-confirmed Contract
        ↓
Mutable Execution Strategy
        ↓
Observed Evidence Ledger
        ↓
Deterministic Gate
        ↓
retry / re-plan / amendment / human / finalize
```

## 规范权威

`finalized/` 是设计定稿时的唯一 v1 规范；相邻的 `../claude/`、`../codex/` 与补充方案 [`../fable-v1/`](../../ae-v1-design-history/fable-v1/) 只是来源/审计档案。

发生冲突时按以下顺序解释：

1. [`design.md`](design.md)：对象、状态、权威边界与 CC 绑定；
2. [`acceptance-and-evaluation.md`](acceptance-and-evaluation.md)：发布硬门与故障预期；
3. [`implementation-plan.md`](implementation-plan.md)：依赖顺序与迁移切换；
4. [`philosophy.md`](philosophy.md)：设计原则与取舍方法；
5. [`migration-map.md`](migration-map.md)：截至 2026-08-22 的当前实现事实；
6. [`source-evaluation.md`](source-evaluation.md)：三组来源为何被继承、修正或淘汰，不是运行时规范。

实现中的 feature Contract revision 比通用设计更具体，但不得违反本设计定义的 schema、authority 与 reducer 规则。

## 五条不变量

1. **Contract 与 Strategy 分离。** 当前 revision 内，任何 Agent、计划或 selector 都不能弱化证明要求。
2. **没有 admissible evidence 就没有完成。** prose、Task 状态、Team 消息、`/goal` 和自述均不是完成真值。
3. **同一 material claim 不能由同一上下文生成并成为唯一通过依据。** 独立性是 proof obligation，不是 reviewer 数量。
4. **一个 feature 只有一个 mutation owner；v1 一个 repo 同时只有一个受支持 AE product writer。** 并行化 intelligence/evidence，串行化产品写入。
5. **只有唯一 finalizer 能写 done。** Proof/eligibility 在提交前从 activation + immutable revision + hash-chained Ledger 重放；matching PREPARED 下的 no-clobber move 是不可逆 lifecycle commit，COMMITTED 只是 forward-only seal。提交后冻结为 target 内的 commit-time evidence snapshot + matching external journal；路径本身不算完成，未来 live source 变化也不重写已提交历史。

## v1 明确范围

v1 在现有 Claude Code 插件内实现：Skill 作为薄控制器，普通 subagent/Agent Team 作为可替换执行策略，一个本地 `ae-gate` 负责确定性真值。跨家族只是一种 proof seat 供给方式。

v1 不做：

- 跨 runtime Core 或 Codex 原生移植；
- 通用 Agent graph、Pattern DSL 或新的一组 `/ae:react` 命令；
- Dynamic Workflow 必需路径或预置 workflow；
- 多 writer scheduler、自动合并器或分布式事务；
- `.ae/graph` 重命名或 knowledge 命中率发布硬门；
- 抵御拥有同一 OS 用户全部权限的恶意进程。

## 中心变化

当前 AE 把计划、review prose、notes、Task 状态和归档动作混成若干相互推断的“完成”。1.0 将它替换为：

```text
旧：模型声明 + 文件形态 + 多处状态推断 → done
新：锁定 Contract + 原始事实 + typed adjudication → Gate → 唯一 finalize
```

Agent Teams、cross-family、Doodlestein、fan-out、TDD 与 evaluator loop 仍可使用，但只能改变“怎么做”，不能改变“什么算完成”。

## 发布底线

- G0–G7 全部通过；
- completion false-pass F1–F8 为 8/8 fail closed；
- 适用的 host/pattern 故障 AP-01–AP-17 全部通过，未发布路径只能以“不可达”的证据标记 N/A；
- shadow 分歧全部解释，enforce 后不存在第二个生产 finalize 入口；
- 六类 dogfood 通过，且至少连续三个正常 AE-on-AE feature 使用新路径；
- 旧保护机制只有在“保护对象 → 新机制 → mutation test”闭合后才可从当前truth path退役；单项目迁移不能授权删除AE 1.0共享发行包对其他legacy项目仍需的兼容实现。
