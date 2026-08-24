# AE v1 设计文档：可执行证明闭环

> 这是 Codex 基于当前 AE 实现独立提出的 v1 设计。
> v1 的宿主是 Claude Code；v2 才讨论 Codex 移植和跨 runtime 架构。

## 1. 摘要

AE 当前已经具备完整的工程流程外形：分析、讨论、计划、TDD、逐步提交、多 Agent 评审、跨家族意见、验收证据、自动修复循环和磁盘留痕。问题不在于“还少一个阶段”，而在于它的关键保证分散在长篇 `SKILL.md` 约定中：

- 目标由 `plan.md` 生成并自动复制成 `goal.frozen.md`，但没有真实的用户锁定事件；
- 冻结文件没有摘要或变更检测，执行期可被改写；
- AC 结构与运行 recipe 仍依赖 Markdown 标题、字段和正则解析；
- evidence、verdict、loop iteration、plan status、feature state 与 archive 写入由多个 skill 分别维护；
- “谁提出、谁执行、谁判断、谁能 waive”没有形成可执行检查的职责边界；
- 多 Agent 和跨家族经常被当成质量保证本身，而不是服务于具体证明义务的策略。

v1 的中心修改是建立一个更小的真值核：

> **锁定的交付契约 + 追加式证据账本 + 可重放决策函数 + 唯一完成入口。**

Claude 与 Agents 继续承担理解、研究、实现、修复和语义判断；确定性工具只承担它能诚实回答的问题：契约是否变化、命令是否运行、事件是否完整、所有必需证明是否闭合、终态是否允许写入。

## 2. 当前实现给出的起点

### 2.1 可保留的基础

当前实现并非从零开始，已有五项值得直接保留：

1. **文件持久化优先。** Feature 固定落在 `.ae/features/{active,done,abandoned,paused}/F-NNN-<slug>/`，可跨上下文压缩和会话恢复（`plugins/ae/templates/pipeline.template.yml:4-17`）。
2. **目标与执行计划已经开始分离。** `/ae:plan` 会把 AC 复制到 `goal.frozen.md`，`/ae:review` 优先读 frozen goal，而不是 mutable plan（`plugins/ae/skills/plan/SKILL.md:371-382`；`plugins/ae/skills/review/SKILL.md:215-228`）。
3. **循环骨架已有确定性部分。** verdict 解析和 retry/cap 判断由纯脚本完成（`parse-review-verdict.sh`、`loop-decide.sh`），iteration 会从磁盘重读（`plugins/ae/skills/work/SKILL.md:536-591`）。
4. **事实与语义判断已有正确方向。** collector 记录执行事实，fresh-context reviewer 判断证据是否足以支撑 AC（`plugins/ae/skills/review/SKILL.md:215-228`）。
5. **调用面已经被用户学会。** `/ae:analyze`、`/ae:discuss`、`/ae:plan`、`/ae:work`、`/ae:review` 可以保留，只改变内部责任。

### 2.2 必须关闭的接缝

1. `/ae:plan` 的 Confirm 阶段只是展示完整计划并给出下一条命令，随后在 `status: reviewed` 时自动冻结目标；没有“用户已批准这份契约”的真实状态转换（`plugins/ae/skills/plan/SKILL.md:356-382`）。
2. `goal.frozen.md` 的 immutable 是文字承诺，不是检测机制；review 和 archive 却把它当作权威真值。
3. `check-harness.sh` 只检查确定性 AC 是否出现 `verify:` 行，并明确不判断 recipe 是否能运行或是否充分（`plugins/ae/scripts/check-harness.sh:1-26`）。
4. `collect-ac-evidence.py` 正则读取 Markdown、硬编码 parser 列表，并以 `shell=True` 运行 recipe（`plugins/ae/scripts/collect-ac-evidence.py:31-69,108-192`）。这使结构、执行和框架解析耦合在一个工具中。
5. `/ae:work` 的自动 gate 是 prompt 中的布尔表达式；无测试命令时它也明确承认只是 prompt-level hard-block（`plugins/ae/skills/work/SKILL.md:477-500`）。
6. `/ae:review` 同时判断、写 verdict、改 plan、写 graph、更新 roadmap 和移动 feature；终态投影过于分散（`plugins/ae/skills/review/SKILL.md:615-714`）。
7. 当前允许执行流程写入 `WAIVED_AC`，review 只按存在性接受 keyed waiver（`plugins/ae/skills/review/SKILL.md:221-226`）。这给执行者留下修改考试标准的通道。
8. `agent-teams` 与 `agent-selection` 共 1156 行；大量篇幅治理“谁如何说话”，但这些约定本身不能构成完成事实。

