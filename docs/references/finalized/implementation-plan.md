# AE 1.0 最终实施计划

> 依赖驱动 · Claude Code 插件内实现 · 2026-08-22

## 1. 交付原则

实施不是把全部底层件横向造完，再在最后一次性接入。每个阶段都交付一条可 dogfood 的纵向结果：

```text
P0 先修 metadata bootstrap，再量与冻结语义（不引入 v1 truth 行为）
 → P1 安全 command proof 的 shadow 纵向切片
 → P2 完成 Contract/Artifact/Human/Judge/Instruction 边界
 → P3 接管 Work/Review/Finalize 并进入 enforce
 → P4 扩展 CC Host Binding、收敛 Pattern Policy
 → P5 migrate-on-touch、逐项删除旧真值
 → P6 dogfood、稳定使用与发布
```

只有两条不可交换：

1. runner 安全边界必须先于执行 agent-authored recipe；
2. 破坏性删除必须晚于 enforce、reader cutover 和替代 mutation test。

### 1.1 两类退出条件

- `〔能〕`：受控 fixture/live test 至少证明机制能工作；
- `〔常〕`：连续三个正常 AE-on-AE feature 自然使用该路径，不是为过门专门安排。

1.0 发布要求所有适用 `〔常〕` 条件通过。

### 1.2 工作量

- **S**：一次小型实现/测试会话；
- **M**：一个独立 feature；
- **L**：跨多个核心 skill、需要单独 Contract 的 feature。

### 1.3 单人实施主线与支持面

首发按一个 integration owner、一个 active implementation work package（WIP=1）推进；并行只用于只读审计、独立 fixture 设计和不重叠 artifact，不能同时改 Contract/reducer/recorder/finalizer 语义。每个 work package 必须交付可运行纵向 artifact、至少一个对应 fault injection，以及对被替代旧机制的 `delete|retain|pending-audit` disposition，不能只提交接口空壳。

里程碑按可验证能力而不是日历估算：P1 后首次 shadow；P3 完成 reader/finalizer cutover 后首次 enforce；P4/P5 关闭 host、policy 与 legacy seam；P6 才发布。首发平台、provider 和 Pattern 支持面可以主动收窄，但**所有已发布路径**必须通过同一 G0–G7、F/AP 与 crash/replay 正确性门；不能用“1.0.0 hard-gate 子集”把 activation、product delta、JCS、lease、lineage 或 legacy 判别延期。

## 2. 目标实现形态

v1 不创建 daemon、服务或通用 orchestrator。一个本地 Gate 程序承担 truth plane：

```text
plugins/ae/
├── release-manifest-v1.json          # closed installed release root；无self-digest
├── runtime/
│   ├── ae-gate.mjs                   # bootstrap：embedded expected manifest digest + validator
│   ├── ae-gate-core.mjs              # manifest-bound Gate core；不可standalone调用
│   ├── active-release-bridge.mjs      # host/package active root attestation；不向caller返回bearer
│   └── validators-v1.mjs            # pinned Ajv standalone build；运行时不下载依赖
├── native/
│   └── ae-fs-commit/                 # pinned source/build manifest；qualified per-platform helper
├── schemas/
│   ├── contract-v1.schema.json
│   ├── event-v1.schema.json
│   ├── judge-v1.schema.json
│   ├── seat-v1.schema.json
│   ├── status-v1.schema.json
│   ├── source-manifest-v1.schema.json
│   ├── input-manifest-v1.schema.json
│   ├── tree-snapshot-v1.schema.json
│   ├── floor-applicability-v1.schema.json
│   ├── execution-environment-v1.schema.json
│   ├── product-delta-v1.schema.json # closed pre_activation_seed|post_activation union
│   ├── lease-v1.schema.json
│   ├── release-manifest-v1.schema.json
│   ├── policy-bundle-v1.schema.json
│   ├── policy-extension-v1.schema.json
│   ├── runner-policy-v1.schema.json
│   ├── adapter-registry-v1.schema.json
│   ├── lineage-registry-v1.schema.json
│   ├── floor-policy-v1.schema.json
│   ├── cc-tool-mapping-v1.schema.json
│   ├── renderer-registry-v1.schema.json
│   ├── qualification-result-v1.schema.json
│   ├── shadow-epoch-v1.schema.json
│   ├── origin-marker-v1.schema.json
│   ├── migration-commit-v1.schema.json
│   ├── rollout-approval-v1.schema.json
│   ├── contract-lock-v1.schema.json
│   ├── current-pointer-v1.schema.json
│   ├── floor-proposal-v1.schema.json
│   ├── legacy-done-manifest-v1.schema.json
│   ├── legacy-live-manifest-v1.schema.json
│   ├── legacy-reserved-manifest-v1.schema.json
│   ├── rollout-lock-v1.schema.json
│   └── transaction-v1.schema.json
├── policies/
│   ├── bundle-v1.json
│   ├── runner-v1.json
│   ├── adapters-v1.json
│   ├── lineage-registry-v1.json
│   ├── cc-tool-mapping-v1.json
│   ├── renderer-registry-v1.json
│   ├── renderer-bundles/<digest>/
│   ├── qualifications/
│   │   ├── filesystem/<digest>.json
│   │   ├── isolation/<digest>.json
│   │   ├── active-release/<digest>.json
│   │   ├── cc-tools/<digest>.json
│   │   └── renderers/<digest>.json
│   └── floors/
│       └── code-regression-v1.json
├── tests/
│   ├── fixtures/proof-loop/
│   ├── scripts/test-ae-gate-*.sh
│   └── live/cc-host/
├── hooks/
│   └── ... tool-policy + host recorder ...
└── skills/
    └── ... thin controllers ...
```

上树是 plugin release source，不是 Contract 的运行时 ref root。`ae-gate init|draft` 必须把当前所需 bundle byte-for-byte、no-clobber 地物化并 fsync 为项目快照：

