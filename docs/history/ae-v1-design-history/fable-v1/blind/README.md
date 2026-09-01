# AE v1 —— Fable 独立答卷

> **Status: historical — a source proposal, not a plan.** This is one of the
> independent proposals written before AE v1's design was consolidated. It was
> never the specification, and the specification it fed into has itself since
> been archived. **Nothing here has authority over current work.** The set and
> how each source was judged: [`README.md`](../../README.md). The current account of what AE
> is and where it is going: [`rebuild.md`](../../../../rebuild.md).

> 2026-08-22。写作协议即验证协议：本目录在**不读 `.ae/1.0/finalized/`** 的前提下，
> 从用户三目标与本 session 实测失效独立重推。写完 design / evidence / plan 之后
> 才读 finalized/ 并写 cross-review.md。收敛处是双向印证，分歧处是评审发现。
> 哲学不重写：`.ae/1.0/claude/philosophy.md`（五条款＋棘轮）已在本 session 定稿，
> 直接沿用——把它抄一遍换个措辞，正是要戒掉的堆料。

## 一句话

> **软件工程的正确性，不能由执行它的那一方自己宣布。**

AE v1 把这句话做成机器——**三问两律，其余全是 Agents 的自由**：

| | 问题 | 归属 |
|---|---|---|
| Q1 | 什么算做完 | **契约**：Agents 起草、人确认、修订可追 |
| Q2 | 真做完了吗 | **账本＋门＋判官**：完成由证据决定，判者不执，门只做代数 |
| Q3 | 下次能不能更便宜 | **知识层**：实现索引＋验证地板＋教训；棘轮的记忆所在 |
| L1 | 自证不算数 | 执行者≠判官；agent 自述≠宿主见证；同族产出≠跨家族标签 |
| L2 | 只紧不松 | 任何一层可收紧；放松必须走人签信封 |

"怎么做"故意不在三问里——策略、编队、模式、轮次全属 Agents，AE 只造边界不管边界内。
**最大化精简由此推出**：凡不服务于三问两律、也不是人的接口的机制，都是删除候选。

## 五类实测失效 × 五个机制

机制准入判据（Round 0 已升为硬约束）：**说不出自己杀死哪类实测失效的机制，不进 v1。**

| # | 失效（本仓/本 session 实测） | 机制 |
|---|---|---|
| F1 | 没跑当过——检查存在但从未运行 | **M1 逐条对账的门**：每条 AC 三值 green/red/unproven，unproven 阻塞完成 |
| F2 | 旧证当新——证据不绑定当前代码（脏工作区） | **M2 快照绑定**：每条证据事件携带 manifest digest，门拒绝不匹配 |
| F3 | 自审自过——执行者自写判决 | **M3 判执分离**：actor 字段＋隔离判官（跨家族优先） |
| F4 | 假异族——backend 未达却交付"跨家族"结论 | **M4 宿主见证**：席位合同 BACKEND 首行＋宿主核对 MCP 日志写入事件 |
| F5 | 静默松绑——验证地板被悄悄降级 | **M5 棘轮信封**：地板变更成事件，放松必须有人签 |

每条失效都有本仓案号或本 session 复现记录，见 `evidence.md`。

## 闭环（人只在两处必然出现）

```
需求 → analyze(可选,并行研究) → discuss: 起草契约+跨家族挑战充分性 ←守门①需求被正确理解?
        → 【人: 确认契约 rN】 ←──────────────── 边界变更回到这里
          → plan(自由域) → work: 执行, runner 随手记账(账本)
            → review: 判官逐条裁决 + 门做代数 ←守门②确认的需求被合格验收?
              ├─ 红/未证 → 回 work        ├─ 边界问题 → 回【人】
              └─ 全绿 → 【人: 验收】 → 归档: 教训入知识层, 地板只紧不松
                                          └→ 下一轮 discuss 先读知识层
```

## 它删掉什么

判据先行（**盲仪器宪法**）：机械件只许懂**形式**（退出码、摘要、哈希链、相等性），
不许懂**内容**（业务名词、特性路径、解析器名单）。现仓 38 个脚本按此逐一判；
已确证违宪的三例（僵尸 F-082 复活检查、KNOWN_PARSERS 注册表、graph 写入侧健康度）
见 design §7。v1 核心只新增两件盲仪器：runner 与 gate。
六值 `verify_by` 降为三种证明方式＋scope 标签。

## 文件

- `design.md` —— 完整设计（对象、证明、边界、模式判决、宪法、安全）
- `evidence.md` —— 十条实测证据，各自钉住的设计决策
- `plan.md` —— P0–P5，单人节奏，每期可运行物＋可证伪出口＋删除清单
- `cross-review.md` —— 最后写：对照 finalized/ 的收敛与分歧（兼作跨家族评审首件）
