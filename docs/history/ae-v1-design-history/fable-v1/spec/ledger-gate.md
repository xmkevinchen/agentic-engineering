# 规范 · 账本与门（ae.event.v1 / 归约代数）

> 上层设计见 `../design.md` §4–§5。本文钉：事件类全集与逐类 payload、链与追加规则、
> attempt 模型、六谓词求值定义、逐 closure 归约表、状态优先序、F8 配对算法、
> finalize 崩溃表。术语修正一处：`superseded` 是**事件/修订级的可采信标签**，
> 不是 current proof 状态——current proof 状态共六种
> `pending / passed / failed / invalid / unavailable / stale`（吸收 finalized G3.7）。

## 1. 事件类全集与 payload

统一封套见 design §4.1。`kind` 封闭集与逐类 payload（producer.role 白名单在 §3.2）：

| kind | payload 要点 | 可闭合 |
|---|---|---|
| `command_result` | argv, cwd, exit_code, signal, duration_ms, stdout/stderr {ref, digest, truncated}, count?, count_rule_digest?, pre_manifest_digest, post_manifest_digest, freeze_probe? | direct 闭合；judge 闭合的观察半边 |
| `artifact_observation` | artifact_refs [{path, digest, media}], manifest_digest | judge 闭合的观察半边 |
| `judge_verdict` | seat_id, dispatch_ref, verdict: pass\|fail, refs[≥1], summary | judge 闭合的判决半边 |
| `human_attestation` | question_digest, response, user_turn_ref, assurance | human 闭合 |
| `backend_invocation` | backend, correlator {source, window, invocation_id?}, input_digest?, output_digest?, dispatch_ref | 否（供 assurance/provenance） |
| `capability_observation` | capability, status: present\|absent, detail, attempt | 否（驱动 unavailable） |
| `contract_approval` | revision_id, contract_digest, view_digest, user_turn_ref, assurance | 否（建立权威） |
| `dispatch` | seat_id, seat_contract_digest, prompt_digest, definition_ref, host_binding, expected_backend? | 否（F8 配对的另一半） |
| `diagnosis` | attempt, failed_refs[], expected, observed, hypothesis, next | 否（永不） |
| `seat_result` | seat_id, raw_ref | 否（传输存档，待 recorder 归一） |
| `floor_change` | floor_id, direction: add\|tighten\|loosen\|retire, policy_digest, human_ack_ref? | 否（门校验松绑签字） |
| `amendment_requested` / `finalize_prepared` / `finalized` | 控制事件 | 否 |

`verdict` 只有 `pass|fail` 两值——"我不确定"不是判决，是拒绝出庭（seat 按 stop
条件停下，attempt 不闭合，状态停在 pending）。

## 2. 链与追加

- 单文件 `ledger/events.ndjson`；每行一事件；`hash = sha256(canonical(封套去 hash 字段))`；
  `prev` = 前行 hash；首行 prev = `sha256(feature_id + ":genesis")`。
- **追加协议**：写临时行 → fsync → 追加到文件 → fsync。payload 文件（runs/ 下）先于
  封套落盘；封套引用的 payload_digest 在写入时校验一次。
- **幂等**：`idempotency_key` 重复且 payload_digest 相同 → 返回原事件不重写；
  不同 → 冲突错误，什么都不写（不许两份事实）。
- **截断恢复**：尾部半行（无 LF 或 JSON 不完整）→ 移入 `runs/quarantine-<ts>/`，
  校验剩余链完整后报告；**禁止**忽略后继续（G4.1 同旨）。v1 每次门运行从头验链
  （单 feature 账本量级下成本可忽略；增量头文件是 1.0.x 优化）。
- 任何链断裂、行重排、封套改写 → `feature_status: integrity_error`。

## 3. 可采信筛（归约的第 0 步）

### 3.1 Feature 级状态（先于一切 proof 判定）