这些问题共享同一个根因：**AE 没有一个单一、可执行、可重放的完成定义。**

## 3. v1 产品承诺

对于一个进入 v1 路径的 feature，AE 必须能够回答并展示：

1. 用户批准的目标和范围究竟是哪一版？
2. 每条必需 AC 的证明义务是什么？
3. 实际运行或检查了什么，绑定哪份源码/工作树快照、什么工作目录、哪一次 attempt？
4. 哪些只是机器事实，哪些经过 LLM 充分性判断，哪些由人确认？
5. 当前哪些 proof 是 `pending / failed / invalid / unavailable / satisfied`，以及 `/ae:work` 为何据此选择下一动作？
6. 如果会话现在中断，下一次能否只靠磁盘重建同样的答案？
7. 谁授权了契约变化，哪些旧证据因此失效？

如果任一问题无法回答，系统可以继续调查，但不能宣告完成。

### 3.1 威胁模型与保证边界

v1 主要防四类工程故障：上下文压缩后的状态漂移、模型偏离长 prompt、陈旧/缺失证据被当成通过、执行者在正常工作流中无意改变验收边界。

它不是操作系统级安全边界。一个拥有当前用户全部文件权限、并且故意同时伪造 contract revision、pointer、ledger、Git 历史和 gate 程序的恶意进程，无法仅靠工作区内的 digest 被防住。同样，用户始终可以绕开 AE 手工移动文件。

因此本文中的 hard gate 精确定义为：

- 所有受支持的 `/ae:*` 完成路径都必须经过 gate；
- 角色输出只有满足 schema、revision、snapshot 和 evidence 关联时才会被 reducer 接受；
- 常见直接 Edit、stale 文件和中断恢复故障会被检测；
- 原始文件被人为强制篡改时，AE 不声称提供防恶意者的密码学证明。

Claude Code 当前也没有向插件提供一个可由 gate 独立验证的“这条回答一定来自人类”的 principal credential。`AskUserQuestion`、前台 skill 与 session trace 可以形成 **host-mediated workflow attestation**，却不是密码学身份。因此 v1 分开两种保证：

- contract、snapshot、evidence 和终态的一致性由 gate 机器强制；
- 用户批准的真实性由前台交互与可关联 trace 支撑，明确属于流程保证。若 P0 实测拿不到稳定的 host correlation，事件必须标为 `workflow_attested`，不能宣称 `host_verified`。

v1 可用 CC Agent 隔离、工具白名单、PreToolUse guard、digest、Git provenance 与 user-level trace 做分层防护，但必须把它们描述为 tamper-evident / fail-closed workflow，而不是安全沙箱或不可伪造的权限系统。

## 4. 四个核心对象

### 4.1 Acceptance Contract：正确性与批准边界

契约包含：

- 用户意图与成功结果；
- in-scope / out-of-scope；
- 不可违反的约束；
- 必需 AC；
- 每条 AC 的证明模式、通过口径、它能证明什么与不能证明什么；
- 允许的人类裁决点；
- 当前 revision 与锁定摘要。

契约不包含：

- 具体实现步骤；
- Agent 名单；
- 并行策略；
- commit 拆分；
- reviewer 数量；
- 临时 debug/spike 过程。

这些属于可调整的执行策略。

### 4.2 Execution Strategy：可变的做法

`plan.md` 是对当前策略的人类可读投影。它引用 AC ID、描述步骤、依赖和预期文件，但不复制 AC 的权威内容。

只要契约摘要未变，Claude 可以：

- 重排或拆分步骤；
- 增加测试与调查；
- 替换 Agent 或由 TL 直接执行；
- 串行化原本并行的工作；
- 放弃错误实现并重做；
- 调整非权威的实现细节。

它不能：

- 删除或弱化 required AC；
- 把 `human` 证明降为模型自评；
- 扩大用户未授权的产品范围；
- 用新的 easy recipe 替换已批准的证明口径而不触发 amendment；
- 把 unavailable 当作 pass。

### 4.3 Evidence Ledger：事实历史

证据是 append-only 事件，不是“当前最后一份漂亮报告”。每次失败、无效、不可用和通过都保留。

最小事件字段：

