# 规范 · 契约（ae.contract.v1）

> **Status: historical — a source proposal, not a plan.** This is one of the
> independent proposals written before AE v1's design was consolidated. It was
> never the specification, and the specification it fed into has itself since
> been archived. **Nothing here has authority over current work.** The set and
> how each source was judged: [`README.md`](../../README.md). The current account of what AE
> is and where it is going: [`rebuild.md`](../../../../rebuild.md).

> 上层设计见 `../design.md` §2。本文钉字段级语义。凡与 finalized 收敛处从简；
> 展开的都是本方案的差异字段（falsifier / red_at_freeze / count_rule / 预算）
> 与 finalized 尚未定义的部分（地板生命周期、视图生成规则）。

## 1. Revision 文件（`contract/revisions/RNNNN.json`）

```json
{
  "schema_version": "ae.contract.v1",
  "feature_id": "F-NNN",
  "revision_id": "R0001",
  "supersedes": null,
  "intent": "用户为什么需要这项变化（业务语言）",
  "scope": {"in": [...], "out": [...], "constraints": [...]},
  "ac_budget_note": null,
  "acceptance_criteria": [AC...],
  "floors": [FloorBinding...]
}
```

字段规则：

- `revision_id`：`R` + 四位十进制，严格递增，不复用。`supersedes` 指向前一 revision
  或 null（R0001）。
- `ac_budget_note`：AC 数 ≤7 时必须为 null；>7 时必须为非空字符串说明为何本 feature
  天然更宽。**schema 校验**：`len(acceptance_criteria) > 7 ⟹ ac_budget_note ≠ null`。
  超预算而无说明＝invalid contract，冻结失败。
- canonical 形式（v1 约定，见 plan 风险 4）：UTF-8、键按码点排序、无多余空白、LF。
  `contract_digest = sha256(canonical_bytes)`。

## 2. AC 对象

```json
{
  "id": "AC-01",
  "criterion": "业务上可观察的完成条件（一句人话）",
  "source_refs": ["user:turn-17", "discussion:001/topic-03"],
  "consequence_if_missing": "缺失时的用户影响",
  "falsifier": "什么实测结果能证明它没做到",
  "red_at_freeze": false,
  "proofs": [Proof...]
}
```

- `source_refs`：≥1，格式 `user:turn-N` | `discussion:<path>` | `floor:<floor-id>` |
  `bl:<BL-NNN>`。**空数组＝schema 拒绝**——无来源 AC 在冻结前就死（E8、E11）。
- `falsifier`：非空自由文本。它不是机器谓词，是两个下游的量尺：①守门① 挑战
  "这个 falsifier 真的能被下面的 proofs 触发吗"；②判官判空洞时对照
  "这次运行有没有实际行使 falsifier"。写不出 falsifier 的 AC 冻结失败。
- `red_at_freeze`（bool，必填）：声明冻结时刻该 AC 的预期状态。
  - `true`（新行为类）：冻结流程**必须实测一次**该 AC 的 command/artifact proof；
    实测已 passed ⟹ 冻结失败，错误文本固定：
    `AC-XX declared red_at_freeze but already passes — the proof does not test the new behavior`。
  - `false`（回归/保持类）：实测已 failed ⟹ 冻结失败（起点就是坏的，先修再冻）。
  - `human` mode 的 proof 免于冻结实测（无法预演人的回答）。
  - 实测结果本身写入账本（`kind: command_result`，`attempt: 0`，标 `freeze_probe: true`，
    永不参与 closure——见 ledger-gate §3.2）。

## 3. Proof 对象（tagged union，判别子 `mode`）

### 3.1 `command`

```json
{
  "id": "P-01", "mode": "command",
  "source_set": {"paths": ["src/**", "tests/auth/**"], "declared_untracked": ["notes/spike.md"]},
  "recipe": {
    "argv": ["cargo", "test", "auth::"],
    "cwd": ".",
    "timeout_seconds": 300,
    "env_declared": ["RUST_BACKTRACE"],
    "network": {"policy": "deny", "strength": "declared"},
    "high_risk": false
  },
  "count_rule": {"kind": "regex_line_count", "stream": "stdout", "pattern": "^test .+ \\.\\.\\. ok$"},
  "closure": {"kind": "direct",
              "assertions": [
                {"kind": "exit_code_in", "values": [0]},
                {"kind": "matched_count_at_least", "value": 1}]},
  "required_independence": "none",
  "required_family": "any",
  "required_assurance": "canonical_recorded"
}
```