```text
.ae/policies/
├── bundle-v1.json
├── runner-v1.json
├── adapters-v1.json
├── lineage-registry-v1.json
├── cc-tool-mapping-v1.json
├── renderer-registry-v1.json
├── renderer-bundles/<digest>/
├── qualifications/
│   ├── filesystem/<digest>.json
│   ├── isolation/<digest>.json
│   ├── cc-tools/<digest>.json
│   └── renderers/<digest>.json
└── floors/
    └── code-regression-v1.json
```

Rollout 与 Contract 的 **base** policy 只引用 project-root `.ae/policies/**`；`policy_bundle_ref/digest` 绑定manifest，manifest逐项绑定plugin source path、project ref与raw-byte digest，并携带closed floor catalog、runner/provider、filesystem helper、CC-tool-mapping与trusted renderer-registry/bundles所引用的immutable passed qualification results。Contract/Seat/input/dispatch exact选择mapping/renderer entry，runtime selector与live probe不匹配即unavailable/unsupported。所有authoritative view把exact trusted renderer bundle快照进feature或rollout candidate；任意local code不可执行。同名不同digest fail closed，插件升级不能原地替换已被revision引用的文件。Contract另可显式选择prior committed `policy_extension_release`的`ae.policy-extension.v1` artifact：验证exact-digest human proof+finalized event/external journal/source snapshot，再复制为当前feature `contract/policies/extensions/<digest>/`的no-clobber snapshot；manual/ordinary/uncommitted artifact不可选，activation后不回读origin。Adapter registry ref/digest进入Contract，具体adapter ID/schema/build digest与typed fact schema必须命中base registry。

首发主 runtime 固定为 Node ESM；用 pinned Ajv 在构建时生成 standalone validator 并把产物纳入仓库，运行时不执行 `npm install`。Schema bundle digest 写入 validator/status，CI 必须证明重新生成 byte-identical。不得同时维护一套手写“近似 JSON Schema”校验器。Node普通rename不能冒充atomic no-replace commit；P0必须分别资格认证随插件发布、source/build/capability digest-bound的`atomic_directory_noreplace`与`atomic_file_noreplace`（均含完整source/staging、race、target-exists、parent fsync/power-loss），并把selected result digest纳入Gate runtime identity。P0实测并冻结最低Node/平台矩阵。

建议 CLI：

```text
ae-gate init
ae-gate draft
ae-gate approve
ae-gate amend
ae-gate run
ae-gate record-control
ae-gate pause
ae-gate resume
ae-gate status
ae-gate evaluate
ae-gate finalize [--dry-run]
ae-gate recover
```

CLI 不选 Agent、不调模型、不创建 Team、不决定 retry。`record-control` 只允许已知 non-authoritative coordination kinds；proof/contract/lifecycle events 只能由专用 internal producer endpoint 按 kind-specific authorization/input binding 写入。Normalization token 只用于 coverage/judge Seat 交付链，不能泛化成 finalizer/human/runner 的统一假能力。

## 3. Rollout 配置

```yaml
proof_loop:
  requested_mode: off | shadow | enforce   # UX/request，不是authority
  schema_version: 1
  policy_bundle: .ae/policies/bundle-v1.json
  runner_policy: .ae/policies/runner-v1.json
  legacy_live_prose_truth_fallback: true | false # retirement request；remaining legacy-live时effective强制true
  rollout_lock: .ae/rollout/v1.lock.json
```

- final `.ae/rollout/v1.lock.json` 的durable存在是唯一正向effective-mode authority：matching lock + PUBLISHED rollout journal为healthy `enforce`；PREPARED + matching lock为已commit的全局recovery barrier，只允许status/recover与matching owner预计算fsync/seal，普通业务入口零写；receipt不提供第二mode；
- guard/reader先联合检查`.ae/transactions/rollout/CUT-*/journal.json`、prepared core与lock；PUBLISHED+missing lock、lock+missing/mismatched journal/core、corrupt lock或multiple receipts均`rollout_integrity_error`并保持旧writer guard；只有lock absent且无PUBLISHED witness时requested `off|shadow`才可用，requested enforce固定`rollout_lock_required`；
- `shadow` 同时运行旧结果与新Gate，但新Gate不写done；正式new feature不允许双轨；
- requested mode parser永久保留作diagnostic（lock+off/shadow mismatch仍可观测）；legacy-live仍有unmigrated entry时fallback effective强制true且request false报mismatch，零remaining/consumer后才允许本项目effective false并让branch不可达。共享AE 1.0发行包仍保留shadow/pre-lock/live-fallback实现供其他项目迁移，不由单项目join授权删源码；
- rollout-locked `legacy_done_snapshot_adapter` 是永久只读历史解码器，不是可disable的truth fallback，不出现在mutable config中。

每个 event 固定 schema/predicate semantics 与 producer/runner/recorder identity；status/finalize snapshot 固定 Gate runtime identity（plugin version + code/schema/reducer digests）。Compatibility table 决定旧 event 是否可解释，不用 consumer Gate build 污染事实。

## 4. P0 — 冻结语义、故障样本与基线

### 目标

先修复会让 CC 丢弃 metadata 的 bootstrap 解析错误，再在不引入 v1 truth 行为的情况下回答“新系统到底要阻止什么、宿主到底提供什么、成本如何比较”。修复前的 effective broken snapshot 单独留档，不能冒充 intended baseline。

### 工作包