```json
{
  "event_id": "uuid",
  "schema_version": 1,
  "feature": "F-NNN",
  "revision": 1,
  "contract_digest": "sha256:...",
  "ac_id": "AC1",
  "proof_id": "P1",
  "attempt": 2,
  "kind": "command_result",
  "cwd": "<repo-relative>",
  "source_snapshot": {
    "head": "abcdef1",
    "source_set": ["src/**", "tests/**"],
    "manifest_digest": "sha256:...",
    "dirty": true
  },
  "started_at": "RFC3339",
  "duration_ms": 1432,
  "outcome": "succeeded|failed|invalid|unavailable",
  "payload": {
    "argv": ["pytest", "tests/unit"],
    "exit_code": 0,
    "stdout_path": "run/evidence/AC1/attempt-2.stdout",
    "stdout_digest": "sha256:...",
    "stderr_path": "run/evidence/AC1/attempt-2.stderr",
    "stderr_digest": "sha256:..."
  }
}
```

`source_snapshot.manifest_digest` 不是 HEAD 的别名：它对 proof 声明的 source set 中每个 repo-relative 路径、mode 与内容摘要做稳定序列化，因此同一 HEAD 下的 staged、unstaged 与相关 untracked 变化也会改变摘要。runner 记录执行前后快照；若 source set 在命令运行中意外变化，该 attempt 为 `invalid`。

Judge 与 human evidence 使用相同 envelope，不同 `kind/payload`。adjudication 必须引用具体 `event_id + content digest + source_snapshot digest`，不能只引用 AC ID。旧失败不能被新成功覆盖；“当前有效事件”由纯 reducer 按 revision、proof 和 snapshot 派生。Instrument 的 `succeeded` 只表示命令事实成立，不等于 AC 已通过。

### 4.4 Gate：从事实派生完成资格

Gate 不做需求理解、重试调度或代码评审，只实现完成代数：

```text
immutable contract revision + valid evidence events + bound adjudications
    → obligation status[] + finalize_eligible(true|false) + reason codes
```

只有 `finalize_eligible=true` 可以进入 `finalize`。`retry / ask-human / amend / stop` 是 `/ae:work` 根据这些事实、策略和 retry budget 做出的动作，不进入 Gate 真值。`finalize` 是唯一可提交 `done` 生命周期的入口。

## 5. 契约的版本与视图

### 5.1 Draft、不可变 revision 与 current pointer

契约不用一个可变文件冒充历史。各类文件职责如下：

```text
contract.draft.json          # 尚未批准或正在提议 amendment；可变，不参与 gate
contracts/rev-0001.json      # 已锁定的不可变规范快照；唯一契约真值
contracts/rev-0001.md        # 从该 revision 生成的人类视图；可删除重建
contracts/rev-0001.lock.json # 该 revision 的不可变摘要与批准 attestation
contract.lock.json           # 仅指向当前 immutable lock envelope
```

每次 freeze/amend 都先把 draft 规范化并原子写成新的 `contracts/rev-NNNN.json` 与对应 immutable lock envelope，再原子更新 current pointer。旧 revision、批准 attestation 与 evidence 永不覆盖。JSON 规范化固定为 UTF-8、对象 key 排序、无无意义空白，并禁止 duplicate key 与浮点数，避免同一语义产生不稳定摘要。

建议最小 revision 结构采用 discriminated proof union：

```json
{
  "schema_version": 1,
  "feature": "F-NNN",
  "intent": "...",
  "scope": {"in": [], "out": []},
  "constraints": [],
  "acceptance": [
    {
      "id": "AC1",
      "outcome": "<business outcome>",
      "consequence_if_missing": "...",
      "source": "<discussion decision or explicit user request>",
      "required": true,
      "satisfaction": "all_required_proofs",
      "proofs": [
        {
          "id": "P1",
          "kind": "command",
          "required": true,
          "criterion": "the selected tests execute and succeed",
          "proves": "...",
          "does_not_prove": "...",
          "source_set": ["src/**", "tests/**"],
          "recipe": {"argv": ["pytest", "tests/unit"], "cwd": "."},
          "assertions": [
            {"kind": "exit_code", "equals": 0},
            {"kind": "tests_executed", "minimum": 1}
          ],
          "closure": {"kind": "direct"}
        },
        {
          "id": "P2",
          "kind": "artifact",
          "required": true,
          "criterion": "...",
          "paths": ["docs/result.md"],
          "source_set": ["docs/reference/**"],
          "closure": {
            "kind": "judge",
            "fresh_context": true,
            "family": "any",
            "verdict_schema": "ae.judge.v1"
          }
        }
      ]
    }
  ]
}
```

