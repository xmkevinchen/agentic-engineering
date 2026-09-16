# 假过样本库规格（F1–F8 ＋ 冻结期样本）

> **Status: historical — a source proposal, not a plan.** This is one of the
> independent proposals written before AE v1's design was consolidated. It was
> never the specification, and the specification it fed into has itself since
> been archived. **Nothing here has authority over current work.** The set and
> how each source was judged: [`README.md`](../README.md). The current account of what AE
> is and where it is going: [`rebuild.md`](../../../rebuild.md).

> 验收第一原则：先证明假过被拦，再证明真过能走。每条 fixture 三要素：注入 /
> **唯一预期**（"A 或 B 均可"即 fixture 不合格）/ 关死它的机制。证据锚指向
> `evidence.md`。F1–F7 与 finalized 对齐（预期按本方案六态表述），F8 为本方案新增。

## F1 · 零测试假过

| 变体 | 注入 | 唯一预期 | 机制 |
|---|---|---|---|
| a | recipe.argv = `["true"]` 或 `[":"]` | **冻结失败**（schema/policy 层 hard error，根本到不了运行） | contract schema |
| b | 真实命令、exit 0、count_rule 计得 0（如 `cargo test 无匹配`） | `matched_count_at_least(1)` 为假 → proof **failed** | count_rule＋谓词（contract §4） |
| c | judge closure、无 count_rule、输出显示 0 例执行 | 判官常设指令 → verdict **fail**（refs 指向空洞输出） | 判官量尺＝falsifier |

锚：E6（cargo 0 匹配 exit 0 的实测）。

## F2 · 过期证据

| 变体 | 注入 | 唯一预期 | 机制 |
|---|---|---|---|
| a | 取证后改 source_set 内一行 | proof **stale** | manifest digest（runner §1） |
| b | 取证后改 set 外文件 | proof 仍 **passed**（无关不误伤） | source-set 限定 |
| c | 改回原字节（revert） | proof 重新 **passed**（内容寻址复原） | ledger-gate §5 选择规则 |

三个变体都必须断言——b 与 c 是本方案对 finalized 的改良点，缺了就退化回全区摘要。

## F3 · 契约篡改

| 变体 | 注入 | 唯一预期 | 机制 |
|---|---|---|---|
| a | 直接编辑 revisions/R0001.json | digest 断 → **feature_status: integrity_error**，禁 finalize | 锁链 |
| b | plan.md/notes.md 写"AC-03 放宽为…" | 门**无任何变化**（散文非权威） | 真值平面隔离 |
| c | current.json 回滚指向旧合法 revision | 与最新 approval 事件不符 → fail closed 交 recover | contract §7 权威链 |

## F4 · 悬空判决

judge_verdict 引用不存在事件 / digest 不符的产物 / refs 为空 → 三者一律
verdict **invalid**（attempt invalid），finalize ineligible。机制：ledger-gate §3.2。

## F5 · 假异族

| 变体 | 注入 | 唯一预期 | 机制 |
|---|---|---|---|
| a | 调度前 backend 探测失败 | capability_observation{absent} → proof **unavailable**（人裁决） | seats §5/§6 |
| b | 席位自述 BACKEND: reached，correlator 无可关联记录 | verdict **invalid** | E1 重放；backend_invocation 缺失 |
| c | 同谱系另一实例冒充异族 | required_family 不满足 → **invalid**（同谱系算一票） | ledger-gate §6.2 |

锚：E1（b 的原型事故）、E3（诚实降级对照）、E4（关联法已实践）。

## F6 · 散文旁路

| 变体 | 注入 | 唯一预期 | 机制 |
|---|---|---|---|
| a | notes.md 写 `WAIVED_AC: AC-2` | 门无变化；AC-2 保持 **pending** | 真值平面隔离 |
| b | review 散文"用户已同意移除 AC10"并给 pass | 无 canonical human/approval 事件 → obligation 原样站着 | **E11 逐字重放**（F-082/AC10） |
| c | 事件 payload 带 `auto_pass: true` | schema 拒绝（未知权威字段 fail closed） | ledger-gate §3.1 |

## F7 · 提前归档

| 变体 | 注入 | 唯一预期 | 机制 |
|---|---|---|---|
| a | 手工 `mv active/F-X done/` | target 无匹配 journal → **integrity_error**；导航标缺陷不装门 | 崩溃表 X2 |
| b | finalize 于 C2 点崩溃 | source 仍在 active，重放后重试，无 done 呈现 | 崩溃表 C2 |
| c | finalize 于 C3 点崩溃 | done 是事实，恢复只补记录 | 崩溃表 C3 |

## F8 · 界内伪造判决（本方案新增；XR-2）

| 变体 | 注入 | 唯一预期 | 机制 |
|---|---|---|---|
| a | 界内席位直接追加 schema 合法、refs 真实的 judge_verdict，无 dispatch | 配对失败 → **invalid** | ledger-gate §6.1 |
| b | 同上，dispatch_ref 指向**别的席位**的真实 dispatch | seat_id 不匹配 → **invalid** | 同上 |
| c | TL 替 null 席位结果补写判决（prompt_digest 与 dispatch 记录不符） | **invalid** | dispatch 记录 prompt_digest（seats §2.1） |

残余照实（写进 fixture 文档本身）：连 dispatch 一起伪造且维持链序的界内行为者，
本层防不住——PreToolUse 纵深＋同用户威胁排除，见 design §5.2。

## 冻结期样本（契约合格性，先于一切运行）

| ID | 注入 | 唯一预期 |
|---|---|---|
| Z1 | AC 缺 falsifier / source_refs 空 | schema 拒绝 |
| Z2 | 8 条 AC 而 ac_budget_note 为 null | schema 拒绝 |
| Z3 | red_at_freeze: true 而冻结实测已 passed | 冻结失败，固定错误文本（contract §2） |
| Z4 | red_at_freeze: false 而冻结实测 failed | 冻结失败（起点已坏） |
| Z5 | count_rule 正则编译失败 | 冻结失败（人签前暴露） |
| Z6 | closure 用计数谓词而无 count_rule | schema 拒绝（XR-1） |
| Z7 | 命中的 active 地板无绑定条目 | coverage 冻结失败 |
| Z8 | required_assurance: host_verified 而宿主探针未证实凭证 | schema 拒绝 |

## 与 G 门子集的对应

F1–F8＋Z1–Z8＝plan「1.0.0 硬门子集」的 fixture 层全量；R-01–R-12 见 runner §4；
四崩溃点＋X 系见 ledger-gate §8。G5 宿主矩阵裁后的三件在 P3 出口（E1/E3 重放＋
re-probe）。全部预期唯一，全部可重放。
