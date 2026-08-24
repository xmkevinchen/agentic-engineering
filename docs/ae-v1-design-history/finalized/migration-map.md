# 当前 AE → 1.0 迁移地图

> 事实快照：2026-08-23 · 当前插件 0.14.2 · 本机 Claude Code 2.1.231

本文件描述现状与修改面，不为旧行为赋予目标规范权威。宿主行为会漂移，实施时必须重新运行 P0 capability matrix。

## 1. 当前实现规模

| 表面 | 当前数量 |
|---|---:|
| Skill `SKILL.md` | 24 / 8214 行 |
| Agent 定义 | 19 / 1993 行 |
| 顶层 runtime scripts | 35 |
| shell 机制测试 | 61 |
| assertion 文档 | 188 |
| 自有 MCP bridge | Gemini + OpenAI-compatible；另调用 Codex MCP server |

插件 manifest 当前只有 `SessionStart` 与 `SessionEnd` hooks，见 [`plugin.json`](../../../plugins/ae/.claude-plugin/plugin.json)。没有 Dynamic Workflow declaration。

这些数字用于理解迁移表面，不是 v1 成功指标。

### 1.1 Bootstrap validation defect

本机实跑 `claude plugin validate plugins/ae` 失败：`think/plan/review/work/discuss` 五个核心 Skill 的 `SKILL.md:3` 与 `agents/workflow/gemini-proxy.md:10` 均为 YAML frontmatter parse error。已定位共因是 Skill `description` 中未引号保护的第二个冒号，以及 gemini-proxy 未引号的 `probe: [...]` 文本；CC 会以空 metadata 静默加载，令声明的 model/tools/effort 不生效。本仓现有 `check-declared-vs-effective.sh` 没拦住该失败。P0 必须先做只修语法/保持 intended 字段的 bootstrap repair，并加入这两个具体 malformed fixtures；验证全绿后再采 intended-behavior baseline，修复前 effective behavior 单独留档。

这同时使旧 E3 的“sonnet 服从、haiku 被密度挤掉”因果归因作废：两臂实际是完整配置与空 metadata 的对比。修复后必须用 `同模型×定义有效/失效` 与 `有效定义×实际 host-attested model/profile` 的受控双轴重测；此前记录只证明 backend 未达时的诚实自报 UX，不证明模型档位顺序或 prompt 密度阈值。

### 1.2 Finalizer primitive seam

本轮终审补测：本机 Darwin/arm64 的 Node v22.23.2 中 `fs.constants.RENAME_NOREPLACE` 不存在，普通 `fs.rename` 也没有 no-replace flag。现有plugin tree没有可直接承担atomic no-replace+parent fsync的资格化helper。因此P0.G必须先做最小native/external primitive PoC，分别资格认证directory publication（origin/finalizer）与file publication（migration marker/rollout lock）的source/build/capability digest；`open final then write`或`exists→rename`都不能替代，任一所需能力失败就不得在该平台enforce。

### 1.3 Active release seam