`human` proof 以 `question`、允许的回答形态和 `closure.kind=human` 取代 recipe；需要语义审查的 command 可把 `closure.kind` 设为 `judge`。这样 command + judge 不是隐含规则，而是同一 proof 的明确闭合策略。

一条 AC 仅在所有 `required=true` proof 都满足时闭合：`direct` 由声明的机械 assertions 归约，`judge` 必须有绑定具体 evidence 的有效 verdict，`human` 必须有对应 revision 的前台交互 attestation。optional proof 不阻断完成。

自由解释、设计理由和讨论历史仍留在 analysis/discussion/plan 文档中，不塞进机器 schema。

### 5.2 Revision Markdown：单向生成的人类视图

Gate 从 `contract.draft.json` 或已锁定 revision 稳定渲染 Markdown。用户批准的是 draft view 所展示的完整内容；若用户要求修改，Claude 修改 draft 并重新渲染。Markdown 顶部明确标注“generated; edit contract through /ae:discuss or /ae:plan”，从而避免双向同步。锁定后，`contracts/rev-NNNN.md` 只是对应 JSON 的缓存视图。

### 5.3 Immutable lock envelope 与 current pointer

`/ae:plan` 在用户明确确认后调用内部工具，对规范化 draft 生成 revision 及 `contracts/rev-0001.lock.json`：

```json
{
  "schema_version": 1,
  "feature": "F-NNN",
  "revision": 1,
  "source": "contracts/rev-0001.json",
  "source_digest": "sha256:...",
  "locked_at": "RFC3339",
  "approval": {
    "actor": "human",
    "assurance": "workflow_attested|host_verified",
    "channel": "claude-code-interaction",
    "interaction_ref": "<opaque host correlator or null>",
    "view_digest": "sha256:..."
  }
}
```

根目录的 `contract.lock.json` 只含 `{revision, lock, lock_digest}`，不复制 contract 或 approval 字段。Gate 先校验 pointer 指向的 immutable envelope，再校验 envelope 指向的 revision；amendment 因而不会丢失旧版本批准记录。

执行期修改 revision 会造成 digest mismatch；更新 pointer 只能选择一个存在且 schema/digest 匹配的 revision。任何 `status`、`record`、`evaluate`、`finalize` 调用都先检查摘要。Markdown 若漂移则直接重渲染，不参与状态判断。

`approval.assurance` 不能由 gate 自证。只有 P0 实测确认宿主提供了可稳定关联且插件不能自行伪造的 user-turn credential 时才允许 `host_verified`；否则固定写 `workflow_attested` 并在 status 中展示这一边界。digest 能证明“当前内容与被记录的 revision 一致”，不能单独证明 actor 身份。

这不是双向双真值：

- Claude 根据用户意见修改 `contract.draft.json`，随后重新渲染 view 供人审阅；
- Markdown 不接受反向写回，revision 与 pointer 只能由 `freeze/amend` 生成；
- gate 通过 pointer 只消费不可变 revision；
- plan 只引用 AC ID；
- amendment 生成新 revision，并保留所有旧 revision、旧 pointer event 与变更记录。

## 6. 三种证明模式

v1 将当前 `unit / integration / e2e / contract / judge / manual` 的执行语义压缩成三类。原标签可作为 `command` 的 `scope` 元数据保留，但不再驱动六套控制流。

### 6.1 `command`

用于可由确定性进程执行的证明：单测、集成测试、e2e、lint、静态分析、jq contract、benchmark threshold 等。

Gate 记录：

- 精确 argv/cwd，不把任意 recipe 隐藏在一个获永久放行的 wrapper 后；
- 退出码；
- 原始 stdout/stderr；
- 执行前后的 source-set manifest digest、HEAD 与 dirty 标记；
- 时间与 attempt；
- recipe 声明的 non-vacuity 信号。

runner 不猜测试框架，不从输出推断“覆盖充分”。如 recipe 需要证明至少执行一个测试，**recipe 自己必须包含能 fail closed 的筛选或断言**；框架 adapter 只是可选增强。

`exit 0` 的含义严格限制为：“批准的命令在该快照退出 0”。只有 `closure.kind=direct` 且全部机械 assertion 成立时，reducer 才关闭该 proof；需要充分性判断时必须由引用该 command event 与 snapshot 的 judge verdict 关闭。

### 6.2 `artifact`

用于机器无法仅靠退出码裁定的结果：文档事实性、UI 截图、性能报告、设计一致性、迁移输出、语义质量。

契约必须声明：