| feature_status | 触发 | 效果 |
|---|---|---|
| `ok` | 默认 | 正常归约 |
| `integrity_error` | 链断裂/digest 不符/未知权威 kind（版本内）/截断未处置/done 目录无 journal | **禁 finalize**；报修复指引 |
| `unsupported_version` | 事件或契约 schema_version 高于门实现 | 禁 finalize；提示升级门 |

### 3.2 事件级筛

按序淘汰，被淘汰的事件保留在历史、不进 current 选择：

1. `contract_revision ≠ current` → 标 **superseded**（唯一例外：§7 的逐字节相同
   proof 继承规则）；
2. `freeze_probe: true` → 永不参与 closure（它证明的是契约合格，不是工作完成）；
3. producer.role 不在该 kind 白名单 → 该事件 invalid 且**污染其 attempt**：
   command_result/artifact_observation/capability_observation=runner；
   judge_verdict/human_attestation/contract_approval/dispatch/diagnosis/
   seat_result/floor_change=recorder；backend_invocation=correlator；
4. 引用（refs/payload_ref/dispatch_ref）不可解析或 digest 不符 → 同上。

## 4. 谓词求值（`command/direct`）

| 谓词 | 定义 | 无法求值时 |
|---|---|---|
| `exit_code_in {values}` | `signal == null ∧ exit_code ∈ values`（被信号杀死的进程没有可信退出码） | — |
| `signal_is_null` | `signal == null` | — |
| `matched_count_at_least {value}` | `count ≠ null ∧ count ≥ value` | `count == null`（截断/规则缺失）→ **attempt invalid** |
| `output_not_truncated` | 两流 truncated 均为 false | — |
| `manifest_unchanged` | `pre_manifest_digest == post_manifest_digest` | 任一缺失 → attempt invalid |
| `artifact_exists_with_digest {path}` | 门运行时该路径存在且内容 digest 等于记录值 | 记录值缺失 → attempt invalid |

全真 → passed；任一为假 → failed；任一 invalid → attempt invalid。

## 5. attempt 模型与逐 closure 归约

- 事件带 `attempt`（≥1 整数，同一 proof 内单调）。
- attempt **闭合**条件：direct=有 command_result；command/judge=有 command_result
  ＋judge_verdict；artifact=有 artifact_observation＋judge_verdict；human=有
  human_attestation；或该 attempt 有 `capability_observation{absent}`（以
  unavailable 闭合——runner 拒启动 enforced 策略、correlator 调度前已知 backend
  不可达，均属此类）。
- **attempt 结局**（互斥，按序判定）：
  1. 任一构成事件被 §3.2 判 invalid，或 pre≠post manifest（TOCTOU），或谓词
     invalid，或 F8 配对失败，或独立性/家族/保证地板不满足 → **invalid**；
  2. capability absent 闭合 → **unavailable**；
  3. direct 谓词求值 / judge verdict / human acceptance_rule → **passed / failed**。
- **current proof 状态选择**（内容寻址，天然支持"回滚到已证状态"）：
  ```
  C = 闭合 attempts 中 snapshot.manifest_digest == 当前 source manifest 的那些
  C 非空 → 状态 = max(attempt) ∈ C 的结局
  C 为空 ∧ 存在闭合 attempt → stale     （证过，但代码已不是那份代码）
  无闭合 attempt → pending
  ```
  注意：旧失败不删除、不覆盖（G2.11 同旨）——新 attempt 改变 current，历史全在。

### judge 闭合的附加要求（两半边绑定）

judge_verdict 必须：`refs` 至少引用同 attempt 的观察事件一条；rubric digest 等于
契约内该 proof 的 rubric（防换题）；F8 配对通过（§6）；required_independence=
fresh_context 时 dispatch 所记 evaluator context ≠ 该 feature 任何 mutation-owner
context；required_family=non_author_family 时按 §6.2 的 backend 关联判族。

## 6. F8 配对与家族/保证校验

### 6.1 dispatch 配对（无条件，所有 judge_verdict）

```
存在 dispatch 事件 D:
  D.event_id == verdict.dispatch_ref
∧ D.payload.seat_id == verdict.seat_id
∧ D.contract_digest == current revision digest
∧ D.created_at < verdict.created_at
不满足任一 → verdict invalid（其 attempt invalid）
```

