# 落地计划 v2（合流版）P0–P5

> **Status: historical — a source proposal, not a plan.** This is one of the
> independent proposals written before AE v1's design was consolidated. It was
> never the specification, and the specification it fed into has itself since
> been archived. **Nothing here has authority over current work.** The set and
> how each source was judged: [`README.md`](../README.md). The current account of what AE
> is and where it is going: [`rebuild.md`](../../../rebuild.md).

> 盲写版存档于 `blind/plan.md`。本版吸收 finalized 实施计划的三件事——shadow 纪律、
> finalize 事务、按保护对象删除——同时坚持盲写版的核心判断：**规范是团队尺寸的，
> 操作者是一个人**。解法不是砍规范，是把规范当目标不变量，把执行排成单人纵向切片，
> 并预注册"1.0.0 硬门子集"：裁掉的每一项标 deferred 进 1.0.x，不是删除。
>
> 两条不可交换的顺序（采纳，全计划唯二刚性约束）：
> ① runner 安全边界先于执行任何 agent 起草的 recipe；
> ② 破坏性删除晚于 enforce 与替代 mutation test。

节奏：单人兼职，每期 0.5–2 天，期末三件套：可运行物 / 可证伪出口 / 删除清单。
依赖严格串行 P0→P5。总量 7–11 个工作日。

---

## 1.0.0 硬门子集（预注册；finalized 全集为 1.0.x 路标）

| 类别 | 1.0.0 保留 | 推迟到 1.0.x（标 deferred，不删） |
|---|---|---|
| 假过样本 | **F1–F8 全部**（F8=界内伪造判决，我方新增） | — |
| runner 攻击 | **R-01–R-12 全部**（安全面不裁） | — |
| finalize | 四崩溃点＋双并发仲裁全部 | lease/写者租约语义 |
| schema/字节 | 每 schema valid/invalid fixture；v1 canonical 形式＝
排序键的稳定 JSON（声明为约定） | JCS 字节级形式化、product-delta manifest |
| 契约权威 | 未确认不 current／可拒可改／原子指针／material 全走新 revision | activation 事件全形式化 |
| 判官独立 | 同上下文即 invalid／同族多实例算一票／伪 backend 收 invalid | 家族谱系注册表 |
| 宿主 | 已实测事实清单＋每次 dispatch 前 re-probe | G5 全矩阵（三种 invocation mode 全测） |
| 迁移 | shadow 覆盖 1 个真实 feature＋分歧全处置→enforce | migrate-on-touch 全量、legacy 双读收口 |
| 价值对照 | 不设门（只记录） | G7 全部 |
| 稳定性 | 发布＝1 个真实 feature enforce 全程走完 | 〔常〕三连击达成后补打 stable 标记 |

诚实声明：本表是**降低 1.0.0 的声明范围**，不是降低任何单项的判定标准——
留下的每项仍按 finalized 的唯一预期判。

---

## P0 · 冻结语义＋契约与确认（1 天）

**做**：
- `plugins/ae/schemas/`：contract-v1 / event-v1 / judge-v1 / seat-v1 五份 schema
  （含 falsifier、source_refs、red_at_freeze、count_rule、AC 预算字段）＋
  valid/invalid fixtures。
- F1–F8 假过样本库（fixture 形式，先于任何实现——含 F-082/AC10 现成回归样本、
  F8 界内伪造判决）。
- 契约产出流程进 `skills/discuss/SKILL.md`（草案→coverage 四问→人确认**视图**→
  R0001＋lock＋pointer）；视图生成器（盲仪器，确定性渲染）。
- 宿主能力探针（capability snapshot 脚本；一次实测本机矩阵存档）。

**出口**：给 P1 立契约并由人确认 R0001——模板写不出 P1 的 falsifier 即 P0 不合格；
F1–F8 在 spec 层（人工推演表）各有唯一预期。
**删**：无。P0 的 recipe 只冻结不执行（顺序①）。

## P1 · runner＋账本＋shadow 纵向切片（2 天）

**做**：
- `scripts/ae-run.py`（盲仪器①）：argv 数组执行、timeout/进程组、cwd realpath 限界、
  env 白名单、输出上限、网络策略探测；**source-set 限定 manifest**（含 declared
  untracked；set 外不 stale）；count_rule 声明式提取；哈希链事件写入（idempotency、
  producer 含 model_tier）。
- `ae-gate.py --dry-run` 骨架：读账本出七态报告，不写任何生命周期。
- **shadow 开始**：挑一个真实小 feature 双轨——旧路径照走，新门只读记录分歧。

**出口（=R-01..R-12 全部预注册结果＋三注入）**：脏工作区→stale；exit 127→事件如实
记 fail 且 runner 非零；篡改历史一字节→链校验断。
**删**：collect-ac-evidence.py 标弃用（P5 按保护映射收尸）。

## P2 · 门＋判官（2 天）

**做**：
- `ae-gate.py`（盲仪器②）完整化：七态归约、closure 代数、独立性/家族/保证地板、
  **judge_verdict↔dispatch 配对校验**（F8 的关死）、finalize_eligible。