- artifact 路径或 diff 范围；
- pass criterion；
- judge 必须先读的 source set；
- 输出 verdict schema；
- 是否要求 fresh-context；
- 是否要求 cross-family。

Judge 只获得契约、source、artifact 和必要代码，不获得 worker 的自评或 step summary。它返回结构化 adjudication；格式无效、source 不可达或 required receipt 缺失均为 `invalid/unavailable`，不能补写成 pass。

### 6.3 `human`

仅用于确实需要人的品味、责任、权限或现实观察。它不是“自动化没做完”的垃圾桶。

人工证据记录：

- 精确问题；
- 用户选择；
- 时间；
- 对应 contract revision 与 AC；
- 是否只确认观察，还是授权契约变化。

`work.auto_pass` 永远不能覆盖 `human`。

## 7. 职责模型

下表是受支持 AE 路径的职责约束，不是 Claude Code 提供的 per-agent ACL。Gate 通过输入关联与闭合规则拒绝不合格结果，但不能从同一用户权限域内的一个 JSON 字段证明真实 actor。

| 主体 | 可以做 | 不可以做 |
|---|---|---|
| 用户 | 批准/修改契约；确认 manual AC；授权不可逆或扩 scope 行为 | 不需要逐阶段批准普通实现 |
| TL / Session Lead | 编排、合成、调用 gate、提出 amendment | 把自己的判断伪装成机器事实；代替用户授权 material change |
| Worker | 研究、编辑、测试、生成 artifact、提出修复或 amendment 请求 | 改 locked contract；waive required AC；给自己的 artifact 作唯一终审 |
| Instrument | 运行已批准 recipe、记录可复现事实、校验摘要与 schema | 判断业务充分性；生成新的项目事实 |
| Judge | 对指定 AC 判断证据充分性；引用 source | 修改实现；修改 AC；补写缺失 evidence；把 unavailable 解释成 pass |
| Coverage guardian | 比较 Intent/Scope 与 AC 集合，指出漏项或越界 | 重新发明用户意图；自行增加 required AC |
| Finalizer | 在 gate=pass 时投影终态 | 重新做语义判断；绕过 pending/manual/invalid |

硬规则：**同一个上下文不能既生成一个 material claim，又成为该 claim 的唯一通过依据。**

## 8. 状态模型

### 8.1 生命周期与运行态分离

为兼容当前目录模型，v1 继续让 feature 所在目录表达生命周期：

- `active/`
- `paused/`
- `done/`
- `abandoned/`

另有 `run/state.json` 表达可重建的完成状态缓存：

```json
{
  "contract_digest": "sha256:...",
  "through_event_id": "...",
  "obligations": {"AC1/P1": "satisfied|pending|failed|invalid|unavailable"},
  "finalize_eligible": false
}
```

`state.json` 不包含 plan step、下一动作或 retry budget，也不是真值；删除后必须能由 revision + ledger 重建。CC Task 面板同样只是 UI，不是持久状态。

### 8.2 完成归约表

| 条件 | Gate 输出 |
|---|---|
| revision 缺失、schema 无效或 digest mismatch | hard error；`finalize_eligible=false` |
| required proof 尚无有效 evidence | `pending` |
| command 事实或机械 assertion 不成立 | `failed` |
| evidence/schema/digest 不完整 | `invalid` |
| required judge/receipt 不可用 | `unavailable` |
| human proof 无对应 revision 的 attestation | `pending` |
| coverage adjudication 指出未解决缺口 | contract-level obligation=`failed` |
| 所有 required proof satisfied 且无 invalid/unavailable/gap | `finalize_eligible=true` |

Gate 不根据 attempt cap 在 `retry` 与 `blocked` 间二选一。`/ae:work` 读取上述唯一状态，再结合配置与外部情况选择修复、重跑、询问用户、提议 amendment 或停止。

### 8.3 Amendment

任何 material contract change 必须：

1. 停止当前 loop；
2. 写明提议、原因、旧 revision 与影响的 AC；
3. 由用户明确批准或拒绝；
4. 生成新的 immutable revision + lock envelope，并原子切换 current pointer；
5. 将受影响的旧 evidence 标记为 superseded，而不是删除；
6. 重新派生状态。

只有 recipe 的无语义修复可走轻量 amendment，例如修正路径拼写但不改变证明口径；它仍生成新 revision 并留痕，但可以不重新询问用户。是否 material 由“是否改变 intent、required AC、pass criterion、proof strength、scope 或 human gate”机械预筛，边界不确定时询问用户。

