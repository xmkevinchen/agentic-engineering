# 规范 · 席位、判官与见证（ae.seat.v1 / ae.judge.v1 / correlator）

> **Status: historical — a source proposal, not a plan.** This is one of the
> independent proposals written before AE v1's design was consolidated. It was
> never the specification, and the specification it fed into has itself since
> been archived. **Nothing here has authority over current work.** The set and
> how each source was judged: [`README.md`](../../README.md). The current account of what AE
> is and where it is going: [`rebuild.md`](../../../../rebuild.md).

> 上层设计见 `../design.md` §6。本文钉：席位合同全字段、判决 schema、coverage 席
> 的策略与输出、**backend 关联算法（逐后端具体来源）**、降级语义、档位序。
> 证据锚：E1（自述≠见证）、E2（投放层才是失效点）、E3（档位与密度）、E4（宿主
> 核对已实践）。

## 1. 三层输入与权威（复述一次，因为这是 F4/F8 的地基）

| 层 | 内容 | 权威 |
|---|---|---|
| Agent Definition | 稳定职责、工具边界、输出协议 | 版本化 policy（repo 内文件） |
| Seat Contract | 本次 objective/proof/source/权限/停止条件 | canonical 调度输入，digest 入 dispatch 事件 |
| Cast 视图 | Role/Angle/Why 三行人类投影 | UX；与现 agent-teams cast block 兼容（位置 2、双写），但**不再是机器真值** |

## 2. ae.seat.v1（全字段）

```yaml
schema_version: ae.seat.v1
seat_id: review-P-02-a1          # 唯一；dispatch 与 verdict 靠它配对
role: judge | coverage | worker | researcher
objective: adjudicate P-02 only  # 一句话；一个席位一个问题
contract_revision: R0001
contract_digest: sha256:...
proof_ids: [P-02]
source_refs:                     # 材料按引用传递，不内联（见 §2.1）
  - contract/views/R0001.md#P-02
  - runs/RUN-7/events/EV-....json
allowed_tools: [Read, Grep, Glob]
mutation_rights: none | product | own_artifacts
required_independence: none | fresh_context
required_family: any | non_author_family
required_assurance: canonical_recorded | host_recorded | backend_correlated
minimum_capability_tier: sonnet  # §7
result_schema: ae.judge.v1 | ae.coverage.v1 | free_text
authority: result_is_input_not_gate
stop:                            # 停下并报告，不猜、不代笔
  - source_unavailable
  - backend_not_correlated
  - contract_digest_mismatch
```

### 2.1 投放纪律（E1/E3 的直接产物）

- **spawn prompt = 席位合同的渲染 ＋ 定义层引用，不得携带与定义层首要动作冲突的
  指令**（E1 的事故正是一句"先自己读文件"覆盖了"first action: fetch backend
  tools"）。dispatcher 渲染是确定性的：合同字段 → 固定模板；自由文本只有
  objective 一行。
- **材料按引用不内联**：任务材料以路径/事件 ID 传递，由席位自取。E3 的失效机理是
  内联材料处理要求把首要动作挤出注意力——把体积从 prompt 挪到工具调用，密度攻击
  面即消失。渲染后的 spawn prompt 超过 60 行＝dispatcher 拒绝（形式检查，合宪）。
- dispatch 事件记录：seat_contract_digest、prompt_digest（实际渲染物）、
  definition_ref＋其文件 digest、host_binding（anonymous_subagent|named_teammate、
  result channel）、实际模型档位。

## 3. ae.judge.v1

```json
{"schema_version": "ae.judge.v1",
 "seat_id": "review-P-02-a1", "dispatch_ref": "EV-...",
 "proof_id": "P-02", "verdict": "pass" | "fail",
 "refs": [{"kind": "event|artifact|file", "id_or_path": "...", "lines": "12-40"}],
 "rubric_digest": "sha256:...",
 "summary": "≤5 句，人读；非权威",
 "backend_line": "BACKEND: reached" }
```

- `refs` ≥1 且必须包含同 attempt 的观察事件；空 refs 或悬空引用 → invalid
  （AP-01/F4 类）。
- `backend_line` 是 fail-fast UX（E3 实测有效：not-reached 时席位留空 verdict 并
  停止，宁可空手不代笔）；**门只信 backend_invocation 事件**。