| ID | 工作 | 量 | 产物 |
|---|---|---:|---|
| P0.0 | 修复 5 个核心 Skill + gemini-proxy frontmatter | S | 两类 malformed-colon negative fixture、`plugin validate` 全绿、effective metadata snapshot；修前快照留档并重跑 E3 双轴对照 |
| P0.G | 首发 platform/host primitives 可行性 spike | M | **先于P0.1**；child isolation + atomic directory/file no-replace+fsync + active-release provider PoC；后者必须从host/package registration+invocation correlation唯一选择active root/digest，旧cache/旧session/env-only/direct-core均拒绝；任一核心能力不可资格化就no-go |
| P0.1 | 冻结 runtime/validator/canonical-byte/tree-snapshot/policy bundle 方案 | M | Node/Ajv、tree profiles及observed-source→expected-target move projection golden；release members→no-self-digest JCS manifest→bootstrap embedded digest的无环build；installed core/validator/member重算；release singleton activation-base与historical replay分离；old-bundle downgrade、materialization、semantic-blind fixtures |
| P0.2 | 冻结全部 authoritative schemas | L | Contract/event（含origin/candidate/coverage/judge/human subject与raw judge/coverage output）、dispatch/seat-result/judge/coverage/seat/status/source/input/tree/floor/execution/product-delta/lease/release-manifest/policy/registries/qualification/shadow/origin/migration/rollout/lock/current/legacy/transaction全closed并逐文件校验；lease含closed `active_release_operation` capability/record分支，transaction含origin/migration/finalize/rollout closed branches；global proof namespace；proposal后移P4.9 |
| P0.3 | 冻结 reducer、producer ACL、delivery 与 activation/amend/finalize 代数 | L | identity/latches/human stale/stage unavailable；completed/precursor-terminal/capability/aborted attempt矩阵；healthy/error/recovery lifecycle status、paused denylist；activation/union/crash table |
| P0.4 | 冻结 Ledger hash/head/append recovery、attempt event-set projection与stable lock协议 | M | recorder重算start后/close前全集；partial-write/reorder/truncate/concurrency、pause/resume与lifecycle fixtures |
| P0.5 | 建 F1–F8 completion false-pass corpus | M | 可重复 fixture，包含 F-082、child-127 与 forged judge/coverage authority 样本 |
| P0.6 | 建 AP-01–AP-17 host/pattern failure disposition | M | applicable/N/A matrix |
| P0.7 | 实测 CC capability/session matrix | M | mode/name/isolation/fork/background/binding/result/resume/hooks/backend；plugin update/旧root/旧session/reload/fresh/`--plugin-dir` active-release arms |
| P0.8 | 完成资格认证 active-release/child-isolation、filesystem helper、observation adapters、CC tool mapping与trusted renderer bundles | L | 每个provider/helper/mapping/renderer绑定build、suite、immutable passed result、exact OS/kernel/runtime/CC selector与live probe/golden bytes；active-release capability不回caller且每write/lease重验；JUnit/JSON/process adapters、R-01–R-12 |
| P0.9 | 保存旧机制保护档案、建立 shadow epoch并盘点 legacy | M | property map + immutable shadow-epoch + candidate legacy done/live/reserved global partition；duplicate ID/path（含F-082）先显式处置，不提前成为enforce lock |
| P0.10 | 预注册六类 dogfood、修后 baseline 与成本预算 | S | raw/current 指标、comparison arms、时间戳 |

### 基线指标

- 正确 eligibility 与 false-pass 数；
- human boundary interruptions，而不是所有 UI prompt；
- token、elapsed time 与 Agent 数；
- actionable finding precision、重复/invalid finding；
- resume/replay divergence；
- 当前 skill/script 体量仅作维护观测，不作正确性门。

不预设“token 绝不能增加”。P0 先按任务类预注册可接受的质量—成本预算；后续只做描述性、配对比较，不用三个样本声称统计因果。

### Host matrix 必测

- interactive、`-p` 与 SDK；
- `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=0/1` 的实际行为，而非只看非空字符串；
- Teams on/off 下 mode/name/isolation/fork/background 组合的实际 binding 与结果通道；
- one-team/session、teammate resume、Task lag、shutdown；
- current CC version、`TeamCreate/TeamDelete` 不存在、`team_name` ignored；
- plugin update后旧cache/旧session、reload/fresh session与`--plugin-dir`下的active root选择；env/`${CLAUDE_PLUGIN_ROOT}`只作observation，不单独授权；
- CC sandbox 与 runner native child-isolation 分开记录；
- Codex/Gemini/OpenAI-compatible 的 family lineage 与 assurance；
- hook payload 能力，但确认原始 hook 不是 evidence；
- workflow availability 只记录，不进入 v1 dispatch。

### 退出条件

1. `〔能〕` plugin validate 全绿；修前错误与修后 intended baseline 都有时间戳。
2. `〔能〕` P0.G 在任何schema实现前分别给出active-release、child-isolation与filesystem-commit primitive的go/no-go；active-release不能只信env/caller root，declared-only不执行command，Node `exists→rename`不执行commit。至少一条首发CC安装/invocation路径最终可同时进入三项full qualification，否则停止1.0 authority mutation/command/enforce/release主线。
3. `〔能〕` 所有 schema/digest/transition fixture 有唯一结果；unknown canonical event fail closed，已知 coordination event 才可忽略。
4. `〔能〕` F1–F8 在 spec reducer 上全部 fail closed。
5. `〔能〕` current CC live matrix 与官方行为一致，差异有明确 degrade 语义；修复后 E3 不再把未 attested model/profile 当档位证据。
6. `〔能〕` 首发平台至少一个active-release provider与一个child-isolation provider通过适用R测试，且digest-bound filesystem helper的directory/file两种capability分别通过同文件系统no-replace race、target-exists、双parent fsync/power-loss测试；active-release另通过A/B完整root、旧session/reload、direct-import/fake-token矩阵。任一缺失都停止依赖它的发布路径。
7. `〔能〕` baseline 时间戳早于 P1 的任何 v1 行为改动。
8. `〔能〕` 每个待删除脚本有保护对象或明确“无已知保护”的证据，不能只按行数分类。

### 撤退条件