### 8.4 Finalize 的稳定事务边界

finalization journal 固定放在 `.ae/transactions/F-NNN.jsonl`，不随 feature 目录移动。所有 lifecycle reader 在 enforce 前统一按 feature ID 解析 active/done 唯一路径，并以原子 rename 作为完成提交点：

```text
done := feature 只存在于 done/，且 stable journal 有匹配当前 revision/ledger digest 的 finalize_prepared
```

1. 获取该 feature 的 finalize lock，重放 revision + ledger，确认 eligible；
2. 在稳定 journal 写 `finalize_started`；
3. 生成归档审计摘要并校验目标路径不存在；
4. 写 `finalize_prepared`，包含 source/target、revision 与 ledger digest；
5. 将 feature 从 `active/` 原子 rename 到 `done/`，这是最后一个权威状态变更；
6. index、plan display 与 roadmap 只作为可重建投影，在提交后 reconcile；失败会显式报告 drift，但不会伪造或撤销完成。

崩溃在第 5 步前仍是 active，恢复后继续；崩溃在 rename 后已经具备完整 prepared journal，恢复只补投影。可选 `finalize_observed` 事件用于审计，但不参与完成定义。

## 9. Claude Code 原生实现

### 9.1 一个内部 gate CLI，不造跨 runtime Core

新增 `plugins/ae/scripts/ae-gate.py`，只用 Python 标准库，提供：

```text
validate   校验 contract schema、ID、proof、repo path 与 command 完整性
render     从 draft/revision 生成稳定的人类可读 Markdown
freeze     校验 draft，写不可变 revision、current pointer 与 digest
check      验证 pointer/revision、snapshot 与当前记录前置条件
record     追加 command/artifact/human/judge event
status     从 pointer + revision + ledger 重放每条 proof 状态
evaluate   纯函数输出每个 proof 状态与 finalize eligibility
amend      生成 revision 与 supersession 事件
finalize   eligible 时执行唯一生命周期提交
```

边界：它拥有 contract integrity、evidence integrity、decision arithmetic 和 finalization；它不拥有研究、分解、Agent 选择、代码修改或语义判断。

`check-harness.sh`、`collect-ac-evidence.py`、`parse-review-verdict.sh`、`loop-decide.sh` 先变成 compatibility wrapper；shadow mode 稳定后再删除重复实现。

### 9.2 Skill 是薄控制器

核心 skill 不再各自解析 Markdown 和拼装终态：

- 调用 gate 获取规范化状态；
- 执行自己真正擅长的 LLM 工作；
- 把结果写回 ledger；
- 根据 gate 事实与 workflow policy 选择继续、暂停或结束。

每个 skill 的前 5K token 内只保留：责任、输入、动作、硬边界、输出。长篇 Agent Teams 协议、trace 格式和重复状态机移出消费路径。

### 9.3 Agent 与 Agent Teams

使用原则：

- 普通 `Agent` fresh spawn 足以做独立 evaluator；正确性不依赖实验性的 Teams 面板。
- 互不依赖的研究和 review 使用 fan-out，可以并行也可以顺序退化。
- 只有真正需要多轮相互回应的 discuss/consensus 才使用 Agent Teams。
- `SendMessage` 是会话协调，不是 evidence transport；最终证据必须落盘。
- `TaskCreate/TaskUpdate` 只改善 CC UI，不决定 feature 状态。
- project specialist 由风险与领域需求选择；不按固定人数证明质量。

### 9.4 Hooks

新增 PreToolUse 早期守卫可阻止 `Edit/Write` 直接修改 locked contract，并给出 amendment 指引。但 hooks 不是最终安全边界：Bash 等路径可能绕过简单 matcher，且插件 hook 能力有宿主限制。

真正的 hard gate 是每次 `record/status/evaluate/finalize` 都校验 revision、snapshot 与 evidence 关联。因此：

- hook 提供快速反馈；
- digest 防止 revision 内容与 pointer/evidence 静默漂移；
- 同权限 Bash 若协调重写整套状态仍超出保证边界，不能把角色表说成宿主 ACL。

Command runner 也不是权限升级通道：contract view 展示完整 argv/cwd，调用时不得请求一个覆盖任意子命令的永久 allow rule，也不得使用关闭 CC permission/sandbox 的选项。Gate 记录命令事实，但不宣称替代 Claude Code 的命令授权。

### 9.5 Cross-family

v1 不移植到 Codex。Codex 保持现有 `codex mcp-server` proxy seat：

