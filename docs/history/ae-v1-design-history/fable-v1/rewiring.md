# 现仓改线图（fable 侧勘定）

> **Status: historical — a source proposal, not a plan.** This is one of the
> independent proposals written before AE v1's design was consolidated. It was
> never the specification, and the specification it fed into has itself since
> been archived. **Nothing here has authority over current work.** The set and
> how each source was judged: [`README.md`](../README.md). The current account of what AE
> is and where it is going: [`rebuild.md`](../../../rebuild.md).

> 与 finalized `migration-map.md` 互补：那份是"现状事实与接缝"，本份是**逐文件处置
> 判决**。诚实标记：〔读〕＝本 session 亲读过内容；〔构〕＝按名称与引用关系推断，
> P5 过堂时须先读后判。处置动词：keep / rewire / merge / delete / audit。
> 每个 delete 都要在执行时补全 `保护对象 → 替代 → mutation test` 三元组。

## 1. 存储迁移（feature 目录）

```
旧                          新                              说明
plan.md（目标+验收+步骤）    plan.md（纯策略）+ contract/     双重身份拆除
goal.frozen.md              contract/revisions+locks+current  真人签替代自动复制
notes.md（LOOP_*, WAIVED_*） ledger/events.ndjson             散文键值 → 事件；WAIVED 类彻底无效
review.md（verdict+归档）    judge 事件 + ae-gate finalize     判决与归档拆成两权威
evidence/<AC>.json           runs/RUN-*/ + 账本               收集器产物 → runner 产物
index.md                     index.md（投影，可重建）          不再是状态源
```

migrate-on-touch：下次 plan/work/review 触碰 legacy feature 时展示转换后契约由人
确认；不推测历史 pass（一律重新取证）；done/ 历史只读不动。

## 2. Skill 处置（24 个）

| skill | 行数 | 处置 | 说明 |
|---|---:|---|---|
| discuss〔读〕 | 861 | rewire | 产物改为契约草案；coverage 席接入（seats §4）；Round 0 外部证据采信保留（E4 即其实践）；P5 去规定性瘦身 |
| plan〔读·部分〕 | — | rewire | 只写策略；**删 goal.frozen.md 自动复制**（migration-map §3.1 的接缝）；契约冻结流程移交 discuss/专步 |
| work〔读〕 | 595 | rewire | F-048 盘上 harness loop（L536-591）原样保留；verify 一律经 ae-run；notes 键值弃权威；单一 owner；diagnosis 事件 |
| review〔读〕 | 756 | rewire | 判官调度器＋门调用器；**失去** verdict 书写权与 `mv done` 权（F6/F7 关死）；守门② |
| analyze〔构〕 | — | keep | fan-out 研究（ReWOO 形状）；产物喂 discuss；无判决权 |
| plan-review〔构〕 | — | merge→plan | 策略风险检查并入 plan 的一步；契约合格性已归 coverage 席 |
| consensus〔构〕 | — | merge→discuss | Team 仅 peer exchange 后，独立 consensus 协议并回 discuss |
| review 之外的 code-review〔构〕 | — | merge→review | 判官席的一种 rubric，不是平行工作流 |
| retrospect〔构〕 | — | rewire | 地板候选生产者（contract §5.3 的入口） |
| knowledge-refresh〔构〕 | — | rewire | 维护 map/lessons（非阻塞）；graph 脚本依赖拆除 |
| setup〔构〕 | — | rewire | 初始化 schemas/policies/floors；cross_family_seats 写入 pipeline |
| status / next〔构〕 | — | rewire+merge | 读 Gate 投影，二者合一（都是"现在什么色、下一步什么"） |
| dashboard〔构〕 | — | rewire | 读投影；失去从散文推断状态的全部逻辑 |
| backlog / roadmap〔构〕 | — | keep | 协调面工具，不碰真值 |
| agent-teams / agent-selection〔读·部分〕 | — | rewire | 席位合同与投放纪律落此（seats §2）；cast block 降为 UX 层但格式兼容 |
| team〔构〕 | — | audit | 与 agent-teams 重叠度待读后判 |
| test-plugin / testgen〔构〕 | — | keep/audit | 测试基建保留；testgen 待读 |
| think〔构〕 | — | audit | 纯协调面工具；按"消失了完成定义变不变"判 |
| trace〔构〕 | — | audit | 遥测；永不入证据（ledger-gate §1 白名单已关门） |
| plugin-stats〔构〕 | — | keep | 诊断 |

## 3. Script 处置（35 个顶层）