若核心状态、event authority 或 finalize crash 语义仍有二选一预期，停止实现，先修设计；不能让代码替规范做决定。

## 5. P1 — 安全 Command Proof Shadow 纵向切片

### 目标

让一个真实 command-only feature 完整经过：

```text
shadow-epoch `feature_origin_established(new)` → immutable pre-activation seed
→ candidate + deterministic view
→ fresh coverage dispatch → raw seat result → coverage_review
→ human approval → lock
→ contract_activated → current pointer → safe runner/adapter
→ attempt/result/close → hash-chained ledger → Gate shadow → finalize --dry-run
```

### 工作包

| ID | 工作 | 量 | 要点 |
|---|---|---:|---|
| P1.1 | 建 hermetic Gate bootstrap/core、active-release bridge、validator、路径解析、`init` 与 origin establishment routine | M | `ae-gate.mjs` embedded manifest+all-member verification → import verified validator/bridge → host-active attestation → mint bootstrap-result-bound capability → import/call core且每mutation export重验；pre-verification bridge/early capability、A/B old-root与direct import均零写；manifest no-clobber快照到feature authority；root/canonical/runtime identity/policy snapshot；external origin journal+sibling move发布shadow genesis并测crash/ID/idempotency；migrated producer留P3 |
| P1.2 | 实现 source/input/floor-applicability/product-delta manifest | L | activation/current都枚举closed project-wide product universe含ignored并绑定ignore配置；boundary外delta hard-invalid；locked generated/nonproduct才可排除；boundary seed+post union、floor facts、dirty/untracked/tombstone/stale |
| P1.3 | 实现 recorder + Ledger head/hash/recovery/producer ACL | L | payload-first、idempotency、partial append、stable feature lock |
| P1.4 | 最小 host bridge、renderer、tool guard 与完整 anonymous coverage delivery | L | static越界拒绝，Bash/MCP前后project snapshot；快照Definition/renderer；raw coverage必须单closed canonical object，normalizer仅deterministic projection且Gate重parse；跨R/G latch、capability retry/token/input |
| P1.5 | 完整 command-slice view + seed→candidate→coverage→approval→lock→activation→pointer | L | trusted renderer snapshot；identity含activation policy epoch、R/G唯一性/initial/rebind/seed；runtime epoch改变使candidate stale+全重审，旧activation replay；upgrade/tamper recovery |
| P1.6 | 实现 native-isolated command runner + adapters | L | argv、qualified policy/provider/result selector、qualified CC-tool mapping、JUnit/JSON/process、typed facts、wrapper/child outcome、repo mutation lease |
| P1.7 | 实现 attempt controller + pure reducer/status | L | recorder-derived event set、exact slots、stage availability、全lifecycle+non-ok closed status、paused evidence-vs-operation eligibility、seed∪post三消费者、compat table |
| P1.8 | 实现 `finalize --dry-run` 与 shadow differential | M | eligibility fingerprint；不动 lifecycle |

### Runner 攻击测试

必须有唯一预期：

- argv 注入与显式 shell；
- cwd `..`、绝对路径与 symlink escape；
- 修改 Contract/Ledger/head/Gate/runtime、`.ae/policies`、rollout、lease/transaction；
- timeout、setsid/double-fork 后代、超大输出；
- secret env 与网络请求；
- 两个 run 共享 fixture/port；
- run 中途改变 source；
- sandbox required 但 host unavailable；
- child exit 127 但 wrapper/recorder 成功。

不能可靠阻止但能检测的情况必须标为 tamper-evident，不能写成 sandbox guarantee。

### 退出条件

1. `〔能〕` 一个真实 feature 只有 fresh coverage 无 gap且人明确接受后，才由 latest activation 产生 current revision。
2. `〔能〕` old-valid pointer rollback、approval orphan、activation 后 pointer 前 crash 都有唯一 fail-closed/recovery 结果。
3. `〔能〕` exact argv 实际运行；adapter assertion field 均有唯一 typed producer，parse error=`invalid`、合法零测试与 child exit 127=`failed`、source/product delta drift 均改变 Gate 结果。
4. `〔能〕` F-082 现有“collector 失败但 review pass”在新 Gate 为 ineligible。
5. `〔能〕` 删除 status cache 后可从 activation/revision + Ledger/head 得到 byte-equivalent semantic status。
6. `〔能〕` 一条不依赖新 Gate 的旁路脚本复核 canonical bytes、hash chain、assertion 与 final eligibility。
7. `〔能〕` runner attack matrix 全部得到预注册结果，首发 provider 无 blanket process/network guarantee。
8. `〔能〕` command-only candidate 的全部 material 字段在人类视图可见；proof 不能暴露 falsifier、base floor catalog 缺项/伪 N/A 或 view field 漏投影时均不能 activation。
9. `〔能〕` coverage 的 public forgery、错 authorization/subject/input 与 raw-result replay 都不能产 review/activation；完整 D→S→coverage positive control 可进入 human approval。
10. `〔能〕` new feature 在 plan 前已有 boundary 内 dirty/tombstone 时，即使 activation 后零编辑也进入 locked seed并触发 floor/source coverage；seed tamper/swap/wrong Contract ref、activation 后重生成、空 seed laundering、overlap/conflict/replay 与三消费者分叉 fixtures全部 fail closed。

### 回滚

关闭shadow即恢复legacy lifecycle行为；P1不删除旧reader/finalizer。全部shadow feature、origin/Ledger、journal/lock/staging只写`.ae/shadow/v1/<epoch>/`，保持内部hash/activation语义但不进入production feature root/readers/transaction与ID union，也不得晋级或写done。

## 6. P2 — 完整 Contract、Proof 与 Instruction 边界

### 目标

在 P1 最小 authority/host bridge 上补齐 artifact/human/judge、amendment、backend attestation 与 canonical Seat Contract，使三类 proof 都进入同一 Ledger/Gate。