- 可为高风险 artifact 或 self-authored fact claim 提供独立 judge；
- 不参加每个阶段的固定仪式；
- backend 不可用、receipt 缺失或 relay contract 无效时记 `unavailable/invalid`；
- 契约若要求 cross-family，缺席就转人或 blocked；若不要求，fresh-context Claude judge 可完成语义判断。

Gemini 和 OpenAI-compatible seat 遵循相同 evidence contract。family 是 evaluator 供给属性，不是第二套质量路径。

## 10. `/ae:*` 职责重划

### `/ae:analyze`

- 只产出事实、约束、风险和来源锚点；
- 不写 AC verdict；
- 结论区分 observed / inferred / unknown；
- 结果可被 contract draft 引用，但不自动成为契约。

### `/ae:discuss`

- 复杂任务的主要 contract drafting 场所；
- 对 Intent、scope、AC completeness 和 human-owned choices 做多方讨论；
- 输出 `contract.draft.json` 及生成式 draft view，不锁定；
- coverage guardian 在结论后做一次需求→AC 反向检查。

### `/ae:plan`

- 若没有 contract draft，为简单任务创建最小草案；
- 把 proof obligation 具体化为可运行 recipe / artifact / human question；
- 生成只引用 AC ID 的 `plan.md`；
- plan review 检查可执行性、依赖与证明强度；
- 向用户展示 contract diff 和证明映射，并要求一次明确批准；
- 仅批准后调用 `freeze`，未批准保持 draft。

### `/ae:plan-review`

- 审执行策略，不替用户批准契约；
- 可提出 contract amendment，但不能静默落地；
- Agent Teams 不可用时可顺序调用 fresh Agent，输出低并发但同语义结果。

### `/ae:work`

- 从 gate 读取当前未闭合 AC 和允许动作；
- 执行 plan，但 plan 可在契约内调整；
- 对 command proof 调 runner，对 artifact 写文件并请求 judge；
- 所有 attempt 追加 ledger；
- 不解析 `notes.md` 决定 waiver，不手写 `status: done`；
- 到 cap 时分类“策略错误 / 证据不可得 / 契约错误 / 外部 blocker”。

### `/ae:review`

- 验证 Intent→AC 覆盖是否完整；
- 对 command proof 判断充分性，而不重复扮演命令 runner；
- 对 artifact 按 rubric 与 source-first 协议评判；
- 记录 adjudication events；
- 调 `evaluate`，不能自己把 feature 归档；
- gate=pass 后调用唯一 `finalize`。

### 导航与知识技能

`dashboard/status/next/roadmap` 读取 gate 派生状态，不各自用不同 grep 推断生命周期。知识图谱在 v1 不扩建；只允许通过 pass feature 的有来源经验进入知识候选，且知识不得成为 completion gate。

## 11. 人类中断策略

只在五类事件中打断人：

1. material contract amendment；
2. manual AC；
3. 不可逆、安全敏感或超出既有授权的外部动作；
4. coverage guardian 发现“需求没有 AC”，需要决定补 AC 还是确认 out-of-scope；
5. retry cap 后仍无法收敛，需要改变策略或目标。

不会因为以下事项打断：

- 普通步骤完成；
- reviewer 意见可由既有 contract 明确裁决；
- 实现内部重排；
- 可逆的本地代码修改；
- 独立任务由并行退化成串行。

## 12. 降级语义

降级必须改变 capability state，而不能只打印 warning 后继续声称 full：

| 缺失能力 | 允许行为 | 禁止行为 |
|---|---|---|
| Agent Teams | 串行 Agent / TL 执行；discussion 可提示协作质量下降 | 把 solo monologue 标成 multi-party consensus |
| Codex/Gemini | fresh-context Claude judge，若 contract 未要求跨家族 | 对 required cross-family AC 记 pass |
| 任一 judge | command evidence 可继续积累 | 完成 artifact AC |
| test command | 只执行 artifact/human AC；或补 recipe | 把 deterministic AC 记 verified |
| hook | 依赖 digest gate 继续保护 | 声称实时写保护仍在 |
| trace/Task UI | 核心流程继续，状态从 ledger 重建 | 用 UI 状态替代 ledger |

## 13. 兼容与迁移

### 13.1 用户调用面

- 保留现有 `/ae:*` 名称；
- 保留 `pipeline.yml` 现有主要字段；
- `ceremony` 逐步变成策略 preset，不影响契约完整性；
- v1 不要求用户学习新的总入口。

### 13.2 新 feature