- `argv`：数组，禁隐式 shell。`argv[0]` ∈ {sh,bash,zsh,python,...} 解释器集合 ⟹
  必须 `high_risk: true`，视图渲染时置于"高风险命令"区（人签时看得见）。
- `network.strength`：`declared`（记录在案的意图，人签过；宿主不强制）或
  `enforced`（要求宿主隔离能力；能力缺席 ⟹ 该 proof `unavailable`，不裸跑）。
  **v1 默认 declared**——当前 CC 宿主无沙箱时 enforced 会让一切命令 unavailable，
  系统不可用；declared 之下诚实性由"人签过命令与策略"承担。这是对 finalized §5
  "要求隔离不可用即 unavailable"的显式细化：他们的规则保留为 enforced 档。
- `count_rule`（可选）：见 §4。**closure 引用 `matched_count_at_least` 而无
  count_rule ⟹ schema 拒绝**（XR-1 的关死）。
- `closure.kind`：`direct`（谓词白名单归约）或 `judge`（附 rubric，判官读
  command_result 判语义充分性——判官不得重跑命令代替判断）。

**谓词白名单（v1 封闭集）**：`exit_code_in {values}`、`signal_is_null`、
`matched_count_at_least {value}`、`output_not_truncated`、`manifest_unchanged`、
`artifact_exists_with_digest {path}`。每个谓词的求值定义在 ledger-gate §4.1；
新谓词＝schema version 升级＋reducer 实现＋golden fixture，禁止 recipe 注入表达式。

### 3.2 `artifact`

```json
{"id": "P-02", "mode": "artifact",
 "source_set": {...},
 "artifact_contract": {"required_refs": ["design-doc"], "media": ["text/markdown"]},
 "rubric": {"question": "该文档是否满足 AC-02 的每个条件？",
            "pass_conditions": ["每条有 source/event 引用"],
            "fail_conditions": ["任一条件缺失或引用不可达"]},
 "closure": {"kind": "judge"},
 "required_independence": "fresh_context", "required_family": "any",
 "required_assurance": "canonical_recorded"}
```

### 3.3 `human`

```json
{"id": "P-03", "mode": "human",
 "question": "该交互是否符合预期？",
 "response_schema": {"type": "single_select", "options": ["accept", "reject"]},
 "acceptance_rule": {"accepted_values": ["accept"]},
 "closure": {"kind": "human"},
 "required_assurance": "workflow_attested"}
```

`required_assurance: host_verified` 仅当 P0 宿主探针证实凭证存在时可用；
否则 schema 层直接拒绝（不许契约要求宿主给不出的东西）。

## 4. count_rule（XR-1 的完整规格）

```json
{"kind": "regex_line_count", "stream": "stdout" | "stderr" | "both", "pattern": "<regex>"}
```

- v1 唯一 kind：`regex_line_count`。逐行匹配（Python `re`，隐含 MULTILINE 语义，
  按行切分后 `re.search`），count＝匹配行数。
- **冻结时校验**：pattern 必须能编译；编译失败＝契约 invalid（错误在人签之前暴露）。
- **运行时语义**：
  - 匹配 0 行 ⟹ `count = 0`（合法事实，由谓词判红绿——0 不是错误）；
  - 对应 stream 被截断（超出输出上限）⟹ `count = null, count_invalid_reason:
    "truncated"`；此时任何计数谓词求值为 **invalid**（不是 0、不是 false——
    截断的输出上数数是撒谎）；
  - runner 在 command_result payload 记录 `{count, count_rule_digest}`，
    count_rule_digest 必须等于契约内该规则的 digest（防运行时换规则）。
- 未来 kind（如 `json_pointer_value`）走谓词白名单同一升级通道。

## 5. 地板（FloorBinding 与生命周期——XR-4 的完整规格）

### 5.1 库文件 `.ae/policies/floors/<floor-id>.json`