- 席位把 JSON 返回给 TL；**recorder 归一化写入账本**（producer.role=recorder，
  内嵌 evaluator context 取自 dispatch 记录而非席位自述）。TL 不得替 invalid/null
  的席位结果补字段（G2.6 同旨）——补字段＝伪造，F8 fixture 覆盖。

## 4. Coverage 席（守门①）

- **策略来源**：pipeline 级（契约管不到自己的起草评审——XR-3）：
  `coverage_seat: {independence: fresh_context, family: non_author_family_when_reachable}`。
  异族不可达 → 同族新鲜上下文执行＋dispatch 事件标 `degraded: family_unavailable`
  ＋冻结视图顶部向人显示降级横幅（人签时知道少了哪道保险）。
- 输入：draft 契约＋intent 来源（用户原话轮次）＋地板库＋（可选）analyze 产物。
- 输出 `ae.coverage.v1`：

```json
{"gaps": [{"kind": "intent_without_ac | ac_without_source | proof_unrunnable |
            floor_unbound | excess_ac | falsifier_untriggerable | set_incomplete",
           "detail": "...", "refs": [...]}],
 "clean": false}
```

- 七类 gap 对应四问＋三查：够不够(intent_without_ac)、多不多(excess_ac)、
  真实业务覆盖(ac_without_source/falsifier_untriggerable)、异族重点(自由发现)；
  三查＝proof 可执行、地板绑定齐、source_set 完整。
- gap 交人处置（改草案或明确 out-of-scope）；coverage 席**不能批准**契约，
  clean 也只是"我没找到"，签字永远是人。

## 5. Backend 关联算法（correlator，宿主侧）

三类来源，优先级递减；correlator 是宿主侧脚本（盲仪器：读日志、比时间窗、
写事件——不理解内容）：

| 优先 | 来源 | 适用 | 机制 |
|---|---|---|---|
| 1 | **自有桥的调用记录** | gemini、openai-compat（桥在 `plugins/ae/mcp-servers/`，我们自己的代码） | 桥在每次真实上游调用时落一行 `{ts, tool, model, input_digest, output_digest}` 到宿主侧日志——**在桥内记录，agent 无法伪造**；correlator 直接读。P3 给两座桥各加 ~20 行 |
| 2 | 外部 MCP 服务日志 | codex（服务是 OpenAI 的，改不了） | 日志文件扫描：窗口 [D.created_at, verdict.created_at] 内该服务的调用条目计数与时间戳（E4 已实践：codex 2/gemini 2/oc 1 @20:41 即此法） |
| 3 | CC 宿主记录 | 兜底 | transcript 中的 mcp__ tool_use 条目关联（host_recorded 级，弱于 backend_correlated——按 ledger-gate §6.2 蕴含规则如实标） |

- 来源 1 产 `backend_correlated`（含 input/output digest）；来源 2 产
  `backend_correlated`（无 digest，窗口关联）；来源 3 只产 `host_recorded`。
  契约要求 backend_correlated 而只有来源 3 → 不满足，如实降。
- 调度前探测：backend 服务不可达（桥握手失败）→ capability_observation{absent}
  → 该席 unavailable（不是 invalid——AP-02 区分）。

## 6. 降级语义（E3 的诚实降级流程，机制化）

```
required 席位不可满足时:
  dispatch 前已知   → capability_observation{absent} → proof unavailable
                     → 门在 degraded 清单列出 → 人裁决: 等待 / amendment 放宽(人签) / 放弃
  dispatch 后发现   → 席位按 stop 条件停下, seat_result 存档, attempt 不闭合(pending)
                     → dispatcher 记 degraded, 重派或走上行
  声称满足而关联失败 → verdict invalid（F5 类, 与上两者严格区分）
```

任何降级都出现在人面前——静默降级是 F 系列的根，一条也不留。

## 7. 档位序（minimum_capability_tier）

- v1 内置序：`haiku < sonnet < opus < fable`（启发式，承认粗糙；1.0.x 可换注册表）。
- dispatcher 在 dispatch 事件记录实际档位；门校验 `实际 ≥ minimum`，不满足 →
  该席产出 invalid。
- 依据等级（2026-08-22 更正）：**待重测假设**，不是实测。E3 的档位归因因
  gemini-proxy frontmatter 静默失效而混杂（见 evidence E3 更正）；本节机制保留
  （逻辑独立于该实验），但 minimum 默认值须在 P0.0 修复后的双臂对照里重新标定。
  §2.1 的按引用传递仍是第一道防线。