### 工作包

| ID | 工作 | 量 | 要点 |
|---|---|---:|---|
| P2.1 | 把 P1 完整 view/renderer 泛化到 artifact/human/judge 与 amendment | M | 所有 union branch/material diff；可接受/修改/拒绝 |
| P2.2 | 把 P1 Intent/Scope↔AC/falsifier coverage 泛化到全 proof mode | M | 完整 closed typed finding UX；semantic finding 不冒充 instrument |
| P2.3 | Material amendment 事务 | L | supersede、不改历史、pointer 原子更新 |
| P2.4 | Artifact observation + raw artifact store | M | sorted closed manifest与Contract exact required-set/media/length/digest completeness；每项实际进入judge input；host-attested authors；mismatch走precursor-terminal invalid，exact positive才dispatch |
| P2.5 | `ae.judge.v1`、raw seat result 与 fresh evaluator | L | raw judge单closed object→deterministic projection→Gate reparse；mandatory fresh context；semantic-subject latch跨seat/attempt、sole-primary/subject/input等式、all-author independence、pass⇒no unresolved、F8 |
| P2.6 | Human proof producer | M | human/publication view snapshot trusted renderer；closed mutable-observation/decision-only subject、current重算、A→B stale、undelivered invalid；safe-literal；publication current observation+全member exact text |
| P2.7 | `backend_invocation` producer/correlator | L | 自有 bridge 内 keyed invocation/input/result/model/build record；禁止时间窗猜配对 |
| P2.8 | `ae.seat.v1` dispatcher 泛化 | M | canonical purpose只允许coverage/judge；qualified CC tool mapping+live re-probe、anonymous return、Definition/Seat/input deterministic prompt；worker/research只写telemetry |
| P2.9 | Diagnosis/control events | M | 永不参与 closure |
| P2.10 | 用 golden committed-source fixture 实现 extension consumer resolver | M | feature kind + proofs_at_commit/exact-human/origin chain；per-consumer snapshot/catalog union |

### 关键行为

- plan step 只引用 AC/proof ID；
- required independence/family/assurance 不可由 selector 降级；
- backend self-report 不满足 backend-correlated；
- judge 必须同时引用唯一 dispatch、raw seat result 与 observation/backend event，invalid seat result 不由 TL 补格式；
- coverage gap、criterion 不可证伪与 floor 漏项/伪 N/A 必须回到 Contract/human；
- legacy converter 不推测 proof closure 或 assurance。

### 退出条件

1. `〔能〕` command、artifact、human 各有一条真实 proof 完整闭合。
2. `〔能〕` 同一生成上下文作为唯一 judge 被拒绝。
3. `〔能〕` nonexistent citation、同族伪装、伪 backend receipt、错/重放 dispatch、格式正确语义无据均不能 pass；F8 endpoint/normalizer/reducer 各臂得到预注册的 rejected+pending、blocked 或 test-only invalid，且 judge/coverage positive controls 均通过。
4. `〔能〕` 人类可拒绝/编辑 draft；弱化或删 AC 只能产生待确认新 revision。
5. `〔能〕` backend unavailable 与 uncorrelated 分别归约为 `unavailable` 与 `invalid`。
6. `〔能〕` Seat prompt 可由 Definition + Seat + input manifest byte-equivalent 复算；caller 追加自由 instruction 被拒；任何 backend 未达结果最多成为 telemetry，不产生 proof authority。
7. `〔能〕` floor catalog 缺项、重复、未审理 N/A 与 lock 后 product-delta 命中 N/A 均 ineligible；golden source fixtures 中 wrong/old/nonselected publication proof、普通 feature 与 origin mismatch 都不能被 consumer 选择。

### 回滚

仍处 shadow；可停用 artifact/human producers，不影响 P1 command fixture。Contract revision 与 ledger 不回写成旧 `goal.frozen.md` 真值。

## 7. P3 — Work、Review、Reader 与 Finalize Cutover

### 目标

让 new feature 与少量**显式转换的 pilot** 从旧 prose 状态机切到 Gate，并建立唯一可恢复 finalizer。通用 migrate-on-touch converter/UI 仍在 P5，P3 不宣称覆盖全部 legacy active/paused；但任何 pilot 都必须使用 P1 已通过的 locked pre-activation seed + effective-union路径，不能因“手工 pilot”绕过 origin、全边界枚举、human view或三消费者一致性。

### 内部顺序

先冻结 status/finalizer/journal 接口，再切 reader；不能先让 dashboard/next 依赖尚未定义的 projection。

### 工作包