[Claude Code官方插件文档](https://code.claude.com/docs/en/plugins-reference#plugin-caching-and-file-resolution)说明每个插件版本使用独立cache目录，旧版本更新后会先标为orphaned并约在14天后的后台清理，已加载session在`/reload-plugins`前继续使用旧root。故当前实现没有可直接把“被调用的launcher/`${CLAUDE_PLUGIN_ROOT}`”升级为project authority的机制：完整旧root可被执行且仍能自证自身bytes。P0.G必须资格认证host/package active-release provider与不回传caller的operation capability；双rootA/B、旧session/reload/fresh与direct core import全矩阵未通过前，所有authority mutation不可发布。官方路径变量只作观测输入，不是current-release证明。

### 1.4 Cutover identity defect

当前production tree同时存在：

- `.ae/features/active/F-082-agent-orchestration-conventions`
- `.ae/features/done/F-082-agent-orchestration-conventions`

这是同一normalized feature ID跨live/done集合重复，不可由converter自动猜测哪一份是真相，也不能在本次文档工作中移动、删除或合并。Rollout candidate必须把它报告为global partition blocker，由人对两棵tree及历史来源做显式disposition；处置完成并由两次全量scan证明ID/path均唯一前，final lock不可发布。

## 2. 当前主链

```text
/ae:analyze
  → analysis.md

/ae:discuss
  → Frozen User Question / framing / council / Doodlestein / conclusion

/ae:plan
  → plan.md
  → agent review
  → 自动复制 Acceptance Criteria 到 goal.frozen.md

/ae:work
  → dev mutation + QA/review
  → notes.md: LOOP_ITER / LOOP_FINDINGS / WAIVED_AC / UNVERIFIED_AC
  → review.md verdict

/ae:review
  → 再读 goal.frozen.md + evidence files + diff
  → 写 canonical review.md verdict
  → 直接 mv active|paused → done

dashboard / status / next
  → 再从目录、index、plan、review 推断生命周期
```

### 2.1 当前已有的正确基础

- feature 使用 active/paused/done 目录表达生命周期；
- `goal.frozen.md` 已表达“目标应独立于可变 Plan”的正确意图；
- work 已接近一个开发写者 + 只读 QA/验证 seats；
- tests、review、cross-family、trace 与恢复已有大量 failure knowledge；
- `.ae/` 数据可持久化，Git 可提供代码 provenance；
- Codex/Gemini/OpenAI-compatible MCP 路径已经存在。

### 2.2 当前必须关闭的 seam

| Seam | 当前事实 | 1.0 替代 |
|---|---|---|
| Goal authority | plan 自动复制，缺真实人类 lock | Contract draft→human approval→revision/lock/pointer |
| Waiver | executor 写 notes 即可能改变 review | 只有 human-approved amendment/human proof |
| Evidence | collector failure 可被 prose review 绕过 | canonical runner/event/reducer |
| State | notes/review/index/Task/dir 多份推断 | active/paused：Ledger + live Gate；committed：journal + at-commit evidence snapshot projection |
| Review | reviewer 同时 judge、reducer、finalizer | per-proof judge events；Gate reduce；唯一 finalizer |
| Source snapshot | HEAD/散文范围不统一 | Contract-declared manifest digest |
| Cross-family | proxy 自述与 provider assurance 不对称 | family lineage + backend invocation attestation |
| Team | 固定 roster、旧 tool 语义、hard block | live host snapshot + minimal topology |
| Judge delivery | result prose/role 与真实 dispatch 之间缺少单次授权闭环 | deterministic Seat renderer + dispatch/raw-result/verdict/token equality |
| Project floor | 被选中的 floor 可绑定，但无 closed catalog 的逐项处置 | bundle catalog + bound/N/A adjudication；proposal 只影响未来 bundle |
| Knowledge | 写入健康，不测读取收益 | completion 解耦 + optional read-hit telemetry |

## 3. 已复核的具体失败

### 3.1 Contract 没有真实人类确认

[`plan/SKILL.md`](../../../plugins/ae/skills/plan/SKILL.md) 在 agent review 后生成 `goal.frozen.md`；[`review/SKILL.md`](../../../plugins/ae/skills/review/SKILL.md) 把它描述为 plan approval 时冻结，但主链没有可靠的 approval event。

F-082 的 frozen goal 仍含 AC10，而最终 review 声称该 AC 经用户决定移除并给 pass。这是 `revision + approval + amendment` 的现成 regression fixture。

### 3.2 Collector 失败但 review 仍 pass

[`collect-ac-evidence.py`](../../../plugins/ae/scripts/collect-ac-evidence.py)：

- `KNOWN_PARSERS` 硬编码三类；
- Markdown 反引号未形成可靠 argv；
- 使用 `shell=True`；
- 缺 timeout、cwd root、env allowlist、network/credential 与 output cap；
- unknown parser/zero match 可失败，但 review prose 仍可能给全局 pass。

因此 v1 不能只“修 parser”，而要替换整个 truth path。

### 3.3 完成状态散落

- [`work/SKILL.md`](../../../plugins/ae/skills/work/SKILL.md) 内嵌 auto-pass 与 `LOOP_ITER/LOOP_FINDINGS`；
- [`review/SKILL.md`](../../../plugins/ae/skills/review/SKILL.md) 写 verdict 并直接归档；
- [`dashboard/SKILL.md`](../../../plugins/ae/skills/dashboard/SKILL.md) 与 [`next/SKILL.md`](../../../plugins/ae/skills/next/SKILL.md) 分别重新解释完成态。

Pure reducer 与 reader cutover 是核心迁移，不是额外抽象。

## 4. Claude Code 宿主漂移

### 4.1 Agent Teams

当前官方行为：

- Teams 是实验能力，默认关闭；
- 当前官方 Team 模型中 eligible named Agent 可成为 teammate，但实际 binding 还受 interactive/`-p`/SDK、isolation/fork/background 影响；
- ordinary subagent 返回 result，teammate idle notification 不返回 output；
- 一个 session 一个隐式 Team；resume 不恢复 in-process teammates；Task 状态可滞后；
- `TeamCreate/TeamDelete` 自 v2.1.178 起不存在；`team_name` accepted-but-ignored。

当前仓库一方面已写“session implicit team/自动清理”，另一方面仍在 [`agent-teams/SKILL.md`](../../../plugins/ae/skills/agent-teams/SKILL.md) 与 [`cc-plugin-contract.md`](../../../docs/references/cc-plugin-contract.md) 保留 `TeamDelete`/live tool 语义。

[`check-agent-teams.sh`](../../../plugins/ae/scripts/check-agent-teams.sh) 还把环境变量任意非空值视为 enabled，可能将 `0` 误判为开启。

迁移结论：

- ordinary return-only fan-out 使用 live probe 已证明为 ordinary-subagent 的 anonymous request；
- named Agent 只在明确 Team binding 时使用；
- dispatch 前记录 live state，不把静态配置等同 capability；
- 产品语义不绑定 TeamCreate/Delete/tool name。

[官方 Agent Teams](https://code.claude.com/docs/en/agent-teams)

### 4.2 Dynamic Workflow

当前插件没有 `workflows/`。引入 workflow 会新增 acceptEdits、partial result、resume、无 mid-run human、recorder 与 truth mapping 表面。因此 finalized v1 明确不发布，不把它作为现有多 Agent prose 的替代捷径。

[官方 Dynamic Workflows](https://code.claude.com/docs/en/workflows)

### 4.3 Hooks 与 `/goal`

当前 plugin hooks 只有 SessionStart/SessionEnd。v1 可增加 PreToolUse/Stop/TaskCompleted 等 defense-in-depth，但 hook 的 Task/stop 决策与 telemetry 都不是 evidence，必须经过 canonical recorder。

`/goal` evaluator 只看 conversation 中呈现的内容，不能独立读文件或运行命令；只适合作为 continuation UX。[官方 Goals](https://code.claude.com/docs/en/goal)

## 5. Cross-family 当前 assurance

| Seat/provider | 当前能力 | 1.0 计法 |
|---|---|---|
| Codex MCP | 可返回 thread/rollout 线索，并有 host/MCP 调用记录 | 实测可关联时 `backend_correlated` |
| Gemini proxy | 明确无不可由 proxy 自写的 backend receipt | 最多 `host_recorded`，除非新增 correlator |
| OpenAI-compatible | response ID 不自动证明 host↔backend 关联；当前 `family` 是 caller input | 按实际 adapter/log + locked lineage registry，不按 ID/请求标签升级 |

Model family 由 weight lineage 计算；endpoint/provider/实例名不同不自动构成 family independence。需要 `backend_correlated` 时，不可关联 seat 必须 `unavailable`，不能由 Claude fallback 后仍称 cross-family。

Gemini/OpenAI-compatible bridge 位于本仓，可在桥内增加 keyed correlator record，但必须绑定不可由 seat 填写的 invocation ID、input digest、output digest、tool/model identity 与 adapter build；只记时间戳或按时间窗猜配对不升级 assurance。该实现进入 P2.7，成功前仍按上表保守计级。

## 6. 当前对象到 1.0 对象

| 当前对象/行为 | 1.0 对象 | 迁移策略 |
|---|---|---|
| `plan.md` AC | Contract draft | converter + human confirmation |
| `goal.frozen.md` | immutable revision/view | migrate-on-touch；不再是 machine truth |
| new/legacy feature 的起点 | canonical genesis + Contract-bound seed | new由external journal+sibling tree原子发布；legacy由lock+双marker经migration journal/commit marker发布，v1一律complete historical-universe conservative seed；current HEAD/mtime/prose不能自报pre-mutation base |
| `verify_by` 六类 | proof mode + command scope | unit/integration/e2e/contract 归 scope |
| evidence JSON | canonical event payload | 旧文件保留，不自动 adjudicate |
| `notes.md` loop fields | attempt + diagnosis events | 新 feature 禁止作 truth |
| `review.md.verdict` | judge events + summary projection | summary 保留人读，不参与 reducer |
| Task/Team status | dispatch telemetry | 永不闭合 proof |
| direct `mv .../done` | transaction finalizer | v1/new 禁止；仅 rollout manifest 精确命中的历史 done 只读 grandfather |
| dashboard/next inference | draft/live/committed/legacy-readonly closed status | genesis-only=`draft_unactivated`；active/paused读Gate；v1 done读commit snapshot；manifest legacy done只走`legacy_readonly` adapter；不以散文/未来source重算 |
| family proxy report | seat result + backend invocation + judge verdict | 三者分离 |
| escaped defect / floor idea | non-authoritative proposal → `policy_extension_release` 单-floor artifact | exact digest 经 human proof；未来 Contract opt-in + 本地快照，不是全局 promotion |
| `.ae/graph` | non-blocking knowledge lane | 保持路径兼容，不重命名 |

## 7. 文件修改面

### 7.1 新增核心

- `plugins/ae/release-manifest-v1.json` + `plugins/ae/runtime/{ae-gate,ae-gate-core,active-release-bridge,validators-v1}.mjs`：manifest无self-digest；bootstrap先验证embedded digest与全部installed members，之后才import verified bridge取得host-active attestation并mint绑定actual bootstrap result的operation capability，最后core每个mutation export重验；runtime identity记录launcher/core/validator
- `plugins/ae/schemas/{contract,event,judge,seat,status,source-manifest,input-manifest,tree-snapshot,floor-applicability,execution-environment,product-delta,lease,release-manifest,policy-bundle,policy-extension,runner-policy,adapter-registry,lineage-registry,floor-policy,cc-tool-mapping,renderer-registry,qualification-result,shadow-epoch,origin-marker,migration-commit,rollout-approval,contract-lock,current-pointer,legacy-done-manifest,legacy-live-manifest,legacy-reserved-manifest,rollout-lock,transaction}-v1.schema.json`；每个external authoritative JSON独立closed validation，candidate/coverage/judge/human subject是named closed `$defs`；`floor-proposal`在P4.9另交付且不属G0 authority
- `plugins/ae/native/ae-fs-commit/` 的 pinned source/build manifest与per-platform qualification artifacts；Gate runtime identity绑定helper digest
- `plugins/ae/policies/{bundle,runner,adapters,lineage-registry,cc-tool-mapping,renderer-registry}-v1.json`、`plugins/ae/policies/renderer-bundles/<digest>/`、`plugins/ae/policies/qualifications/{active-release,filesystem,isolation,cc-tools,renderers}/<digest>.json`与floors；provider/helper/tool mapping/renderer逐项绑定passed result与exact compatibility selector，authoritative view只执行registry命中的snapshot bytes
- `ae-gate init|draft` no-clobber物化的`.ae/policies/**` base snapshots；rollout/base Contract、Seat、input与dispatch通过bundle/per-file digest引用并在live probe重验；Contract另可验证prior `policy_extension_release`的human-proof/finalized/journal origin并复制为本feature `contract/policies/extensions/<digest>/` snapshot
- Candidate起草前把host-active+bootstrap verified release manifest no-clobber快照到feature `authority/releases/<digest>.json`；current candidate逐次重验active capability，已activation/committed只按local snapshot+compatibility replay，不回读旧cache
- Contract activation与每次Gate/finalize的project product manifest覆盖closed repo-wide universe（固定排除v1 control stores），而非只扫declared roots；roots只是human-approved allowed subset。任一activation后boundary外delta即invalid，static Edit/Write先拦，Bash/MCP/descendant/unattributed写由全局pre/post snapshot捕获
- `plugins/ae/tests/fixtures/proof-loop/**`
- `plugins/ae/tests/scripts/test-ae-gate-*.sh`
- `.ae/transactions/` 的durable repo lease、stable feature lock、finalize journal，`.ae/transactions/origins/<feature-id>/OP-<idempotency>.json` origin-publication journal、`.ae/transactions/migrations/<feature-id>/OP-<idempotency>.json` migration-genesis journal，以及`.ae/transactions/rollout/CUT-*/{prepared-core.json,journal.json}` rollout immutable core + PREPARED→PUBLISHED|ABORTED anti-rollback witness；new origin由完整sibling staging tree move发布，existing legacy由逐项exact metadata后最后atomic commit marker发布
- `.ae/rollout/candidates/CUT-*/` 的inert done/live/reserved三manifest与safe view、`.ae/rollout/approvals/<digest>.json` foreground approval、`.ae/rollout/live-origins/**` path-independent双marker、最终`.ae/rollout/v1.lock.json`；guard/drain与全局partition通过后先发布immutable prepared core/PREPARED journal，再以lock作唯一不可逆enforce commit并seal PUBLISHED witness。Reader/guard联合验证lock+journal/core；PREPARED+lock触发只许status/recover/seal的全局barrier，PUBLISHED+matching lock才开放healthy enforce；任一单witness丢失、mismatch或多receipt全局fail closed，receipt不构成第二mode authority

### 7.2 必改 Skill

| Skill | 主要变化 |
|---|---|
| `plan` | origin genesis/seed、candidate generation、semantic-key coverage、AskUserQuestion safe-view delivery、lock/activation/pointer、AC+proof refs |
| `plan-review` | 独立 coverage/proof executability，不批准 Contract |
| `work` | Gate obligations、durable repo writer lease、runner、attempt/diagnosis；pause/resume改调专用logical lifecycle endpoint，绝不move目录 |
| `review` | proof manifest、fresh judge events；删除全局 reducer/finalizer |
| `status/dashboard/next/retrospect` | 先判global rollout：无lock/witness仍走production旧reader，recovery/integrity全局阻断；仅healthy lock+PUBLISHED后，active/paused再判migration journal/marker：nonterminal recovery、PUBLISHED→v1 draft/live Gate、locked un-migrated→temporary prose；v1 done committed，manifest legacy done永久legacy_readonly adapter |
| `discuss/consensus` | Team 只留 peer exchange；结论仅作 draft 输入 |
| `agent-selection/agent-teams` | live host state、anonymous vs teammate、最小 decision table |
| `setup` | 新 schema/policy/rollout 初始化与宿主 probe |

### 7.3 Agent/Provider

- 通用 agent definitions 保留稳定职责，项目事实进入 `ae.seat.v1`；
- review agents 输出一个 proof question 的 judge schema；
- proxies 输出 transport result，自述只作 UX；
- MCP bridge/host logger 生成可关联 `backend_invocation`；
- QA/research seats 默认只读；一个 dev seat 拥有 product mutation right。

### 7.4 Hooks/配置/文档

- P1 必须增加PreToolUse/PostToolUse host recorder、read-only/tool-policy与durable lease guard；静态write path检查boundary，所有write-capable operation前后生成project-wide product snapshot；Stop/TaskCompleted trigger后续扩展；
- `pipeline.yml` 增加 proof floor digest、runner policy 与 rollout；
- `docs/references/cc-plugin-contract.md` 更新 current Agent/Team semantics；
- README 明示兼容面、assurance 与非目标；
- 真实 L3 tests 记录 CC version，不用文本 assertion 冒充 behavior。

## 8. 删除与保留

### 8.1 替代闭合后删除

本节只收录已通过真实 reader/producer 导航确认的 `verified_read` 项；仅由名称、grep 或形态推断的项标 `inferred_pending_audit` 并留在条件删除。`verified_read` 只表示调用/保护链已真实导航，**不等于 delete-ready**；每项仍须先有 property map、历史 failure fixture 与替代 mutation test。

- `collect-ac-evidence.py`；
- `parse-review-verdict.sh`；
- `check-proxy-residual.sh` 及 F-082 ghost baseline；
- 新/迁移 feature 对 `goal.frozen.md`、notes、review verdict 的 machine-truth 读取；
- review 已确认的直接归档；
- dashboard/next 的散文状态推断。

### 8.2 条件删除

`check-harness.sh` 与 P5.3 后续发现、但尚未逐一导航确认的其他 done writers 标 `inferred_pending_audit`。Cast、shutdown、declared-vs-effective、family reachability、relay attestation、trace、risk-floor 与 graph 脚本也只能按 property map 逐个删除。它们有的仍在保护 Contract 可执行性或 host/provider drift；“形态匹配”不是足够的删除理由。

### 8.3 保留

- `ae-run-tests.sh` 回归入口；
- `verify-contract.sh` 作为可被 recipe 调用的工具；
- MCP bridges/proxies；
- `.ae/graph` 与 knowledge-refresh 的兼容路径。

## 9. 明确不从当前实现继承

- plan 自动 freeze 被称为用户批准；
- executor 可写 waiver；
- review prose 覆盖 collector failure；
- fixed reviewer/Doodlestein/Team roster 代表质量；
- cross-family fallback 仍计 required family；
- Team/Task/mailbox 作为完成状态；
- `TeamCreate/TeamDelete` 语义；
- graph rename 与 read hit 作为 1.0 发布硬门；
- 只靠 grep 某句话存在就声称运行时保证成立。

## 10. 迁移完成标志

迁移不是“新 Gate 文件存在”，而是：

- new/migrated feature 只有 current Contract revision 定义考题；
- 所有 proof 通过 canonical event/reducer；
- navigation readers 不再二次解释 prose；
- 生产 done 入口只有一个；
- legacy 路径有到期 disposition；
- 被删机制保护的历史 failure 仍被新测试捕获。