| script | 标记 | 处置 | 保护对象 → 替代 |
|---|---|---|---|
| collect-ac-evidence.py | 〔读〕 | **delete**(P2) | 证据收集与空洞检测 → ae-run＋count_rule＋判官；mutation test=F1b/F1c、E6 注入 |
| check-proxy-residual.sh | 〔读〕 | **delete**(P5) | F-082 试验期的修剪回归 → 无需常驻（feature 已归档）；mutation test=F-082 done 目录完好＋僵尸 active/ 目录清除后不再复活 |
| proxy-dup-sentences.py | 〔读·引用〕 | delete | 随上者死（唯一调用方） |
| parse-review-verdict.sh | 〔构〕 | **delete**(P4) | review 判决解析 → judge 事件；mutation=F6b |
| check-relay-attestation.sh | 〔构〕 | merge(P3) | 转述失真防护 → backend_invocation＋seat_result 存档 |
| check-family-reachability.sh | 〔构〕 | merge(P3) | 可达性 → capability 探针（seats §5） |
| cross-family-counter.sh | 〔构〕 | merge(P3) | 家族计数 → 门的 degraded 清单 |
| check-cross-family.sh | 〔构〕 | merge(P3) | 同上 |
| check-agent-teams.sh | 〔读·引用〕 | keep | 环境探测（形式，合宪） |
| check-cast-block.sh | 〔构〕 | rewire | cast 降 UX 后仍查格式存在性（形式）；权威已移 dispatch 事件 |
| check-shutdown-canonical.sh / check-declared-vs-effective.sh | 〔构〕 | keep-until | 守宿主漂移；live behavior test 接替后才动（finalized 条件保留类同判） |
| check-harness.sh | 〔构〕 | audit(P5) | 与 F-048 循环及新账本的重叠待读 |
| loop-decide.sh | 〔读·引用〕 | keep | F-048 harness loop 决策器 |
| graph_common.py＋graph-*.py ×8 | 〔构〕 | audit-expect-delete(P4) | 写入侧健康度 → 归档判官 lint＋read-hit 观测；graph-refresh 若被 map 生成依赖则改写保留 |
| verify-contract.sh | 〔构〕 | rewire | 降为 recipe 可用实现，不再是真值源（finalized 同判） |
| risk-floor-lenses.sh | 〔构〕 | merge(P4) | → floors 库与绑定检查 |
| write/validate/append-*/trace-rotate（trace 族 ×5） | 〔构〕 | audit | 遥测；确保零真值角色后简化 |
| probe-manifest-precedence.sh | 〔构〕 | audit | 与新 manifest 语义的重叠待读 |
| validate-feature-frontmatter.sh | 〔构〕 | keep | 形式校验（合宪） |
| next-bl-id.sh | 〔构〕 | keep | 琐屑工具 |
| ae-run-tests.sh / ae-test-plugin-regression-layer1.sh | 〔构〕 | keep | 回归入口 |
| read-family-table.py | 〔构〕 | keep | pipeline 读取器 |
| **新增** | | | ae-run.py（runner §）、ae-gate.py（ledger-gate §）、correlator（seats §5）、视图渲染器（contract §6）、能力探针 |

净效果预估（P5 实测为准，不作门）：35 → 保留约 12 ＋ 新增 5；删除的每一个都
带三元组记录。**行数不是指标，保护性质不减是指标。**

## 4. 接缝清单（带锚点，P0 冻结 fixture 时逐条取样）

1. `plugins/ae/skills/plan/SKILL.md`：goal.frozen.md 自动复制却被描述为"批准时冻结"
   ——真人签缺席的根（migration-map §3.1；E8/E11 同源）。
2. `plugins/ae/skills/review/SKILL.md`：同一 skill 判决＋归约＋归档三权合一 →
   拆为 judge 事件 / ae-gate / finalizer。
3. `notes.md` 的 `LOOP_ITER / LOOP_FINDINGS / WAIVED_AC / UNVERIFIED_AC`：散文键值
   承担真值 → F6a 的注入原型。
4. `collect-ac-evidence.py:34` KNOWN_PARSERS＋exit 语义失真（E6）→ F1/R 系。
5. `check-proxy-residual.sh:30` 硬编码已归档特性路径＋L82-87 自比对（E5）→
   盲仪器宪法的展品。
6. `work/SKILL.md:536-591` F-048 盘上循环——**正确的既有形状**，只接 runner，不动。
7. 代理定义与 spawn 纪律（E1/E2/E3 三通道实测）→ seats §2.1 投放纪律的来源。