| ID | 工作 | 量 | 要点 |
|---|---|---:|---|
| P3.1 | 冻结 status/activation/finalize journal 与 recover-only barrier | M | nonterminal阻断新operation与diagnosis append；连续owner仅跑预计算内部步骤，ownership丢失后只读检查+recover；move即commit |
| P3.2 | `/ae:work` 改读Gate obligations并接入logical lifecycle controller | L | 含stale；durable mutation lease；pause/resume绑定current/expected prior并要求零operation/TX；paused仅status/resume/recover可达，work/run/attempt/approve/amend/finalize全拒；resume后重验 |
| P3.3 | bounded attempt + diagnosis loop | M | cap 属 Strategy，不属 Gate |
| P3.4 | `/ae:review` 改为 proof manifest/evaluator producer | L | 不写全局 verdict/done |
| P3.5 | rollout-aware reader cutover + permanent legacy-done adapter | L | 先判global rollout：无lock/witness保持production旧reader且shadow/candidate/marker无authority，rollout recovery/integrity返回全局barrier/error；仅healthy lock+PUBLISHED后，active/paused再判migration nonterminal→recovery、PUBLISHED marker/genesis→v1 draft/live Gate、locked legacy-live marker absent→temporary prose fallback、else invalid；v1 done committed，manifest done legacy_readonly；prelock positive/inert-marker negative与adapter均在lock前通过 |
| P3.6 | 实现唯一 finalizer/recover | L | qualified fs helper；PREPARED预发布并fsyncH+1 prepared与H+2 finalized两份payload/event exact templates，source先含两payload；prepared/committed snapshots、tail/head恢复、no-replace+dual-parent fsync；lifecycle payload禁止snapshot反向refs |
| P3.7 | 完成production origin producers、logical lifecycle与旧writer guard证明 | L | missing-lock时producer不可达；new whole-tree origin与migration external-journal/commit-marker全crash suite先过；pause/resume endpoint；真实导航并mutation-test所有旧path move及done/abandoned writer，cutover race全过；hook非evidence |
| P3.8 | Quiesce、审批并发布rollout lock（即enforce commit） | L | scan/markers/trusted approval/final scan后写immutable rollout prepared-core+PREPARED journal；qualified file no-replace lock是commit，再seal PUBLISHED receipt；全DAG/crash recovery，无shadow/duplicate/alias/ghost/漏项 |
| P3.9 | lock/journal anti-rollback canary与authority验证 | M | 不改runtime；healthy matching pair enforce；PREPARED+lock触发全局recovery barrier，除status/recover及matching owner预计算seal外所有reader mutation/new/migration/work/finalize零写；lock-delete、receipt-delete/corrupt、PUBLISHED+missing lock、multiple receipts、config-off均fail closed并保持old-writer guard；reader/new/migration canary |
| P3.10 | 在已enforce authority下开放new + explicit pilot用户入口 | M | 只开放已由lock绑定并在P3.7验证的producer，不实现新authority code或第二次mode切换；旁路复核、P1 seed/union前置，shadow genesis不可晋级 |

### 退出条件

1. `〔能〕` Gate facts 唯一驱动 retry/replan/human/finalize；Gate 自己不调度。
2. `〔能〕` 每 feature 一个 owner，且 durable repo lease 使全 repo 同时只有一个受支持 AE product writer；read-only seat 的 Bash/MCP 写入被拒绝。
3. `〔能〕` review 的 summary 删除后不影响重放 status。
4. `〔能〕` finalizer 用 P0-qualified helper，在 evaluated-head→prepared-head、move 前/后 crash、截断 journal、目标已存在、manual move、双并发时均有唯一结果；不允许 Node check-then-rename fallback。
5. `〔能〕` new feature 除 `ae-gate finalize` 外没有生产 done 入口。
6. `〔常〕` 连续三个正常 feature 使用 Gate reader、bounded loop 与唯一 finalizer。
7. `〔能〕` 任一valid nonterminal journal存在时，新work/record/approve/amend/finalize与diagnosis append均零写入并返回`transaction_recovery_required`；连续持matching lease+lock+TX nonce的创建operation只能跑预计算内部步骤，ownership丢失后只有只读status/diagnostic inspection与recover可达，move前/后先recover到terminal才解锁。
8. `〔能〕` 每个 enforce pilot 都有 schema-valid、human-confirmed、activation-bound pre-activation seed；P1 的 union/replay/三消费者 suite先全过。已有产品 entry 的 pilot若给空 seed、seed与 Contract不匹配或无法完整枚举，必须在切换前被拒。
9. `〔能〕` rollout按guard/drain→pre-scan→markers→scan→approval→rescan→prepared-core/PREPARED journal→lock commit→PUBLISHED seal完成；三manifest全局partition。各间隙旧writer被拒或candidate重做；lock/receipt任一单独丢失或不匹配全局fail closed，lock后sets不扩张。
10. `〔能〕` cutover scan证明 production active/paused/done中 shadow-origin count=0；shadow namespace永不被 production reader/finalizer消费，需保留时仅作审计，不能改 origin后晋级。

### Cutover 顺序

```text
shadow differential 全处置
→ false-pass + crash suite 全过
→ reader cutover
→ permanent legacy-done adapter通过
→ production new/migration origin producers与全crash suite冻结（missing-lock gate）
→ guard真实导航/mutation/race证明 + drain old writers
→ identity pre-scan + markers + 三manifest scan + human approval + final re-scan
→ rollout prepared-core + durable PREPARED journal
→ qualified lock publication（不可逆enforce commit）+ PUBLISHED anti-rollback seal
→ lock/journal authority canary
→ 在已enforce authority下启用new + explicit pilot入口
→ 才允许删除旧真值路径
```

### 回滚

enforce 前可回 shadow。Enforce 后不能把 new/pilot feature 切回 legacy truth；安全回滚是关闭 auto-finalize、把 feature 置于 paused/integrity-recovery 并继续让 Gate 保持唯一 authority。若实现版本必须回退，只能由兼容 Gate 重放当前数据或显式人工恢复，不能把新 Ledger 折叠成 `review.md.verdict`。

## 8. P4 — 扩展 Host Binding 与最小 Pattern Policy

### 目标

在 P1/P2 已可安全运行的 minimal live probe/anonymous dispatcher 上扩展 Team/provider matrix，并把当前“大部分 skill 默认 Agent Team + 固定 roster”缩成任务几何驱动的最小 dispatch，不引入新 runtime。

### 工作包