伪造成本从"追加一行"升到"同时伪造调度记录且不破坏链序"；PreToolUse 对
`contract/ ledger/ .ae/policies/ .ae/transactions/` 的写拦截为纵深。残余照实：
连 dispatch 一起伪造的界内行为者、以及同用户恶意进程，在本层之外（design §5.2）。

### 6.2 家族与保证

- `required_assurance: backend_correlated` → 存在 backend_invocation B：
  `B.dispatch_ref == D.event_id`，correlator.source ∈ 可信源注册
  （v1：各 backend 的宿主侧 MCP 服务日志），窗口覆盖 [D.created_at,
  verdict.created_at]。**调度前已知不可达 → unavailable；声称到达而无法关联
  → invalid**（两者语义不同，采纳 AP-02 区分）。
- `required_family: non_author_family` → B.backend 的权重谱系 ≠ 作者席位谱系；
  同谱系多实例算一票。谱系表 v1 内置（openai/google/anthropic/qwen/…），
  1.0.x 升级为注册表文件。
- 允许的同域蕴含仅两条（吸收 finalized G2.10）：`host_verified ⇒
  workflow_attested`、`backend_correlated ⇒ host_recorded`；其余不可折算。
  `self_reported` 永不满足 required。

## 7. finalize_eligible 与修订继承

```
finalize_eligible ⟺ feature_status == ok
                  ∧ current 权威链完整（approval 事件 ↔ lock ↔ revision digest）
                  ∧ ∀ required proof: passed
                  ∧ ∀ floor binding{bound}: 其 proof_ids 全 passed
                  ∧ 不存在 floor_change{loosen|retire} 而无 human_ack_ref
                  ∧ 不存在未决 amendment_requested（孤立 draft 文件不阻塞、也无权威）
```

修订继承（唯一兼容规则）：新 revision 中与旧 revision **逐字节相同**的 proof 对象
（canonical 形式比较）继承其 passed；其余一律重新取证。门执行继承时写一条
`judge_verdict` 吗？不——继承是归约行为不产生新事件，报告中标 `inherited_from: R000N`。

## 8. finalize 事务崩溃表

| # | 崩溃点 | 检测谓词 | 恢复动作 |
|---|---|---|---|
| C1 | PREPARED 写入前 | journal 无该 feature 记录 ∧ source 在 active/ | 无事发生；重新 evaluate 重试 |
| C2 | PREPARED 后、move 前 | journal=PREPARED ∧ source 存在 ∧ target 不存在 | 校验 ledger head/digest 仍等于 journal 记录值：等 → 重试 move；不等 → ABORT 记录并重新 evaluate |
| C3 | move 后、COMMITTED 前 | journal=PREPARED ∧ source 不存在 ∧ target 存在 ∧ target 身份/digest 与 journal 匹配 | done 是事实；补 finalized 事件与 COMMITTED，重建投影 |
| C4 | COMMITTED 后投影未建 | journal=COMMITTED | 只重建投影（status/index/dashboard 均可重建物） |
| X1 | source 与 target 并存 | — | `integrity_error`，交人 |
| X2 | target 存在而无匹配 journal（手工 mv） | — | `integrity_error`；导航标记缺陷，不伪装成门的 finalize |
| X3 | journal 截断 | JSON 不完整 | `integrity_error`，交人 |
| X4 | 双 finalizer 并发 | 文件锁 | 持锁者继续；另一方得 already-finalized 或确定性冲突 |

journal 位于 `.ae/transactions/F-NNN.json`（可移动目录之外），记录
{source, target, revision, ledger_head, gate_build, state, ts}。

## 9. 门的输出（status projection）

`state/status.json`（可删可重建）：feature_status、逐 proof {状态, attempt,
inherited_from?, reasons[]}、逐地板、finalize_eligible、degraded 清单
（unavailable/stale 的人读理由）。**删除后重放必须得到语义相同结果**——这是 P2
出口之一，也是"投影永远不是真值"的机械保证。