全部走 `contract.draft.json + contracts/rev-NNNN.json/.md/.lock.json + contract.lock.json + run/events.jsonl`。

### 13.3 在途 feature

采用 migrate-on-touch：

1. 若存在 `goal.frozen.md`，生成 `contract.draft.json` 与人类视图，并保留原文来源；
2. 不自动宣称用户批准；
3. 在下一次 `/ae:work` 前显示 diff 并要求锁定；
4. 旧 evidence 作为 imported/unadjudicated events，不自动算 pass；
5. 历史 done feature 不批量迁移。

### 13.4 旧 skill 与脚本

先 wrapper、再 shadow、后删除：

1. 旧路径继续工作；
2. 同时记录旧 verdict/action 与新 gate obligation status/eligibility 的差异；
3. dogfood 证明新路径 fail-closed；
4. enforcement 切到新 gate；
5. 删除重复解析器和 prose-shape checker。

## 14. 设计决策

### D1：v1 的本体是 Proof Loop，不是阶段

阶段可以保留为用户心智模型，但“完成”只由 contract + evidence + gate 定义。

### D2：Contract 是唯一验收真值，Plan 可变

防止执行者通过改 plan 移动目标，也允许遇到现实后调整做法。

### D3：JSON 是唯一真值，Markdown 是生成视图

不让脚本继续解析自由散文；用户通过生成的 Markdown 审阅，gate 只读规范化 JSON 与 lock。

### D4：事件账本追加，状态可重放

失败不能被覆盖，compaction 和重启不能改变结论。

### D5：完成只有一个写入口

review 可以判断，只有 finalizer 能投影 `done/archive/roadmap`。

### D6：证明模式按运行语义分三类

unit/integration/e2e 是 test scope，不值得复制控制流；command/artifact/human 才决定谁执行、谁判断。

### D7：Agent 独立性按职责而不是数量

fresh-context 是默认下限，cross-family 是按 contract/risk 请求的更强供给；固定五人队不是完成条件。

### D8：Agent Teams 是交互策略

Debate/consensus 可需要 Teams；独立 review 和纯确定性任务不应因 Teams 不可用而失去正确性。

### D9：知识层不进入 v1 核心

先证明单个 feature 可以可靠完成，再讨论经验复用。v1 只阻止未验证知识成为 gate，不扩建图。

### D10：v1 gate 不是未来 Core API

它允许使用 CC 的路径、Git 和插件约定。v2 移植时从已经工作的语义中提炼 adapter，而不是现在猜接口。

## 15. 风险与反制

| 风险 | 反制 |
|---|---|
| 坏 AC 被精确执行 | contract drafting 质量检查；coverage guardian；source/proves/does-not-prove 字段 |
| JSON 与 Markdown 漂移 | 单向编译、digest check、禁止双向编辑 |
| gate CLI 膨胀为工作流引擎 | 明确不拥有 research/decomposition/agent selection/editing/judgment |
| 伪造 judge evidence | fresh-context、source-first、结构化输出、必要时 cross-family/receipt；诚实标注保证边界 |
| contract write guard 可绕过 | hook 只做 UX；所有关键入口重算 digest |
| 历史 feature 迁移成本 | migrate-on-touch，不批量改历史 done 数据 |
| 双轨期复杂 | shadow mode 有明确期限和删除门，不长期维护两套真值 |
| 添加新 machinery 与“精简”矛盾 | 新增一个真值核后必须删除多个重复 parser/gate；以机制净减少验收 |
| 用户确认过多 | 只锁 contract 与 material amendment，不逐阶段确认 |

## 16. v1 成功的判断

v1 不是“所有计划项都做完”，而是以下命题都被真实证明：

1. 已锁定 revision 相对 current pointer 或既有 evidence 的任何漂移都会阻断 record/evaluate/finalize；
2. 每个 done feature 都能显示完整 AC→evidence→adjudication 链；
3. stale verdict、零测试、缺 artifact、无 receipt、manual 未确认和提前 archive 都 fail closed；
4. 中断后只靠磁盘可重放相同状态；
5. 纯确定性 feature 在 Agent Teams 和跨家族都不可用时仍能完成；
6. 要求独立判断的 feature 在该能力缺失时不会伪装成完成；
7. 人类中断只发生在授权、manual proof 或 material amendment 边界，而不是每个流程阶段；
8. 新 gate 成为真值后，旧的重复状态机、parser 与形态检查器被实际删除。

详细的测试矩阵与数值发布门见 [`acceptance-and-evaluation.md`](acceptance-and-evaluation.md)。