| ID | 工作 | 量 | 要点 |
|---|---|---:|---|
| P4.1 | 扩展并集中 live capability probe | M | P1 minimum → 全 mode/Team/provider matrix |
| P4.2 | decision-table selector + typed selection telemetry | M | locked proof+geometry+host state；只有actual coverage/judge进入canonical dispatch，其他角色不得伪造evidence purpose |
| P4.3 | 扩展 ordinary review/research anonymous subagent | L | review只有被Contract选作proof judge才走canonical链；ordinary research/analysis/worker始终non-authoritative host telemetry |
| P4.4 | discuss/consensus 收窄 Team 使用 | L | peer exchange/竞争假设才启用 |
| P4.5 | Team 交付与 resume degrade | M | mailbox、one team、re-spawn |
| P4.6 | cross-family seat/lineage/assurance 收口 | L | backend invocation 与 verdict 分离 |
| P4.7 | 删除固定 reviewer/Doodlestein 硬门 | M | risk-triggered explicit escalation |
| P4.8 | knowledge 解耦与可选 hit telemetry | S | 保持 `.ae/graph`，不进 Gate |
| P4.9 | floor-proposal/extension authoring 与真实 E2E | M | post-COMMITTED proposal；UTF-8 member manifest + untruncated safe publication view；release→finalize→future select/snapshot；单-floor opt-in |

### 明确 disposition

- Dynamic Workflow：v1 **不发布，不实现 evidence bridge**；相关 AP 测试以路径不可达的证据 N/A。
- `/goal`：可选 continuation UX；不能关闭 proof。
- Agent Teams：只用于 peer exchange；关闭时 ordinary command/artifact path 可完成。
- Cross-family：只在 Contract/risk 需要时供给 seat；同族 fallback 不能冒充满足 required family。
- Knowledge：保持兼容与非阻塞，发布后评估真实读取收益。
- Floor evolution：retrospect 只能产 proposal；当前 finalize 不因 proposal 增加审批，未来可经独立 release feature 进入 opt-in library；v1 不做 project-wide automatic promotion。

1.0 初始默认只晋升 `solo`；Contract 明确要求 independent judge 时使用已验证 anonymous subagent，这是 proof requirement，不是“多 Agent 默认”。Fan-out/Team/cross-family 在 P6 累计重复收益前保持 risk-triggered explicit escalation，不能凭一次 dogfood 自动晋升默认。

### 退出条件

1. `〔能〕` Teams on/off 下 ordinary anonymous subagent 都通过 return channel 交付。
2. `〔能〕` named teammate 不回传 result 的场景不会让 subagent workflow 卡住。
3. `〔能〕` resume 后缺 teammate：probe available arm 固定 re-spawn；unavailable arm 固定记录 capability unavailable；两臂都不相信旧 Task。
4. `〔能〕` Team/task/mailbox/goal/hook telemetry 无法直接影响 Gate。
5. `〔能〕` required cross-family 的 available 与 unavailable 两臂均有真实可关联运行。
6. `〔常〕` 连续三个 feature 的 selector 选择最小够用 topology，复杂升级都有 dispatch reason。
7. `〔能〕` 真实 E2E 证明 proposal 不改当前 Gate；`policy_extension_release` 的 artifact proof + publication human proof 共同批准 exact 单-floor bytes，经 P3 finalizer committed 后，新 Contract 显式选择/本地快照才进入 catalog。手工/普通 feature/uncommitted/wrong-or-old proof/source-chain mismatch 均不可选，origin 后续损坏不追溯 consumer。

## 9. P5 — Migration-on-touch 与逐项退役

### 目标

把本项目 legacy 真值读者迁走，按 assurance property 让旧机制从healthy-v1路径退役，不设“删到固定数量”的表演指标。必须区分project-local reachability与共享插件源码：本项目lock/join只能证明本项目可关闭分支，不能证明其他安装已迁移。

### 工作包

| ID | 工作 | 量 | 要点 |
|---|---|---:|---|
| P5.1 | active/paused migrate-on-touch converter/UI | L | v1只允许conservative：完整Git historical-path universe∪current index/worktree/untracked，历史删除path记unknown tombstone；current HEAD/mtime/prose/human/事后snapshot不能伪造pre-mutation base；shallow/missing即blocked；人确认不推测pass |
| P5.2 | 审计并固化永久 done 历史 adapter 兼容面 | M | 复核P3已上线的只读adapter只认rollout manifest精确ID/path/tree digest；不批量迁移、不提供disable开关 |
| P5.3 | old→new truth reader inventory | M | 搜索 + live navigation；逐项标 `verified_read|inferred_pending_audit` |
| P5.4 | 每机制 protection map + mutation test | L | 替代前不删除 |
| P5.5 | 从new/migrated truth path移除旧 verdict/notes/goal usage | L | 保留人类历史视图；pre-lock/locked legacy-live compatibility按project state路由 |
| P5.6 | 收缩 agent-teams/agent-selection 协议 | L | current host semantics |
| P5.7 | 更新插件契约、README、导航与兼容面 | M | 不再引用 TeamCreate/Delete |
| P5.8 | 全量legacy-live接管后做project-local shadow/live-prose retirement | M | 枚举本项目每个legacy-live entry均有PUBLISHED migration+marker+v1 takeover后，effective false并使本项目branch不可达；共享1.0包仍保留shadow/pre-lock/migrate/live-fallback代码，另保留requested-mode parser/diagnostic及permanent legacy-done adapter |

P5.1只新增legacy discovery/conversion UI与migration fixtures：conservative universe全present/unknown tombstone、C含x→D删除仍纳入或blocked、D/mtime/prose伪base拒绝、枚举失败不activation。Seed authority、laundering/replay与三消费者一致性已是P1/P3前置。

### 优先从 healthy-v1 路径移除的候选

替代路径通过后，先删除new/migrated/healthy-lock调用边；只有独立的plugin-global support/sunset证明覆盖所有受支持安装时才删除共享源码：

- `collect-ac-evidence.py`；
- `parse-review-verdict.sh`；
- `check-proxy-residual.sh` 及 feature-specific baseline/assertions；
- 新/迁移 feature 中 `goal.frozen.md` 的 machine-truth reader；
- `LOOP_ITER`、`LOOP_FINDINGS`、`WAIVED_AC`、`UNVERIFIED_AC` 的真值作用；
- `review.md.verdict` 的 Gate/归档作用；
- review 直接 `mv .../done`；
- dashboard/next 对 plan/review/index 的完成态二次解释。

