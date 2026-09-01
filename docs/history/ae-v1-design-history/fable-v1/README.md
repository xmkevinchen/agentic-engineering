# AE v1 —— Fable 方案（合流版）

> **Status: historical — a source proposal, not a plan.** This is one of the
> independent proposals written before AE v1's design was consolidated. It was
> never the specification, and the specification it fed into has itself since
> been archived. **Nothing here has authority over current work.** The set and
> how each source was judged: [`README.md`](../README.md). The current account of what AE
> is and where it is going: [`rebuild.md`](../../../rebuild.md).

> 2026-08-22。两个阶段，两种性质：
> **盲写版**（存档于 `blind/`，勿改）——不读 finalized/ 独立推导，作为收敛证明的证据；
> **合流版**（本目录当前四件）——按 `cross-review.md` 逐条裁决后吸收 finalized/ 与
> codex/ 的长处、自修四处短板的更新版。吸收判据唯一：比盲写版更好，且能复述为什么。
> 哲学不重写：`../claude/philosophy.md`。注意 finalized/ 仍在并发硬化，
> 本方案钉语义不钉字节形式（见 plan 风险 4）。

## 一句话

> **软件工程的正确性，不能由执行它的同一上下文自行宣布。**

AE v1 把这句话做成机器——**三问两律，其余全是 Agents 的自由**：

| | 问题 | 归属 |
|---|---|---|
| Q1 | 什么算做完 | **契约**：canonical revision＋人确认视图＋锁链；AC 带 falsifier / source_refs / red_at_freeze，预算 ≤7 |
| Q2 | 真做完了吗 | **账本＋门＋判官**：source-set 限定快照、七态归约、判决须配对调度记录、唯一 finalizer 事务 |
| Q3 | 下次更便宜吗 | **知识与地板**：地板是版本化 policy（演进环：逃逸缺陷→人签入册→契约必引）；索引与教训非阻塞 |
| L1 | 自证不算数 | 独立性三分（上下文/职责/来源）；自述＝UX，宿主事件＝权威；同谱系多实例算一票 |
| L2 | 只紧不松 | revision 内执行层只能加严；人签新 revision 可任意方向；历史永久保留 |

真值平面（契约→账本→门→finalizer）与协调平面（plan/Task/Team/诊断/hook/goal）分开：
协调面可丢失可退化，**永不直写完成**。"怎么做"归 Agents——但复杂度必须挣得：
默认最小拓扑（solo→匿名 subagent→fan-out→Team 仅限 peer exchange→human），
一个 feature 一个 mutation owner。

## 五类实测失效 × 五个机制（推导脊柱，盲写版原样成立）

| 实测失效 | 机制 | 合流后的落点 |
|---|---|---|
| 没跑当过 | 三值阻塞 | 七态归约（pending 即阻塞），F1 fixture |
| 旧证当新 | 快照绑定 | source-set 限定 manifest（改良自盲版全区摘要），F2 |
| 自审自过 | 判执分离 | 独立性三分＋judge↔dispatch 配对（F8，我方新增 fixture） |
| 假异族 | 宿主见证 | backend_correlated 保证级＋席位合同（F5） |
| 静默松绑 | 棘轮信封 | 地板 digest 绑定＋松绑人签（G1 类 fixture） |

假过样本库＝finalized F1–F7 ＋ 我方 F8。机制准入六问（两家合并）：杀哪类实测失效／
可否重现／更简单方案为何不足／新增多少表面／删除时谁接管／删换紧了什么。

## 闭环（人必然出现两次）

```
需求 → analyze(可选) → discuss: 契约草案+守门①(coverage 四问, 异族可达则必需)
 → 【人: 确认视图→R0001】 ←──── material 变更回此
   → plan(自由域) → work: 单一 owner + runner 记账 + 有界修复环
     → review: 判官逐 proof + 门归约 + 守门②
       ├─ failed/invalid → 回 work   ├─ 边界问题 → amendment → 【人】
       └─ eligible → 【人: 验收】 → finalize 事务(唯一入口) → 归档: 教训+地板候选
```

## 它删掉什么

盲仪器宪法不变（仪器只懂形式；count_rule 范式：知识进契约，仪器执行声明）。
删除纪律升级：每项须 `保护对象→替代→mutation test` 闭合；守宿主漂移的检查类
逐个由 live test 接替后才动；不设"删到 N 个"表演指标。已确证违宪三例不变。

## 与 finalized 的关系（当前状态）

规范采纳其为主干；本方案的存在价值＝①盲收敛记录（十二处核心结构独立推到同一形状）
②给它的六项修订（两项已被其并发硬化部分吸收，见 cross-review 执行记录）③单人尺寸的
执行序列与 1.0.0 硬门子集 ④两项待用户裁决：知识层死刑条款、graph 更名时机。

## 文件

- `design.md` —— 合流设计（决策层；每处改判注明让步/自修/保留）
- `spec/contract.md` —— 契约字段级规范（count_rule、red_at_freeze、地板生命周期、视图生成、冻结事务）
- `spec/ledger-gate.md` —— 事件类全集、attempt 模型、六谓词、归约表、F8 配对、finalize 崩溃表
- `spec/runner.md` —— manifest 算法、执行策略、攻击矩阵 R-01–12 逐条唯一预期
- `spec/seats.md` —— 席位合同、判官/coverage schema、backend 关联算法（自有桥记录）、降级语义、档位序
- `fixtures.md` —— F1–F8 全变体＋冻结期 Z1–Z8，预期唯一
- `rewiring.md` —— 现仓 24 skill＋35 script 逐文件处置判决（亲读/推断标记）＋接缝锚点
- `plan.md` —— P0–P5 单人序列＋1.0.0 硬门子集预注册＋规格索引
- `evidence.md` —— 十一条实测证据→设计决策映射
- `cross-review.md` —— 对照评审＋合流执行记录
- `blind/` —— 盲写版四件存档（独立性证据，勿改）