```json
{"schema_version": "ae.floor.v1",
 "floor_id": "PF-new-code-exercised",
 "statement": "新增代码必须被至少一条 proof 实际执行",
 "applicability": {"scopes": ["new-behavior"], "path_globs": ["src/**"]},
 "obligation_template": {"mode": "command", "closure_hint": "...", "note": "起草时具体化为该 feature 的 proof"},
 "origin": {"refs": ["ledger:F-NNN/EV-...", "bl:BL-076"], "signed_by": "human", "signed_at": "..."},
 "status": "active" | "retired",
 "retired": null}
```

### 5.2 绑定（revision 内）

```json
{"floor_id": "PF-new-code-exercised", "policy_digest": "sha256:...",
 "disposition": "bound" | "not_applicable", "na_reason": null, "proof_ids": ["P-04"]}
```

- 起草时对库中每条 `active` 且 applicability 命中的地板**必须**出现一条绑定：
  `bound`（并列出承接它的 proof_ids，≥1）或 `not_applicable`＋非空理由。
  缺一条＝coverage 冻结失败（守门① 的"查过地板没有"由此机械可查——这一小步是
  形式检查，合宪；理由是否成立仍归守门①的语义判断）。
- `policy_digest` 锁定签入时的库文件内容；运行时改库不影响已冻结契约（G1.8 同旨）。

### 5.3 生命周期（生长与退休）

```
候选产生（finalize/retrospect 步）：逃逸缺陷、被推翻判决、review 发现的系统性漏
  → 候选文件 floors/proposals/<id>.json（带 origin.refs 指向具体账本事件）
  → 人签（AskUserQuestion，可改可拒）→ 移入 floors/，status: active
退休：仅人签。floor 文件改 status: retired + retired: {reason, signed_at}；
  文件不删除（历史留存）。已冻结契约不受影响；新契约不再命中。
```

- **执行层永远不能**：修改 active 地板文本、把 bound 改成 not_applicable、
  跳过绑定检查。三者任一即契约 invalid（棘轮在地板上的投影）。
- v1 种子地板（P4 随实现入库，各带本仓事件锚）：
  `PF-regression-green`（改动路径的既有测试须绿）、`PF-new-code-exercised`、
  `PF-source-set-honest`（判官观察到 set 外读取须报 coverage finding）。

## 6. 视图生成（`contract/views/RNNNN.md`）

确定性渲染，规则封闭（生成器是盲仪器）：

1. 节序固定：Intent → Scope → 逐 AC（criterion、来源、falsifier、后果、
   red_at_freeze、逐 proof 摘要）→ 高风险命令区 → 地板绑定表 → 修订 diff
   （对 supersedes 的 material 变更列表，逐条）。
2. **逐条完整渲染，禁止省略**：每条 recipe 的完整 argv、cwd、timeout、network
   策略必须原样出现（人签的正是这些会被执行的命令——design §13 的根）。
3. 渲染纯函数：同一 revision JSON ⟹ 字节相同的视图。`view_digest = sha256(view)`。
4. lock 文件同录 `contract_digest` 与 `view_digest`；批准事件引用两者。
   校验方向：`render(revision) == view` 可由旁路脚本独立复算（G1.3 同旨）。

## 7. 冻结与修订事务

```
draft.json（无权威）
 → coverage review（seats.md §4；产出 gap findings 或 clean）
 → red_at_freeze 实测（§2；probe 事件入账）
 → 渲染视图 → 人 AskUserQuestion（接受/修改/拒绝；取消≠接受）
 → 写 revisions/RNNNN.json（不可变）＋ locks/RNNNN.lock.json
 → 账本 contract_approval 事件（引 revision/view digest、user turn 关联、
    assurance=workflow_attested）
 → current.json 原子写（临时文件＋fsync＋rename＋父目录 fsync）
```

崩溃语义（每一步幂等可重试）：revision 已写而 lock 未写＝孤立 revision，无权威；
lock 已写而 approval 事件未写＝无权威；approval 已写而 pointer 未写＝重试只补
pointer（approval 是权威源，pointer 是镜像——采纳 finalized activation 单调语义的
简化版：v1 以最新合法 approval 事件为准，pointer 不一致时 fail closed 交
`ae-gate recover` 补写）。修订（amendment）走完全相同的事务，外加：新 revision
不继承旧 pass；门对旧 revision 事件一律标 superseded；显式兼容规则 v1 只有一条——
**逐字节相同的 proof 对象**（id、source_set、recipe、closure、required_* 全同）
可继承其 passed 状态，其余全部重新取证。