### 条件删除

以下机制保护 host/provider drift 或仍提供诊断，禁止整批砍掉：

- 尚未完成真实 reader/producer 导航审计的 `check-harness.sh`；
- cast、shutdown、declared-vs-effective 检查；
- family reachability、relay attestation、cross-family counter；
- trace、risk-floor 与 graph 脚本。

只有 disposition 为 `verified_read`、且对应 live behavior/event test 接替同一性质、所有已知 consumer（包括 `check-declared-vs-effective.sh`）已更新后才可移除调用边。共享源码删除还额外要求独立产品版本/支持期、跨安装迁移策略或随包migrator；单项目全量join不构成该authority。`verified_read` 不等于 delete-ready，`inferred_pending_audit` 不能进入删除批次。

### 保留

- `ae-run-tests.sh` 作为回归入口；
- `verify-contract.sh` 可作为 recipe implementation，但不再是真值源；
- MCP bridges/proxies，适配新的 seat/result/attestation schema；
- `.ae/graph` 与 knowledge-refresh，从 completion path 解耦但不重命名。

### 退出条件

1. `〔能〕` conversion fixture与至少一个真实legacy active经人确认迁移完成；历史done无变化。
2. `〔能〕` 所有已迁移v1 active/paused生产reader只消费live Gate projection；仍命中locked legacy-live且marker absent的对象在全量join完成前只走temporary prose branch；v1 done只消费committed lifecycle/`proofs_at_commit`并验证journal/历史snapshot。全量join后active/paused不再存在prose consumer。
3. `〔能〕` 每个退役/删除项都有 property map、旧 failure fixture 与替代 mutation test。
4. `〔能〕` 移除旧测试不是让套件变绿的手段；旧 failure 仍被新测试捕获。
5. `〔能〕` 对本项目rollout lock的legacy-live manifest做全量join：每项恰有matching PUBLISHED migration journal/commit marker并由v1 reader接管，零remaining prose consumer后才令本项目live fallback effective false/不可达；“连续三个未命中”不能替代全量证明。用同一AE 1.0构建在无lock legacy项目的compatibility fixture仍能运行shadow、旧reader与migrate-on-touch。`〔常〕` 随后三个本项目feature不再触发live fallback；历史done仍由永久adapter读取。

## 10. P6 — Dogfood 与发布

### 六类 dogfood

| ID | 场景 | 主要证明 |
|---|---|---|
| D1 | command-only 小改动 | direct closure、零测试、runner policy |
| D2 | 跨文件重构 | declared source set、stale、single mutation owner |
| D3 | fact-claim 文档/artifact | fresh judge、引用复核、semantic drift |
| D4 | human proof | AskUserQuestion、assurance、不可 auto-pass |
| D5 | coverage gap | Intent↔AC、amendment、human authority |
| D6 | required cross-family | lineage、backend correlation、unavailable degrade |

每个场景保存：

- raw legacy/current result；
- shadow/enforce Gate result；
- contract/event/status 与 Gate runtime identity；
- chosen/degraded topology；
- Agent 数、token、时间、有效/重复/invalid finding；
- human boundary interruptions；
- failure injection 与 recovery 结果。

### 发布门

1. G0–G7 全过；
2. F1–F8 为 8/8 fail closed；
3. AP-01–AP-17 为 PASS，或以“能力未发布且路径不可达”的证据 N/A；
4. 六类 dogfood 全部得到正确 eligibility；
5. 三个连续正常 AE-on-AE feature 在代码冻结后通过 enforce；
6. replay divergence、unauthorized amendment、early/double finalize 均为 0；
7. shadow 分歧全部有 disposition，new feature 不再双轨；
8. 真实 host matrix 与文档一致；
9. 退役/删除清单逐项有保护替代；AE 1.0发行artifact仍通过fresh legacy project兼容fixture，不以脚本/行数减少作为单独成功；
10. value/cost 在预注册预算内；超预算必须收窄默认 Pattern，而不是放宽 proof。

### 发布后观察

- 30/60/90 天记录 false-pass escape、replay/recovery、human interruption、cost；
- knowledge 只评真实 read hit 与节省，不评写入量；
- 默认 Pattern 未持续优于 solo 时退回更简单拓扑；
- 30/60/90 日 read hit、维护成本与 seeded delivery 结果交由人类决定保留、改造或删除 knowledge lane，不设自动时间死刑。

## 11. 并行实施策略

可并行：

- schema/fixture 与 current-state inventory；
- runner threat tests 与 reducer golden tests；
- human view 与 raw artifact store；
- host live tests 与文档更新；
- 各 reader 的只读适配。

必须串行或由同一 integration owner 控制：

- Contract schema 与 reducer 语义；
- recorder/event envelope；
- pointer/lock/amendment；
- finalizer/journal/recovery；
- shadow→enforce；
- 本项目全量migration takeover后的legacy-live prose branch退役；plugin-global compatibility源码sunset必须走独立版本/支持策略（legacy-done snapshot adapter永久保留）。

实现本计划自身也遵守“一 feature 一个 active mutation owner”。并行 workers 只产出审计、fixture、独立 review 或不重叠的隔离 artifact，由 integration owner 合入并重新运行证据。

## 12. 完成定义

本计划完成只在以下条件同时成立：

- 代码、schema、fixtures、文档和 live host tests 一致；
- new/migrated feature 的 Contract/Ledger/Gate/Finalizer 是唯一 truth path；
- 所有 hard release gate 通过；
- 旧active/live truth路径在本项目按property map不可达，或有明确兼容disposition；共享AE 1.0包仍支持fresh legacy project进入shadow/cutover/migration，rollout锁定的永久legacy-done只读adapter按兼容规范保留；
- 没有把 Dynamic Workflow、knowledge rename、跨 runtime Core 或多 writer scheduler 偷带进 v1。