- `skills/review/SKILL.md` 收口：每 proof 一判官（新鲜上下文、source-first、refs
  必填、不读执行叙事）→ judge 事件经 recorder 写入；空洞常设指令（无 count_rule 时）。
- coverage 席位落地（守门①，pipeline policy 定独立性：fresh 必需＋异族可达时必需）。
- amendment 基础版：新 revision、supersede、指针原子换、旧证据标 superseded、不继承 pass。

**出口（故障注入 ×5）**：无事件 AC→pending 阻塞；执行者伪造判决（无 dispatch 配对）
→invalid（F8）；0 测试绿→failed（有 count_rule）或判官打回（无）；同上下文判官
→invalid；弱化 AC 的"修订"未经人确认→不产生 current。
**删**：collect-ac-evidence.py 删除（保护对象→runner+judge，mutation test=F1/E6 注入）。

## P3 · 宿主见证＋席位合同（1 天）

**做**：backend_invocation correlator（复用 7fbc4b0 路径，MCP 日志→宿主事件）；
`ae.seat.v1` 落进 agent-selection/agent-teams（BACKEND 首行＝fail-fast UX；
minimum_capability_tier 字段）；`cross_family_seats:` 进 pipeline 模板；
dispatch 前 live re-probe。

**出口（重放 ×2）**：E1 剧本（诱导 prompt）→无宿主事件→跨家族标签被拒；
E3 剧本→workflow_attested＋degraded 如实记录。
**删**：check-relay-attestation.sh / check-family-reachability.sh 与新事件重叠部分
（按保护映射合并）。

## P4 · finalize 事务＋地板演进＋enforce（1.5 天）

**做**：
- 唯一 finalizer：`.ae/transactions/` journal、PREPARED→原子 move→COMMITTED、
  四崩溃点恢复、双并发仲裁、`--dry-run`。
- `.ae/policies/floors/` 目录＋演进环（归档步产候选→人签入册→coverage 查引用）；
  松绑走人签信封，门校验。
- **shadow 收口**：P1 起累积的分歧逐条处置→该 feature 切 enforce；此后新 feature
  一律 enforce（无双真值）。

**出口**：四崩溃点各注入一次，early/double finalize=0；一条 P0–P3 dogfood 真实教训
入地板且 P5 的契约引用它（read-hit 存在性证明）。
**删**：review 直接 `mv done` 路径、review.md.verdict 的真值作用（保护对象→finalizer
＋judge 事件，mutation test=F7 两 fixture）。

## P5 · 清算＋发布 1.0.0（1.5–2 天）

**做**：
- 35 脚本逐个建 `保护对象→替代→mutation test` 映射后处置；条件保留类
  （cast/shutdown/reachability 等守宿主漂移的）逐个由 live test 接替后才动；
  graph-*.py 八件按映射处置（预期多数删，替代=归档判官 lint）。
- 六值 verify_by→mode＋scope 迁移；migrate-on-touch 转换器（人确认，样本=1 个
  legacy active feature）。
- skill 去规定性瘦身（discuss/review/work 861/756/595 行→目标＋约束＋检查点；
  依据：过度规定性 prompt 实测降低新模型输出质量）。
- 发布三步（plugin.json 1.0.0 / CHANGELOG / README 计数）＋硬门子集全绿记录。

**出口（终极 dogfood）**：一个真实新 feature 全程 enforce 走到 finalize 事务归档；
F1–F8、R-01–12 全绿；deferred 清单写进 CHANGELOG 作 1.0.x 路标。
**删**：本期即删除清单的执行与记录。

---

## 风险

1. **人确认瓶颈**（单人双角色）→ 批量确认窗口；确认动作不省略——省略它 F3/F6/E8 全回归。
2. **manifest 性能** → source-set 限定后天然小；事件写入时计算一次。
3. **判官成本** → 输入受限（契约＋证据＋必要代码）；异族只压 coverage/judge 两席；
   同族新鲜上下文为显式降级路径（记 degraded）。
4. **finalized 并发演进**（规范仍在硬化）→ 本计划钉住 schema 语义不钉字节形式；
   1.0.x 对齐 JCS 等形式化项时按 gate_build/schema_version 迁移，旧结果仍可解释。

---

## 规格索引（各期实现的即验收规格，工作包不再自定语义）

| 期 | 实现的规格 | 出口 fixture 来源 |
|---|---|---|
| P0 | contract §1–§7（schema、count_rule、地板绑定、冻结事务）、fixtures Z1–Z8 语义层 | fixtures.md 冻结期样本 |
| P1 | runner §1–§4 全部、ledger-gate §1–§2（封套/链/追加） | runner §4 R-01–12＋F2 三变体 |
| P2 | ledger-gate §3–§7（筛/谓词/attempt/配对/eligible）、seats §3–§4 | F1/F3/F4/F6/F8 全变体 |
| P3 | seats §2/§5–§7（席位合同/关联算法/降级/档位） | F5 三变体＋E1/E3 重放 |
| P4 | ledger-gate §8–§9（finalize 事务/投影）、contract §5.3（地板生命周期） | F7 三变体＋X 系＋read-hit 存在证明 |
| P5 | rewiring.md §2–§4 全部处置执行 | 终极 dogfood＋三元组记录 |
