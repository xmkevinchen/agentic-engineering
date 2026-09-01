# AE 1.0 最终设计：Executable Proof Loop

> **状态：历史。** 本文件是 2026-08-23 冻结的 AE 1.0 规范的一部分，其核心前提——完成由确定性 Gate 判定、Agent Teams 作为执行策略、`ae-gate` 为真值来源——已被后来的删除推翻。保留它是为了记录当时**为什么**这样设计，以及那条路线的代价。**它对任何当前工作没有规范效力。**
> 当前状态见 [`../../rebuild.md`](../../rebuild.md)，本目录的说明见 [`README.md`](README.md)。
>
> 下文的 Executable Proof Loop、四类对象、Gate reducer 与 authority 边界都**没有**在今天的树里运行：Kernel 建成后无人调用，已归档在 tag `v1-kernel-archive`。

> 规范性设计 · Claude Code 首发实现 · 2026-08-22

## 1. 产品承诺

AE 1.0 保证：

> **在受支持的 AE 路径上，只有被人确认的当前 Contract revision，才能定义什么算完成；只有与该 revision、确定 source set 和执行来源绑定的 admissible evidence，才能让 deterministic Gate 给出 finalize eligibility；只有唯一 finalizer 能写 done。**

这不是“让更多 Agent 检查 Agent”，而是建立一条可重放的证明闭环。

### 1.1 直接解决的当前缺陷

- `plan.md` 同时承载目标、证明与执行步骤；
- `goal.frozen.md` 自动复制，却被描述成经过人类批准；
- evidence collector 可能失败，review prose 仍能给 pass；
- executor 可通过 notes 中的 waiver 改变验收效果；
- `notes.md`、`review.md`、Task、index 与目录位置分别推断状态；
- review 自己写 verdict、归档并成为完成入口；
- named Agent、Agent Team 与 cross-family backend 的实际到达可能和 prompt 假设不同；
- shape-valid 输出可能包含无法追溯的语义主张。

当前代码事实与迁移锚点见 [`migration-map.md`](migration-map.md)。

### 1.2 保证边界

AE 1.0 不是 OS 安全沙箱。拥有同一用户全部文件权限的恶意进程仍可同时改写代码、Contract、Ledger、Gate 程序与 Git 历史。

v1 提供的是：

- immutable-by-convention + digest-bound revision；
- protected-path guard + 每次 Gate 的独立 digest 校验；
- append-only、可重放、fail-closed 的工作流；
- 明确区分 `canonical_recorded`、`host_recorded`、`backend_correlated`、`workflow_attested` 与 `host_verified`；
- 不具备要求的 capability 时显示 `unavailable`，不静默换成较弱证明。

## 2. 总体架构

### 2.1 两个平面

```text
┌──────────────────────── Truth Plane ────────────────────────┐
│ Acceptance Contract → Evidence Ledger → Gate → Finalizer   │
│ immutable revision    append-only       pure    sole writer │
└─────────────────────────────────────────────────────────────┘
                              ▲
                    canonical event boundary
                              │
┌───────────────────── Coordination Plane ────────────────────┐
│ Plan · Worker · Reviewer · Seat · Task · Team · mailbox    │
│ diagnosis · hook telemetry · /goal · Pattern Policy        │
└─────────────────────────────────────────────────────────────┘
```

协调平面的内容可以重试、重建、丢失或串行退化。它不能直接写 proof closure 或 lifecycle done。

### 2.2 四个核心对象

| 对象 | 问题 | 权威规则 |
|---|---|---|
| Acceptance Contract | 什么算对 | Agent 起草，人确认；immutable revision + current pointer |
| Execution Strategy | 怎么做 | 可重排、替换或重做；只引用 AC/proof ID，不复制真值 |
| Evidence Ledger | 实际发生了什么 | append-only；事件绑定 contract、source、run、producer 与 producer/predicate semantics |
| Gate | 现在能不能 finalize | 纯归约；不调模型、不选 Agent、不决定 retry |

Finalizer 是 Gate 的唯一 lifecycle 写入口，不是第五套完成判断。

## 3. Acceptance Contract

### 3.1 生命周期

```text
candidate + deterministic view
  → independent coverage dispatch → raw seat result → canonical coverage_review
  → human approval / reject / edit
  → immutable R0001/G0001 + lock
  → contract_activated（唯一 revision commit point）
  → current pointer mirror
  → material change?
       no  → Strategy 可变，revision 不变
       yes → draft R0002 → human confirm → supersede R0001
```

人类看到的主视图使用业务语言，并同时展示一份可展开的 proof/risk 摘要。只展示 JSON 会造成不可理解的确认；完全隐藏 recipe 又会掩盖命令执行风险。

### 3.2 最小规范形状

```json
{
  "schema_version": "ae.contract.v1",
  "feature_id": "F-123",
  "feature_kind": "product_change",
  "feature_origin": {
    "kind": "new",
    "authority_ref": "event:E-origin-established",
    "authority_digest": "sha256:..."
  },
  "revision_id": "R0001",
  "candidate_generation": "G0001",
  "supersedes": null,
  "intent": "用户为什么需要这项变化",
  "scope": {
    "in": ["本次承诺"],
    "out": ["明确不做"],
    "constraints": ["必须保持的业务约束"]
  },
  "change_boundary": {
    "product_roots": ["src/**", "tests/**", "package.json"],
    "product_universe": {
      "profile": "repo_product_v1",
      "logical_root": ".",
      "fixed_control_exclusions_digest": "sha256:...",
      "enumerator_build": "ae-enumerator@sha256:..."
    },
    "generated_or_non_product": ["coverage/**"],
    "baseline_manifest_ref": "runs/contract/R0001-product-baseline.json",
    "baseline_manifest_digest": "sha256:..."
  },
  "pre_activation_seed_binding": {
    "seed_ref": "contract/seeds/sha256-....json",
    "seed_digest": "sha256:...",
    "seed_origin": "new_workspace",
    "seed_generation": "initial",
    "enumerator_build": "ae-enumerator@sha256:...",
    "origin_snapshot_ref": "runs/creation/F-123-origin.json",
    "origin_snapshot_digest": "sha256:...",
    "enumeration_snapshot_ref": "runs/contract/R0001-pre-activation.json",
    "enumeration_snapshot_digest": "sha256:..."
  },
  "policy_bundle_ref": ".ae/policies/bundle-v1.json",
  "policy_bundle_digest": "sha256:...",
  "activation_policy_epoch": {
    "release_manifest_ref": "authority/releases/sha256-....json",
    "release_manifest_digest": "sha256:...",
    "activation_base_bundle_digest": "sha256:..."
  },
  "policy_extension_bundles": [],
  "effective_floor_catalog_digest": "sha256:...",
  "adapter_policy_ref": ".ae/policies/adapters-v1.json",
  "adapter_policy_digest": "sha256:...",
  "lineage_policy_ref": ".ae/policies/lineage-registry-v1.json",
  "lineage_policy_digest": "sha256:...",
  "tool_mapping_policy_ref": ".ae/policies/cc-tool-mapping-v1.json",
  "tool_mapping_policy_digest": "sha256:...",
  "renderer_registry_ref": ".ae/policies/renderer-registry-v1.json",
  "renderer_registry_digest": "sha256:...",
  "acceptance_criteria": [
    {
      "id": "AC-01",
      "criterion": "业务上可观察的完成条件",
      "source_refs": ["user:turn-17"],
      "consequence_if_missing": "缺失时造成的用户影响",
      "falsifier": "出现什么可观察结果，就足以证明该条件没有满足",
      "proofs": [
        {
          "id": "P-01",
          "mode": "command",
          "source_set": {
            "selectors": [
              {
                "id": "S-src",
                "kind": "glob",
                "pattern": "src/**",
                "existence": "must_exist",
                "universe": "tracked_plus_declared_untracked",
                "declared_untracked": [],
                "gitignored_policy": "exclude",
                "symlink_policy": "within_root"
              },
              {
                "id": "S-tests",
                "kind": "glob",
                "pattern": "tests/**",
                "existence": "must_exist",
                "universe": "tracked_plus_declared_untracked",
                "declared_untracked": [],
                "gitignored_policy": "exclude",
                "symlink_policy": "within_root"
              },
              {
                "id": "S-package",
                "kind": "path",
                "pattern": "package.json",
                "existence": "must_exist",
                "universe": "tracked_plus_declared_untracked",
                "declared_untracked": [],
                "gitignored_policy": "exclude",
                "symlink_policy": "within_root"
              }
            ]
          },
          "closure": {
            "kind": "direct",
            "assertions": [
              {"kind": "exit_code_in", "values": [0]},
              {"kind": "matched_count_at_least", "field": "matched_tests", "value": 1}
            ]
          },
          "recipe": {
            "argv": ["npm", "test", "--", "auth"],
            "cwd": ".",
            "timeout_seconds": 300,
            "environment": {"inherit": "allowlist", "names": ["PATH", "CI"]},
            "credential_policy": {"allowed_refs": []},
            "network": "deny",
            "sandbox_requirement": "policy_enforced",
            "output_roots": ["coverage/auth/**"],
            "mutation_policy": "declared_outputs_only",
            "runner_policy_ref": ".ae/policies/runner-v1.json",
            "runner_policy_digest": "sha256:...",
            "observation_adapter": {
              "id": "junit-xml",
              "schema_version": "ae.adapter.junit.v1",
              "artifact_path": "coverage/auth/junit.xml",
              "adapter_build_digest": "sha256:..."
            }
          },
          "required_independence": "none",
          "required_family": "any",
          "required_assurance": "canonical_recorded"
        }
      ]
    }
  ],
  "project_floors": [
    {
      "id": "PF-code-regression",
      "catalog_entry_digest": "sha256:...",
      "disposition": "bound",
      "not_applicable_reason": null,
      "policy_source_ref": ".ae/policies/floors/code-regression-v1.json",
      "policy_source_digest": "sha256:...",
      "applicability_facts_ref": "runs/contract/R0001-floor-applicability.json",
      "applicability_facts_digest": "sha256:...",
      "inline_definition_digest": "sha256:...",
      "applicability": {
        "kind": "changed_path_matches",
        "selectors": ["src/**"],
        "baseline_ref": {
          "manifest_ref": "runs/contract/R0001-product-baseline.json",
          "manifest_digest": "sha256:..."
        }
      },
      "obligations": [
        {
          "id": "PF-P-01",
          "mode": "command",
          "source_set": {
            "selectors": [
              {
                "id": "S-floor-src",
                "kind": "glob",
                "pattern": "src/**",
                "existence": "must_exist",
                "universe": "tracked_plus_declared_untracked",
                "declared_untracked": [],
                "gitignored_policy": "exclude",
                "symlink_policy": "within_root"
              },
              {
                "id": "S-floor-package",
                "kind": "path",
                "pattern": "package.json",
                "existence": "must_exist",
                "universe": "tracked_plus_declared_untracked",
                "declared_untracked": [],
                "gitignored_policy": "exclude",
                "symlink_policy": "within_root"
              }
            ]
          },
          "closure": {
            "kind": "direct",
            "assertions": [
              {"kind": "exit_code_in", "values": [0]},
              {"kind": "output_not_truncated"}
            ]
          },
          "recipe": {
            "argv": ["npm", "run", "lint", "--", "src"],
            "cwd": ".",
            "timeout_seconds": 300,
            "environment": {"inherit": "allowlist", "names": ["PATH", "CI"]},
            "credential_policy": {"allowed_refs": []},
            "network": "deny",
            "sandbox_requirement": "policy_enforced",
            "output_roots": [],
            "mutation_policy": "read_only",
            "runner_policy_ref": ".ae/policies/runner-v1.json",
            "runner_policy_digest": "sha256:...",
            "observation_adapter": {
              "id": "process-v1",
              "schema_version": "ae.adapter.process.v1",
              "adapter_build_digest": "sha256:..."
            }
          },
          "required_independence": "none",
          "required_family": "any",
          "required_assurance": "canonical_recorded"
        }
      ]
    }
  ]
}
```

Policy 有两个明确层次，不能让同一 ref 在两处任意解析：

- `plugins/ae/release-manifest-v1.json` 是每个已安装Gate release的closed root manifest，schema为`ae.release-manifest.v1`。它固定release ID/version、唯一`activation_base_bundle_ref/digest`、runtime core、standalone validator、active-release bridge/provider requirement+qualification result、全部authoritative schema与base policy manifest的exact plugin-relative ref/raw-byte digest，以及reducer/compatibility semantics identity；ref禁止absolute、`..`、symlink与duplicate/collision。Manifest **没有也禁止** `self_digest` 字段；其authoritative digest恒为SHA-256(JCS(完整manifest对象))，只由Contract、rollout lock与runtime records外部绑定，避免自引用；
- `runtime/ae-gate.mjs` 是最小bootstrap launcher，release build先冻结core/validator/active-release bridge/schema/policy members，再生成manifest并计算上述digest，最后把exact `expected_release_manifest_digest`与由`release-manifest-v1.schema.json`生成的bootstrap validator嵌入launcher，DAG固定`members → manifest → launcher`。Manifest member set明确不含launcher自身，因此无digest cycle；它必须包含`runtime/ae-gate-core.mjs`、`runtime/active-release-bridge.mjs`与`runtime/validators-v1.mjs`。Launcher以自身plugin root解析并strict duplicate-key parse installed manifest，先重算JCS digest等于embedded digest并做closed validation，再逐项重算**全部**installed member bytes；全部匹配后才可import已验证的validator/active-release bridge，取得host attestation并生成绑定actual bootstrap-result digest的operation capability，最后才import/call core。任何member verification前不得执行bridge或core。Core没有受支持的standalone CLI。每个event/status/lock另记录实际launcher/core/validator raw digests。Launcher/package install provenance是本地release trust root；能同时替换launcher、manifest与全部成员的同OS用户攻击仍属于§诚实边界，不把此限制伪装成防篡改签名；
- “能自洽启动”不等于“当前active release”。[Claude Code官方插件文档](https://code.claude.com/docs/en/plugins-reference#plugin-caching-and-file-resolution)明确旧版本cache会在更新后暂留，且已加载session在`/reload-plugins`前继续使用旧root；因此`${CLAUDE_PLUGIN_ROOT}`字符串、环境变量、launcher自身声明或rollout lock中的历史epoch都不能选择current release。P0必须资格认证一个host/package-manager **active-release provider**：它从当前有效插件注册/cache状态与host invocation correlation观测唯一active AE root+manifest digest，而不是相信caller路径；若当前CC mode/version不能给出可关联结果，所有authority mutation固定`active_release_unavailable`，1.0不得enforce/release；
- 每次会写product、Contract/approval/activation/Ledger、lifecycle、origin/migration/finalize或rollout authority的入口，在取得repo lease前都必须完成两个不可颠倒的阶段：已验证bridge先产生不含bearer的host/package active-root attestation；launcher确认attested digest等于自身verified manifest后，bridge才内部签发closed `ae.active-release-operation.v1` capability。Capability绑定plugin ID、active root identity、`active_release_manifest_digest`、provider build/qualification result、repo/feature/purpose、host operation、nonce/expiry与**已经产生的**exact launcher bootstrap-result digest。Bearer不回传给model/seat/caller，只以internal channel/record digest交给core；core每个mutation export再独立验证同一capability+bootstrap result后才可进入producer ACL/lease。Capability先于matching bootstrap result、bridge在member verification前执行、attestation/capability两阶段合并或caller提供attestation均hard error。A/B两个完整cache root同时存在、host active=B时，调用A的draft/coverage/approve/activate/record/finalize一律`release_not_active`且零写；直接CLI或`node -e import(core).then(call)`、伪造/重放/wrong-scope capability、member tamper后绕launcher也零写。缺capability只允许release-local read-only diagnostic；当前active B负责按compatibility table重放A的历史，不由A继续写；
- Candidate起草前，controller把**已通过bootstrap+active-provider联合验证**的installed manifest bytes content-addressed/no-clobber复制到feature `authority/releases/<digest>.json`并fsync；Contract只绑定该local ref/digest与manifest内base digest。Coverage/approval/activation每次用新的active-release capability要求local digest仍等于current active digest；升级使未activation candidate stale。Activation后status/replay只校验local snapshot、activation event与current runtime compatibility，不回读/执行旧plugin members；snapshot missing/tamper为integrity error，当前plugin manifest不能冒充历史bytes；
- `plugins/ae/policies/**` 是随插件发布、由 `bundle-v1.json` 列举每个 plugin source path、project ref 与 raw-byte digest 的 source bundle；bundle 自身的 canonical digest 由 Contract 绑定；
- `ae-gate init`（首次项目初始化）或 `draft`（缺少当前 bundle 时）先验证已安装 plugin files 与 bundle manifest，再把所需文件和 manifest byte-for-byte、no-clobber 地物化到 project-root `.ae/policies/**`，并 fsync 文件与 parent。已有同名不同 digest 文件是 `integrity_error`，升级只能使用新版本文件名并经新 Contract revision；
- Base policy 的 `.ae/policies/**` ref 都从 project root 解析，禁止绝对路径、`..` 与 symlink escape；activation 同时验证 `policy_bundle_ref/digest`、单文件 ref/digest 与 bundle entry 一致。锁定后 Gate 只读项目快照，不回读可能已升级的 plugin bundle；
- 每个Gate/plugin release manifest还携带closed `activation_base_bundle_digest`（v1 exact singleton）与其release identity；这和“旧bundle可为历史重放保留”是两件事。Candidate creation/coverage/approval及authority-lease内activation都要求selected base digest exact命中**当前运行release**的activation digest，并把release-manifest digest + base digest组成的policy epoch纳入candidate semantic/view/identity；rollout lock记录cutover时的epoch/runtime。Current release仍支持的旧bundle只可解释既有activation/committed history，不可被新candidate选择。若runtime升级改变release-manifest digest或activation base digest，尚未activation的candidate固定`policy_epoch_stale`并须以新revision重建floor catalog、coverage与human approval；已有activation继续按其local historical snapshot+compatibility table重放，不追溯换题；
- Contract 还可显式选择零个或多个 **project-local opt-in** policy extension。Contract 中的每个 selector entry 是 provenance envelope，绑定 `ae.policy-extension.v1` content artifact ref/digest、source feature/activation/Contract refs+digests、publication artifact-observation 与 human-attestation event refs/digests，以及 source finalized-event/external-journal/target-snapshot refs+digests；content artifact 本身不引用未来 finalized/journal，避免 snapshot 循环。Resolver 必须从 source `proofs_at_commit` 证明这两个 event分别属于 source current revision 的 selected passed attempts、共同绑定同一 artifact A，且 source Contract 是 `feature_kind=policy_extension_release`。错/旧/nonselected event、普通 feature 的 shape-valid artifact、active/uncommitted feature、手工放入 `.ae/policies` 的文件或仅有 proposal 的 artifact均不可选；
- Candidate 生成时先验证 origin chain，再把 extension catalog/source bytes byte-for-byte、content-addressed、no-clobber 地复制并 fsync 到本 feature 的 `contract/policies/extensions/<content-digest>/`，selector envelope 同时绑定 local snapshot ref/digest 与 origin attestations；coverage/view 针对这个 local snapshot。Activation 在 authority lease 内重验 origin 与 local bytes。Activation 后 Gate **只读本 feature 锁定快照**，不再跨 target 回读 origin；未来 origin 损坏使 source policy feature 自身 integrity error，但不追溯改变 consumer Contract。手工 local snapshot 因缺 admissible origin envelope 仍不能 activation；
- 为保持 v1 可归约，`ae.policy-extension.v1` 每个 content bundle **恰含一个新唯一 floor ID**，不实现 supersedes/retire reducer。Selected extensions 与 base 按 content digest 排序后做纯 floor-catalog union；重复 floor ID、source/proof/journal/snapshot mismatch 或 schema 不合法都阻止 activation。收紧由未来人确认的 Contract 选择新 extension 并不再选择旧 extension；退休就是新 revision 省略整个旧 extension。它是可复用的 opt-in project library，**不承诺自动约束所有未来 feature**；真正 project-wide promotion 需要另一条 human-confirmed project-policy activation/current chain，不进入 v1；
- `.ae/policies/adapters-v1.json` 是 closed adapter registry，逐项绑定 adapter ID、schema version、build digest、config schema 与可产生的 typed fact schema。Contract 顶层绑定 registry ref/digest；recipe 中的 adapter 必须精确命中该 registry，direct assertion 引用的每个 fact/field 必须在该 adapter 的 fact schema 中有唯一生产者，否则 Contract invalid；
- `.ae/policies/cc-tool-mapping-v1.json` 是closed host mapping catalog，每项绑定CC version/invocation-mode compatibility selector、AE abstract capability→actual tool的唯一映射、read/write/risk classification、qualification suite 与passed result refs/digests。Contract、Seat、input manifest与dispatch exact绑定该policy entry，preflight做live probe；unknown tool、同名工具语义已变、selector/result不匹配或caller-supplied临时mapping均不可dispatch rights-sensitive seat。Session capability snapshot是`input-manifest-v1` 中的closed `$def`，只记observed host state，不取代qualified catalog；
- `.ae/policies/renderer-registry-v1.json` 是closed trusted compatibility catalog，每项绑定renderer kind（contract/human/publication/prompt/rollout）、bundle manifest/raw member digests、deterministic input/output schema、semantics version、runtime selector与golden qualification result。Authoritative view producer只能快照并执行命中该registry的exact bundle；feature/rollout目录中的任意脚本即使digest自洽也不是trusted code。Contract绑定registry ref/digest，rollout candidate绑定cutover时project registry entry；missing/tamper是integrity error，known semantics但当前Gate不支持是unsupported version；
- `.ae/policies/runner-v1.json` 携带closed provider qualification catalog；每项固定`provider_id`、build digest、影响隔离语义的exact runtime compatibility selector（OS/kernel/build、architecture、container/runtime engine，以及provider能力依赖时的filesystem/mount维度）、逐capability声明、suite digest与immutable result ref/digest。Closed result必须pass并反向绑定suite/build/selector/逐capability观测/release；missing/failed不是qualified。Recipe/Contract锁定policy；preflight exact match再live probe，execution environment/result复写。未注册、result失败或selector/probe mismatch启动前`unavailable`；已运行但claim/ref/fact不一致`invalid`，不能凭字符串升级资格；
- base/extension policy bundle 都携带 closed `floor_catalog`（active floor ID + source/semantic digest），其 deterministic union digest 必须等于 Contract 的 `effective_floor_catalog_digest`。Candidate 的 `project_floors` 必须对 effective catalog 中每个 active floor **恰有一个** closed-union disposition。两支共同要求 floor/catalog-entry/policy-source refs+digests、完整 applicability definition、applicability-facts ref/digest；`bound` 另内联完整 obligations 且 `not_applicable_reason=null`，`not_applicable` 禁止内联 obligations、但要求非空 reason、catalog-definition digest 与 applicability-definition digest。缺项、重复、catalog 外伪条目或未被 coverage adjudicate 的 N/A 都禁止 activation；
- bound project floor 的 `policy_source_ref/digest` 必须命中 selected base/extension bundle entry 的 raw bytes，只提供可审计 provenance。`inline_definition_digest` 固定为 JCS(`{"id": floor.id, "applicability": floor.applicability, "obligations": floor.obligations}`) 的 SHA-256；Gate 验证后只以内联定义出题，任何 policy source 都不能在运行时覆盖它。

Floor disposition 使用 closed `oneOf`，不能靠字段可选性猜分支：

| 分支 | 必填 | 禁止 |
|---|---|---|
| `bound` | `id`、`catalog_entry_digest`、policy source ref/digest、完整 `applicability`、facts ref/digest、完整非空 `obligations`、`inline_definition_digest`、`not_applicable_reason=null` | N/A 专有字段 |
| `not_applicable` | `id`、`catalog_entry_digest`、policy source ref/digest、完整 `applicability`、facts ref/digest、`catalog_definition_digest`、`applicability_definition_digest`、非空 `not_applicable_reason` | 内联 `obligations`、`inline_definition_digest` |

`ae.floor-applicability-facts.v1` 在 candidate disposition 写入前生成，绑定 feature、base activation（尚无任何activation时两字段均为null）、base product manifest ref/digest、pre-activation seed ref/digest、candidate-time effective-delta projection digest、`change_boundary` canonical projection digest、policy-set/catalog digests、matcher/predicate build，以及每个 floor 的 sorted typed input facts；它**不含 candidate/view digest**，因此不形成 candidate↔manifest 循环。Coverage input manifest 引用 exact facts 与 seed。Activation 在 authority lease 内从同一 baseline/boundary/policy set、重验后的 exact seed 与 candidate-time current snapshot重算并要求 byte-equivalent；过期或无法求值时 candidate blocked/unavailable，不能自动写 N/A。

N/A 不是永久豁免。Gate 对每次 `active|paused` status 与 finalize 都用 `locked_pre_activation_seed ∪ current_post_activation_delta` 和 revision 锁定的 predicate build 重算 effective catalog 中**每一个** floor：

- activated `not_applicable` 且当前仍不命中 → floor status `not_applicable`，满足该 floor；
- activated `not_applicable` 但当前命中 → floor status `invalid` + `floor_disposition_mismatch`，ineligible；controller 只能提出 amendment，Gate 不自动改分支；
- activated `bound` 但当前不命中 → floor status `not_triggered`，满足该 floor；
- activated `bound` 且当前命中 → 全部 obligations 必须 passed。

Eligibility fingerprint 覆盖全 catalog 的 applicability inputs/evaluation/disposition/status，而不只覆盖最终触发的 obligations。这样“lock 时 docs-only N/A，work 后新增安全路径”会稳定 fail closed。

`falsifier` 是 AC 的业务语义反例，进入 revision/view digest，但不是 Gate 可执行字符串。Coverage evaluator 必须回答“当前 proofs/rubric 是否真的可能暴露这个反例”；Gate 仍只执行 typed assertion、allowlisted adapter 与 canonical verdict，绝不因 falsifier 非空就认为 AC 可证。AC 数量可在 draft UI 提示过宽并要求解释，但 v1 不设置任意固定数量的 schema hard cap。

`feature_kind` 是 closed enum `product_change|policy_extension_release`。后一分支必须有 closed `publication = {artifact_proof_id,human_proof_id}`：前者指向本 revision 的 `artifact/judge` proof，后者指向 `human/human` proof，且human proof的Contract `human_subject={kind:mutable_observation,resolver:selected_artifact_observation,artifact_proof_id}`。Artifact digest在work后才产生，因此不写回Contract；运行时human attestation必须绑定artifact proof **current selected passed attempt**的observation、content raw digest与完整publication view。错/旧/nonselected observation、另一digest或只批准schema没批准bytes都不能闭合。未得同一artifact A的两条proof不能finalize或成为extension source。它仍走普通Contract/Ledger/Gate/finalizer，不新增done writer/current pointer。

Change boundary 也按 `feature_kind` 封闭：`product_change` 要求非空 `product_roots`；`policy_extension_release` 要求 derived `feature_origin=new`、`product_roots=[]`、`generated_or_non_product` 明确覆盖 feature-internal artifact store，并要求 `new_workspace` seed affected set/count=0 的完整枚举证明。Extension content 只写 immutable feature artifact，不伪造 repo product mutation；但 AC、artifact proof、publication human proof与 floor dispositions仍须非空/完整。Policy release携带非空 product roots、普通 product feature给空 roots、或 empty seed无 completeness proof都 schema/policy invalid。

人类批准视图由versioned deterministic renderer从candidate单向生成，approval/lock绑定trusted local renderer bundle与view digest。任何material字段不得只藏JSON或被summary省略：shared分支展示feature kind/origin、seed/provenance、prior activation/union、project product universe/control-exclusion digest、boundary/affected摘要、Intent/Scope/AC/source/falsifier/required_*；policy release展示publication IDs/subject；command展示recipe/security/adapter；artifact展示contract/rubric；human展示question/response/acceptance与mutable-observation selector或decision-only scope/警示。Floors逐项展示。Base-null candidate明示initial并将全部字段视为addition；base-nonnull展示完整diff。Golden fixture证明任一material变化改变view；renderer升级不因回读current bytes使既有approval失效，而由local bundle重放。

Renderer把所有 Agent/user/policy/artifact strings视为 untrusted data：动态文本只能进入 fixed indented literal record，使用 `safe-literal-v1`逐 codepoint编码；换行、backslash/quote、backtick、`<>&`、ANSI/control、bidi override与zero-width/format codepoint都显式转义，禁止 raw HTML与动态 Markdown结构。Unpaired surrogate/非法UTF-8直接 invalid。这样 `<details>`、HTML comment、fence与U+202E不能隐藏/重排字段。Renderer policy还锁定 live-qualified `approval_view_max_bytes`；v1不分页，超过上限或host adapter不能证明传给AskUserQuestion的完整safe-view request bytes与`view_digest`一致时，candidate固定 `view_delivery_unavailable`，不得用“文件已保存”或summary取得approval。此限制约束可见字节，不设置AC数量hard cap。

Proof 是以 `mode` 为 discriminator 的 tagged union；不能把任意字段组合塞进同一宽松对象：

| `mode` | 必填专有字段 | 允许的 `closure.kind` | 可闭合 event |
|---|---|---|---|
| `command` | `source_set`、`recipe` | `direct` 或 `judge` | direct: `command_result`；judge: `command_result` + `judge_verdict` |
| `artifact` | `source_set`、`artifact_contract`、`rubric` | `judge` | `artifact_observation` + `judge_verdict` |
| `human` | `question`、`response_schema`、`acceptance_rule`、closed `human_subject` | `human` | `human_attestation` |

正式 JSON Schema 必须用封闭的 `oneOf` 编码这张表，而不是只在文档中说明：`command/direct`要求assertions且禁rubric；`command/judge`要求rubric且禁direct assertions；`artifact/judge`要求artifact contract+rubric；`human/human`要求question/response/acceptance+`mutable_observation|decision_only` subject union。任何额外mode/closure或互斥组合都是schema error。

`command/direct` 的 assertions 只能来自 v1 allowlist，不能是可执行表达式字符串：

- `exit_code_in`；
- `signal_is_null`；
- `matched_count_at_least`；
- `output_not_truncated`；
- `manifest_unchanged`；
- `json_pointer_equals`；
- `artifact_exists_with_digest`；
- `path_state_is`；
- `selector_present_count_equals`。

新增 predicate 需要 schema version、reducer 实现与 golden fixture，不能由 recipe 临时注入代码。

`artifact` proof 的最小专有形状：

```json
{
  "id": "P-02",
  "mode": "artifact",
  "source_set": {
    "selectors": [
      {
        "id": "S-artifact",
        "kind": "glob",
        "pattern": "src/**",
        "existence": "must_exist",
        "universe": "tracked_plus_declared_untracked",
        "declared_untracked": ["src/new-file.ts"],
        "gitignored_policy": "exclude",
        "symlink_policy": "within_root"
      }
    ]
  },
  "artifact_contract": {
    "set_semantics": "exact",
    "required_artifacts": [
      {
        "logical_ref": "implementation-report",
        "allowed_media_types": ["text/markdown"],
        "min_bytes": 1
      }
    ]
  },
  "closure": {"kind": "judge"},
  "rubric": {
    "question": "实现是否满足 AC-02 的每个业务条件？",
    "pass_conditions": ["每个条件有 source/event 引用"],
    "fail_conditions": ["任一条件缺失或引用不可达"]
  },
  "required_independence": "fresh_context",
  "required_family": "any",
  "required_assurance": "canonical_recorded"
}
```

`human` proof 的最小专有形状：

```json
{
  "id": "P-03",
  "mode": "human",
  "closure": {"kind": "human"},
  "question": "该交互结果是否符合预期？",
  "response_schema": {
    "type": "single_select",
    "options": ["accept", "reject"]
  },
  "acceptance_rule": {"accepted_values": ["accept"]},
  "required_independence": "human",
  "required_family": "not_applicable",
  "required_assurance": "workflow_attested"
}
```

`command/judge` 使用与 artifact 相同的 `rubric`，但 judge 必须同时引用 canonical `command_result`；它不能把语义判断退化为第二次执行命令。

Closed union 还有不可放宽的conditional：`closure.kind=judge ⇒ required_independence=fresh_context`，适用于 `command/judge` 与 `artifact/judge`；`command/direct` 才可为 `none`，`human/human` 固定为 `human`。将judge填成`none`不是降级运行，而是Contract invalid。

所有 authoritative schema 使用 `additionalProperties: false`（组合 schema 用等价的 `unevaluatedProperties: false`）。这不只覆盖 Contract/event：external JSON `release-manifest|runner-policy|adapter-registry|lineage-registry|floor-policy|cc-tool-mapping|renderer-registry|qualification-result|tree-snapshot|shadow-epoch|origin-marker|migration-commit|rollout-approval|contract-lock|current-pointer|legacy-manifests|rollout-lock|transaction` 都有独立 closed schema（或被明确命名的 closed `$defs` 独立 file validation），Gate不用手写宽松parser代替。AC ID在Contract内唯一；**所有AC proof与bound floor obligation的ID在整个Contract proof namespace内全局唯一**，event的`proof_id`因而只有一个owner path；selector ID在所属source set内唯一并随proof ID限定。Schema后的deterministic semantic validator必须拒绝跨AC、AC↔floor或floor↔floor duplicate proof ID，不能靠遍历顺序选owner。`acceptance_criteria`、每条AC的`proofs`、direct `assertions`、rubric的pass/fail conditions、适用floor的obligations都不得为空；`product_roots`/seed affected set只按上文feature-kind/origin conditional允许为空。空白字符串、duplicate JSON key、versioned denylist中的known placeholder argv与unknown field hard error，不能形成vacuous Contract；任意语义等价no-op不作不可实现的静态承诺，交给typed non-vacuity/adapter/coverage。

Current authority不是某revision文件存在，而是单调激活链。所有candidate-bound schema共用closed `candidate_identity`：`{revision_id,candidate_generation,revision_ref,revision_digest,candidate_semantic_digest,coverage_question_projection_digest,activation_policy_epoch_digest,view_ref,view_digest,seed_ref,seed_digest,floor_facts_ref,floor_facts_digest,base_activation_ref,base_activation_digest}`（initial base pair null）；不得只传revision ID临时查目录。Coverage另用`coverage_subject_identity={feature_id,base_activation_digest,candidate_semantic_digest,coverage_question_projection_digest,seed_content_digest,floor_facts_content_digest}`，不含R/G/view/storage refs，是跨instance语义身份。

```text
Ledger 中最新的 contract_activated（activation_seq 单调 + prev_activation_digest）
  → exact candidate_identity + generation-qualified lock ref/digest
  → matching immutable revision/view/seed/floor-facts bytes
  → admissible first-latched coverage_review（同一 identity，零 unresolved material gap）
  → existing contract_approval event（同一 identity/view/coverage summary）
  ↔ current.json 必须精确镜像 activation 中的 generation-qualified refs/digests
```

`contract_activated` 是唯一 revision commit record；`contract_approval` 只表示人确认了候选，不能自行改变 current。Approval → lock → activation 中的 `candidate_identity` 必须 byte-equal；coverage D/review同时绑定当时instance与`coverage_subject_identity`。Selected instance默认必须等于reviewed instance；唯一例外是下文受限的presentation-only rebind，它可引用**已green** review且必须重算subject byte-equal，绝不产生第二review。Status 与 finalizer 只能通过 latest activation 解引selected identity。`current.json` 是受校验的定位缓存，使用临时文件写入、file fsync、原子 rename 与 parent-directory fsync。孤立 revision、coverage、approval 或 lock 都不改变 current authority。持久态无法区分“activation 后 pointer 前崩溃”和“手工把 pointer 回滚到较旧合法 activation”，因此二者统一为 `integrity_recovery_required`：Gate 停止 closure，recovery 只能把 pointer 前推到 latest activation，绝不能恢复旧考题。Pointer 指向非 activation/ahead target，或其 digest/chain 不合法，才是 `integrity_error`。

Candidate 准备、coverage 与 human approval 不跨模型/人类等待长期持锁；每个 generation直接写在 `contract/revisions/<revision>/<generation>.json` 与 `contract/views/<revision>/<generation>.md`，路径与bytes immutable但在被activation选中前都是inert candidate，没有“固定R0001槽复制”步骤。Revision ID 在一个candidate series建立时永久占用；明确拒绝/废弃后新draft使用下一revision ID，不复用旧ID。同一revision内generation严格单调；普通同值bytes换ref/时间戳必须返回既有generation。唯一same-subject新G是closed `generation_reason=presentation_rebind`：它必须绑定prior identity/review，Contract material、seed/floor content、coverage subject全部byte-equal，只允许renderer/view/delivery metadata变化；prior review必须green才可复用，prior gap/fail仍永久blocked。每个revision最多一条activation，activation后不得再生成该revision的新generation。

`generation_reason` 不靠path或caller自报：`contract_approval` 与 `contract-lock-v1` 都必须携带byte-equal closed `candidate_generation_binding`。普通branch为`semantic_change`，绑定prior identity（如有）与typed material resolutions；`presentation_rebind`分支必须绑定prior candidate identity、green coverage review ref/digest、old/new renderer/view/delivery digests与Gate重算的same-subject proof，并禁止任何revision/seed/floor/content semantic改变。`contract_activated` 引用该binding digest。缺字段、gap review、material change或approval/lock mismatch都fail closed。

每个event append只短暂取得recorder lock，且全部绑定同一base activation digest。最终commit才短暂取得repo `authority_commit` lease、再取得stable feature lock，重验base/candidate/latched coverage source、product baseline与exact seed，写 `contract/locks/<revision>/<generation>.lock.json`并fsync，再append `contract_activated`直接选择exact `candidate_identity` 与 generation-qualified lock，最后atomic pointer replace。若source/baseline/seed enumeration已变则deterministic conflict，只有semantic projection确实改变才生成更高generation并重做coverage/approval；旧generation永久inert。若在activation event前崩溃，generation/lock都是inert orphan且不改变current；若在event后、pointer前崩溃，Gate不运行产品closure，recovery只能补pointer，不能退回旧revision。所有activation后attempt/proof/lifecycle event还必须exact绑定current activation ref/digest；只有Contract bytes相同不能复用旧activation证据。

`feature_origin` 是与 `feature_kind` 正交的 closed authority union，而不是 Contract 作者自报的标签。每个 v1 Ledger的第一条 event必须是下文 canonical `feature_origin_established`。其 `new` branch只由 dedicated creation routine在 feature path尚不存在时、repo authority lease内 no-clobber生成；`migrated_legacy` branch只由 converter引用 rollout lock所绑定 `legacy-live-v1` inventory中 matching ID/path + 双 origin-marker entry，cutover tree digest只作历史 provenance、不是迁移时 current-tree equality门。Contract origin引用该 genesis event；branch冲突、缺 authority、marker mismatch、pre-cutover live path自报 new或手工补 marker都 `integrity_error`。首次 v1 `contract_activated` 后，所有 revision 的 origin kind/authority ref/digest必须 byte-equal，不是人类可 amendment 的 scope。

每个 Contract 都必须单向绑定一个 immutable `pre_activation_seed`，不能把 activation 前已存在的 product change 吞进“clean baseline”：

- `feature_origin=new` 要求 `seed_origin=new_workspace`。Creation origin snapshot绑定 repo commit/tree/index comparison base与当时完整 staged/unstaged/non-ignored-untracked/tombstone enumeration；Seed收录 approved product roots中相对该 comparison base已变化的 tuples。Pre-creation dirty bytes不是 comparison base，因而在后续 revision仍保留，直到确实恢复为绑定 Git base；若完整枚举证明 dirty count=0，才允许空 seed；
- `feature_origin=migrated_legacy` 在v1只允许 `seed_origin=human_adopted_conservative`。当前legacy没有canonical mutation-start authority，Git ancestry、目录mtime、旧goal/review prose、人类声称或host-correlated的**事后**快照都不能证明某tree早于首个feature mutation；因此v1明确不发布`verified_historical`支，避免把已commit结果D自报为base并洗出空seed。Conservative不能只采纳current tree：它绑定closed historical-path-universe completeness proof，用versioned enumerator枚举approved roots从可验证repository root到migration snapshot的完整reachable Git object/path history，再union current index/worktree/untracked；历史出现但current不存在的path全部作为unknown-conservative tombstone，current present也全部进入。Shallow/partial/missing object/遍历失败或coverage不全固定`migration_blocked`；
- v1 的product boundary不允许用Git ignore隐藏产品输入。Enumerator遍历product roots下全部受支持file types（排除`.git` control tree），绑定repo/worktree/info/global exclude的effective rule/config digests；任一ignored entry必须显式且唯一命中locked `generated_or_non_product`，否则seed/candidate invalid。因此source selector虽可对非产品evidence使用`include_declared`，ignored product不会被默认为absent；ignore规则漂移也会改变enumeration fingerprint并fail closed；
- binding 固定 `seed_ref/digest`、`seed_origin`、`seed_generation=initial|carried_forward`、versioned `enumerator_build`、origin snapshot与 enumeration snapshot refs/digests。每个 affected tuple带 `comparison_base=known(ref,digest|absent)|unknown_conservative`。条件只看authority：`base_activation_ref/digest=null ⇔ seed_generation=initial ∧ supersedes=null`，与R编号无关；`base_activation≠null ⇔ seed_generation=carried_forward`，且必须绑定prior activation ref/digest与prior effective-union digest。因此R0001被拒后R0002仍可initial，首次activation后的revision必须carry-forward。Carry-forward以真正comparison base做net delta；Git commit/index reset/new revision不能重置。Known tuple只有current恢复base才消失，unknown不自动消失。若revision扩大到origin snapshot未完整枚举的boundary segment，必须从locked project-universe activation baseline+current snapshot做human-visible conservative adoption，把该segment全部present及baseline→current tombstone纳入；baseline本身也无coverage时blocked，不能按current absent推clean。Seed以canonical/no-clobber写入`contract/seeds/<digest>.json`，绑定feature、boundary projection、provenance与tuples但不绑定candidate digest以避环；Contract再单向绑定seed，重复字段完全相等；
- coverage input/review、approval view/event、revision lock 与 `contract_activated` 都绑定这一 exact seed。Activation 在 authority lease 内用锁定 build 重枚举并与 snapshot 比较；成功后 Gate 只读 activated revision 锁定的 seed bytes，绝不按以后 workspace 重生成。

正式 schema 可扩展字段，但必须保持以下语义：

- AC 描述业务结果，不写 Agent 编制或执行拓扑；
- derived feature-origin authority、pre-activation seed binding/provenance 进入 revision；任一 origin/seed-origin/generation 不合法组合、跨 revision origin 改写、missing/swap/tamper/orphan seed 都 fail closed；
- proof recipe、source set、closure 与 `required_*` 都进入 revision digest；
- project floor 在锁定时必须把 applicability、baseline 与完整 obligation 展开进 revision；`policy_source_ref/digest` 绑定 bundle 中的 raw source，`inline_definition_digest` 单独覆盖 `id + applicability + obligations` 的 canonical projection。Gate 不从 source policy 或可漂移的 `pipeline.yml` 重新取考题；
- recipe 的 effective runner policy、sandbox、network、credential 与 output-root 约束都进入 revision/lock digest；policy ref 内容漂移不会静默改变当前执行语义；
- Strategy 的 step 同时引用 AC ID 与 proof ID；
- selector 可选择满足方式或加严临时检查，不能降低 `required_*`；
- capability 不足产生 `unavailable`，不能重写 Contract。

### 3.3 Material change

以下任何变化必须生成新 revision 并由人确认：

- feature kind、pre-activation seed/provenance、Intent、Scope、non-goal 或业务约束；`feature_origin` 不在可变列表，首次 activation 后永久固定；
- AC criterion、来源、后果或 falsifier；
- proof mode、source set、recipe、assertion 或 rubric；
- change boundary、product baseline、generated/non-product exclusion；
- observation adapter 的 ID/schema/config/build semantics；
- lineage registry/policy ref 或 digest；
- CC tool-mapping policy/entry ref、digest、compatibility selector或qualification result；
- required independence、family 或 assurance；
- base/extension policy set、effective floor catalog digest、任一 floor disposition/N/A reason、applicability/baseline、`policy_source_ref/digest` 或 `inline_definition_digest`；
- effective runner policy、sandbox/network/credential/output-root 边界；
- 删除、弱化、替换或新增 required obligation。

Plan 顺序、实现方案、Agent 选择、retry cap、并发度与非强制诊断不属于 material Contract change。

### 3.4 修订棘轮

- 当前 revision 内，Agent/Strategy 不能删除、弱化或 waiver required obligation；
- 人类可通过新 revision 增删、放宽、收紧或改变范围；
- 旧 revision、批准记录与证据永久保留并标记 superseded；
- v1 跨 revision **一律不复用 proof pass**。旧 event 只保留为 superseded 历史；新 revision 必须重新取证。未来若要复用，需另行设计 proof-definition digest，不在 v1 留隐式兼容口。

### 3.5 Coverage review

锁定前，由 fresh-context evaluator 双向检查：

```text
Intent/Scope 中每个 material claim → 至少一个 AC
每个 AC → 可追溯到 Intent/Scope 或明确 project floor
每个 AC 的 proof set/rubrics → 集合上足以暴露其 falsifier，而不是要求每条 proof 单独覆盖全部反例
每个 required proof → 能实际运行或有显式 unavailable/human path
floor catalog 中每个 active floor → 恰有一个已审理的 bound/N/A disposition
```

Coverage 是语义 adjudication，不是 grep 仪器。Fresh evaluator 对一个已分配 revision ID 与 monotonic `candidate_generation` 的 immutable candidate 运行，dispatcher 提供受控 input manifest；它也必须走 canonical candidate-coverage dispatch → raw seat result → verbatim coverage normalizer，不能由 dispatcher 直接替 evaluator 写结论。`coverage_review` 绑定当时完整 `candidate_identity` 与 `coverage_subject_identity`、evaluator context、dispatch/result/input-manifest refs/digests、finding refs 与 coverage-summary digest；D/review两种identity必须byte-equal，approval/lock/activation则遵守上文exact-instance或presentation-rebind规则。Finding 使用 closed categories（至少含 `intent_uncovered|ac_untraced|criterion_not_falsifiable|proof_cannot_expose_falsifier|proof_unexecutable|floor_unbound|floor_na_unjustified|source_set_incomplete|contract_overwide`）并带 source refs/resolution；前者表示 AC 本身没有可陈述反例，后者表示反例明确但当前 proof set 测不到。类别本身不替代语义理由。

Coverage completion 使用 semantic-key single-flight + first-terminal latch。`candidate_semantic_digest` 覆盖 normalized material semantics：Contract字段值、policy/content digests、seed affected tuples与comparison bases、floor applicability typed values与matcher semantics；它排除revision/generation ID、storage ref/path、run/attempt ID、created_at和renderer/transport metadata。同值bytes换一个ref或时间戳必须得到同一key。另有 `coverage_question_projection_digest` 只覆盖evaluator实际审理的Intent/Scope/AC/proof/floor/seed/effective-delta normalized values，用来证明gap后考题真正改变。Dispatcher在 stable lock内保证同一 `{feature_id,base_activation_digest,candidate_semantic_digest}` 同时至多一条 authoritative coverage D；换revision ID或generation不会换key。已有in-flight D时第二条拒绝，adversarial Ledger含两条则candidate invalid。只有前一D在**未产生 normalized semantic review**时以canonical transport/capability terminal结束，才可为同一semantic key新建D；已有raw semantic result不能先等第二席再挑有利结果。

同一 semantic key至多一条合法 normalized `coverage_review`，Ledger中第一条即永久 authoritative；其后固定 `coverage_already_completed` conflict。只有 latched review的 `unresolved_material_gaps=[]`才可进入lock；一旦有gap，该 semantic digest永久不可批准。下一 generation必须同时改变semantic digest与`coverage_question_projection_digest`，并绑定prior review ref/digest以及每项typed resolution；resolution项指向prior finding ID、changed material field path及old/new normalized value digests，Gate可重算其实际变化。补AC/proof/source或把事项经人确认写入visible out-of-scope都会改变语义；只换ref、created_at、revision或generation不会。仅transport/capability failure可同语义重dispatch；“预发D1/D2后挑 favorable S”、“只bump R/G反复抽 reviewer”或“same bytes换ref”均拒绝。随后 `contract_approval`必须绑定exact `candidate_identity`、用户实际看到的renderer build与该latched coverage event/summary digest，lock同时引用两个event digest。

### 3.6 Assurance 不是一条全局高低链

`required_assurance` 是按 proof mode 校验的 typed predicate：

| 值 | 准确含义 | 适用对象 |
|---|---|---|
| `canonical_recorded` | canonical runner/recorder 产生并绑定 digest | command fact、artifact observation、judge event |
| `host_recorded` | CC host transcript/hook 可关联到一次 operation | Agent/tool invocation provenance |
| `backend_correlated` | host operation 与外部 backend invocation/input/result 可关联 | required external-family judge seat |
| `workflow_attested` | foreground human interaction可关联，但无独立 principal credential | approval、human proof |
| `host_verified` | host 提供经 P0 实测可独立验证的 user principal credential | approval、human proof |

`self_reported` 只是一种诊断来源，永远不能满足 required assurance。以上值不是可互相随意比较的单一等级：例如 `backend_correlated` 不能替代 human approval，`host_verified` 也不能证明测试命令执行。Schema 必须按 proof/event kind 检查合法组合。

Authoritative event 保存 `assurance_claims[] = {kind,attestation_ref}`；`canonical_recorded` 是所有 proof/authority event 的共同必备属性，而不是其他域可替代的“低等级”。Gate 只承认两条同域蕴含：human 域 `host_verified ⇒ workflow_attested`，invocation 域 `backend_correlated ⇒ host_recorded`。除此之外都不蕴含；尤其 backend 不能满足 human，human 不能证明 command。Contract 的 `required_assurance` 在对应域按这张 matrix 检查，并另行要求 canonical recorder；每个合法/非法组合都要有 golden fixture。

## 4. 三种 Proof Mode

`unit`、`integration`、`e2e`、`contract` 是测试 scope，不是四套运行语义。v1 只有三种 proof mode。

### 4.1 `command`

确定性进程产生 observation，Gate 根据被锁定 assertion 直接归约，或由 Contract 指定的 judge 判断语义充分性。

必须记录：

- exact argv，不记录模糊的 shell prose；
- cwd、受控环境、timeout、network/credential policy；
- stdout/stderr 原始 artifact 与 digest、exit code/signal；
- pre/post source manifest；
- matched tests/count 等 non-vacuity fact；
- `ae.execution-environment.v1` ref/digest：resolved executable identity/version、允许 env、OS/arch、sandbox provider/build 与声明 dependency/service facts；
- run、attempt、proof、contract 与 runner build。

`exit 0` 不自动代表 proof pass。所有 direct assertion 都必须为真；零测试、placeholder、解析失败或 source 漂移按唯一状态 fail closed。

Canonical `command_result.outcome` 的归约固定：`policy_violation|source_drift|adapter_error|required_input_truncated` 是 observation `invalid`；sandbox/backend/credential preflight 不足时根本不启动 command，而由 capability observation + attempt terminal 得到 `unavailable`；`exited|timed_out|signaled` 是可验证进程事实，其中 timeout/signal 固定 `failed`，正常 exit 再由 Contract assertions（包括允许的 exit code、zero-match）决定 `failed|passed`。只有与 predicate/adapter 无关的 diagnostic preview 可截断而不 invalid；任何 required bytes 被截断都属于 `required_input_truncated`。

`matched_tests` 等字段不能从任意 stdout 猜测。Recipe 必须锁定一个 bundled、allowlisted `observation_adapter` 的 ID/schema/build/config，优先消费 JUnit/JSON 等机器可读 artifact；adapter registry 的 typed fact schema 必须静态覆盖 assertions 引用的每个 field，运行结果也必须携带同一 adapter/config/fact-schema digest。Adapter artifact 缺失、required fact 缺失或解析失败使 attempt `invalid`，合法 count=0 使 non-vacuity assertion false、proof `failed`。v1 不允许 Agent 注入 regex/parser，也不保留旧 collector 的 hard-coded prose parser。

Runner/wrapper 自身的 process status 与 child command outcome 是两个域：wrapper 成功只能表示“按 policy 执行并 canonical recording 完成”，绝不表示 proof pass；child 的 exit/signal/timeout 只写进 `command_result`，由 Gate assertion 归约。边界结果固定为：Contract/static policy rejection 在 attempt 前 hard error；preflight capability 缺失由 capability observation + closed unavailable 表达；child 启动后的 policy violation/source drift/adapter error/required truncation 由 canonical result + completed attempt 归约为 invalid；**recorder/internal persistence failure 不能要求同一个 recorder 再记自己失败**，wrapper 必须 nonzero、不得产生 proof claim，attempt 保持 open/pending，或由 Ledger/head recovery 投影 `integrity_recovery_required`。调用方不得把异常被捕获、wrapper exit 0 或“payload 写入成功”映射成绿色。Child-127 回归 fixture 明确使用能成功产出 process facts 的 `process-v1` adapter/helper binary，Contract 要求 `exit_code_in [0]`；事件如实保存 127，assertion=false，proof `failed`。若另一个 fixture 要求 JUnit artifact 而 127 导致 artifact 缺失，则按 adapter error 唯一归约为 `invalid`，不能共用预期。

### 4.2 `artifact`

用于需要阅读代码、文档、UI、diff 或设计产物的语义判断。

`artifact_contract`不是给judge看的提示，而是Gate先执行的completeness约束。V1固定`set_semantics=exact`：`required_artifacts[]`按unique logical ref排序，每项锁allowed media types与minimum raw length。Canonical `artifact_observation`携带closed manifest，按logical ref排序列出每个实际artifact的`{logical_ref,artifact_ref,raw_digest,media_type,byte_length,author_anchors}`；ref必须解析到immutable raw bytes，digest/length/media与host-attested producer事实一致。Gate在judge dispatch前与closure时重算，要求实际logical-ref集合与Contract exact相等、逐项type/length匹配且每个required raw ref/digest实际进入judge input manifest。Missing、duplicate、undeclared、wrong-media、same-name wrong-digest、swapped或existent-but-undelivered artifact先使precursor `invalid`，judge不能用语义pass兜底。

Evaluator 必须：

- 使用 fresh context；
- 接收 dispatcher 构造的受控 input manifest：Contract/source 与允许的 artifact/event refs 分离，executor summary 明确排除；
- 对每个结论给 source/event 引用；
- 使用 `ae.judge.v1` 输出；
- 不读取 executor 的结论性 step summary 作为事实；
- 不把无法访问、格式错误或缺 provenance 补写成 pass。

一个 evaluator 只回答一个 proof question。全局 review summary 是投影，不是 closure。

### 4.3 `human`

用于只能由人确认的感知、业务取舍、外部动作或主观验收。事件必须绑定：

- 精确问题与可选项；
- feature、revision、AC、proof；
- user turn/session correlation；
- 结果与时间；
- `workflow_attested` 或经实测允许的 `host_verified` assurance；
- 该回答是观察证明，还是授权新 amendment。

每个 human proof 的 Contract 定义必须含 closed `human_subject` union，不能只写问题文本：

- `mutable_observation` 表示回答依赖当前可变字节或观察。定义中锁定 nonempty material selector 与 versioned current-subject resolver；运行时 foreground adapter 先生成 `ae.input-manifest.v1`，其中 `human_subject_identity={proof_definition_digest,source_fingerprint,material_projection_digest,material_refs[]}`。`material_refs[]` 是按 logical identity 排序、nonempty 的 closed `{kind=source|artifact|event,ref,digest}` 集合，且每项必须既存在又实际进入交付 view；
- `decision_only` 只用于不依赖任何可变字节的业务授权/取舍。它必须带 human-visible `decision_scope` 与理由，input manifest 的 source/artifact/event material refs 必须为空；Contract view 与 coverage view 都显著显示“本回答不会证明任何可变产物”。用它确认 UI、文件、命令结果或实现正确性固定为 Contract/coverage invalid，而不是一种廉价 waiver。

Human renderer 从 proof definition + exact input manifest + material bytes生成单一 `safe-literal-v1` view；required bytes/visual artifact不得省略或截断，超限为human-channel `unavailable`。`human_attestation` 必须exact复写 `human_subject` branch、subject identity、input-manifest ref/digest、renderer build、view/request ref/digest、user turn/session correlation与回答。Gate对`mutable_observation`用Contract resolver从**当前 selected** source/artifact/event重新生成manifest与identity：存在但未交付、wrong digest/selector、view不匹配为`invalid`；曾交付A而current变为B则旧回答为`stale`，不能由同revision的其他command/judge proof洗绿。`decision_only`只要Contract仍是current且零mutable refs，可按普通attempt规则重新选择，但仍不能改变Contract。

human proof 不等于给 executor 任意 waiver。改变 Contract 必须另建 revision。

`policy_extension_release` 的 publication human proof 是封闭特例。`ae.policy-extension.v1` artifact 是 canonical manifest：按 logical path排序列出每个 UTF-8/no-BOM semantic member的 media type、byte length与 raw SHA-256，且恰好定义一个新 floor ID；v1 禁止未列出的 member、symlink与 binary member。Content digest覆盖 manifest bytes，member替换必改变 manifest/content digest。

Versioned deterministic `publication-view-v1` renderer 只接受 current selected passed artifact observation、canonical manifest与逐 member raw bytes，输出完整 ordered manifest + 每个 semantic member的**未截断 exact text**；不允许 summary/省略。`human_attestation` 绑定 renderer build、renderer input-manifest ref/digest、artifact-observation event ref/digest、manifest/content ref/digest、全部 member-digest list与 publication-view ref/digest。Gate从 selected observation重新读取/复算每个 member、renderer input与view bytes，要求与 event完全相等；omitted/truncated/member-swapped view固定 invalid。普通 Contract approval、旧 artifact attempt的 human answer或只接受 schema/top-level digest不能替代。
Publication renderer复用 `safe-literal-v1` 与同一类 live-qualified single-view byte limit；exact text按确定性 byte-offset records安全编码，内容不能闭合Markdown/HTML容器。超限固定 publication proof `unavailable`，必须缩小单-floor artifact或另提Contract，不能截断后询问。

### 4.4 多 obligation 与 project floor

一条 AC 可以要求多个 proof，全部满足才闭合。代码修改还可触发 revision 已绑定的 project floors，例如：

- 相关回归测试为绿；
- 新代码确实被执行；
- 声明的 source set 无未解释漂移；
- 安全敏感路径需要独立 semantic proof。

Floor 是受版本控制的考题，不是运行时由 worker 任意读取的可变配置。

## 5. Command Runner 安全边界

Agent-authored recipe 是代码执行面。v1 的 canonical runner 至少强制：

| 风险 | v1 约束 |
|---|---|
| 命令注入 | argv array + `shell=false`；若显式调用 shell，作为高风险 recipe 审核 |
| cwd/path escape | cwd 必须在 repo/批准 root 内；realpath 后拒绝 symlink escape |
| 无限运行 | timeout + process-group termination |
| 输出炸弹 | stdout/stderr 上限；完整超额内容写受控 artifact 或标 truncated |
| 环境/secret | 最小 env allowlist；默认不继承 credential 变量 |
| 网络 | 默认 deny；需要时 Contract 明示 policy 与后果 |
| 状态篡改 | Contract、Ledger/head、Gate/runtime、`.ae/policies`、rollout、lease/transaction、locked legacy-done/reserved 与v1 committed target authority paths 永不在 recipe write allowlist；除精确versioned可重建projection allowlist外，任何graph/index/backfill也不得写done subtree；pre/post 校验 |
| 并发污染 | feature/run lock；声明 output roots；共享端口/DB/fixture 必须串行 |
| sandbox 漂移 | 记录实际 sandbox capability；要求隔离而不可用时 `unavailable` |
| TOCTOU | run 前后都计算 source manifest；不同则 event invalid |

Runner 不复用 CC session 的静态 Agent sandbox 来隔离自己的 child；否则 parent recorder 需要写 Ledger、child 又必须禁写 Ledger，权限边界无法表达。修复 bootstrap 后、冻结大批 schema 前，P0 必须先做首发平台 isolation feasibility spike；随后资格认证至少一个独立 native/external child-isolation provider，产生上文closed、release-bound的qualification result artifact，并只在其exact compatibility selector内发布 `sandbox_requirement=policy_enforced`。Provider 必须分别证明 filesystem read/write roots、network、process descendants、timeout 与 cleanup；“命令退出”不等于已杀死 setsid/double-fork 后代。

Runner 在启动命令前探测 recipe 所需的隔离能力。若 qualified provider 不能提供被 Contract 要求的隔离级别，命令不得启动，由 canonical capability observation 得到 `unavailable`。若能力存在而命令尝试写 protected/output-root 外路径或违反 network policy，provider 阻断并记录 policy violation，当前 proof 为 `invalid`。前台 Strategy 可请求人类、修改执行环境、改用已资格化 external provider 或提出 amendment，但不能降级后重跑。`declared_only` 可以是批准视图中的诊断标签，却**不是**自动执行或 proof assurance 档：在该平台上 command 必须 `unavailable`，随后显式改为 human/artifact proof 才能继续。若 P0 在任何首发支持路径都找不到合格 provider，则 P1 `〔能〕` 与 1.0 release 均不能宣称通过；可收窄平台支持，不能收窄真实性门。

Runner 是分层防护，不改变同一 OS 用户可篡改整个工作区的威胁边界。

## 6. Evidence Ledger

### 6.0 Canonical bytes 与 digest

所有 authoritative JSON 使用 RFC 8785/JCS canonicalization 的受限子集：UTF-8、无 BOM、拒绝 duplicate keys、NaN/Infinity 与 floating-point 字段（v1 数值均为 schema-bounded integer），字符串不做实现私有 normalization。NDJSON 每行是一个 canonical event JSON，后接单个 LF；JSON payload 按 JCS bytes，binary/source artifact 按 raw bytes。Digest 算法固定 SHA-256，文本形态固定为 `sha256:` 加 64 位 lowercase hex；`event_digest` 仅排除自身字段。Markdown 不进入 Contract semantic digest、也不能反向生成 JSON；但 approval 的 `view_digest` 固定为生成 view 的 UTF-8/no-BOM/LF-normalized bytes 的 SHA-256，用来证明用户看到的具体版本。Pretty JSON、mtime 与平台换行不是 semantic digest 输入。

路径先按 manifest 规则转成 repo-relative logical UTF-8 path，再参与 canonical JSON；symlink 同时记录 link raw target 与已校验 real path。Gate 与旁路复核器必须共用 golden byte/digest fixtures，而不是“各自序列化后刚好一致”。

所有文中“tree/evidence snapshot digest”统一指closed `ae.tree-snapshot.v1`，不得由consumer自选算法。Snapshot绑定profile、algorithm/version/build、**subject** logical+resolved root identity与sorted entries；`projection_kind=observed`要求entries从subject root实际枚举。只为qualified same-filesystem atomic directory move提供`projection_kind=expected_after_move`：另绑定enumeration-source observed snapshot ref/digest、source/target resolved identities+device、exact move-plan/helper-result digest，并以source entries重写subject root为intended target；它不是声称target已存在。Path按合法UTF-8 raw bytes排序；entry记录relative path/type/mode，file另记length/raw digest。Symlink/hardlink/special file/碰撞拒绝，目录也入表，unexpected descendant不跳过。

三个profile的include/exclude set固定：`origin_complete`覆盖staging/final origin tree的每个descendant；`rollout_inventory`覆盖每个legacy feature tree的每个descendant（包括cutover前已发布的feature marker），零exclusion；`feature_evidence`只覆盖`contract/**`、`authority/**`、`ledger/events.ndjson`、`ledger/head.json`、`runs/**`与feature-internal origin marker，明确排除`index.md|plan.md|ledger/telemetry.ndjson|state/status.json`及外部transaction journal，且这些是closed exact paths/prefixes、没有caller-supplied glob。Excluded文件是非权威projection/strategy/telemetry；任何authority artifact只能落在included roots，included roots内的temp/quarantine/unknown file同样进入snapshot并造成预期digest变化。Prepared与committed snapshots都绑定profile/version/build；rollout manifest每项也绑定同一algorithm identity。Mutation fixtures逐个翻转path/type/mode/link/file bytes、增删unexpected file和exclusion边界，Gate、finalizer、rollout reader与旁路实现必须得到byte-identical digest。

### 6.1 Event envelope

所有 canonical event 共享一个 base envelope，再按 `event_kind` 使用 JSON Schema `oneOf` 约束专有字段；不存在用假 `proof_id` 填满 control event 的做法。

```json
{
  "schema_version": "ae.event.v1",
  "event_id": "EV-...",
  "ledger_seq": 42,
  "prev_event_digest": "sha256:...",
  "event_digest": "sha256:...",
  "idempotency_key": "...",
  "event_kind": "command_result",
  "feature_id": "F-123",
  "contract_revision": "R0001",
  "contract_generation": "G0001",
  "contract_digest": "sha256:...",
  "activation_ref": "event:EV-contract-activated",
  "activation_digest": "sha256:...",
  "producer": {
    "context_id": "...",
    "role": "runner",
    "family_lineage_id": null,
    "family_attestation_ref": null,
    "host_session": "..."
  },
  "payload_ref": "runs/RUN-.../events/EV-....json",
  "payload_digest": "sha256:...",
  "producer_build": {"plugin_version": "1.0.0", "component_digest": "sha256:..."},
  "recorder_build": {"plugin_version": "1.0.0", "component_digest": "sha256:..."},
  "predicate_semantics_version": "ae.predicate.v1",
  "created_at": "..."
}
```

Base envelope按event kind封闭为三支，不让`activation_ref` self-reference：

- `feature_origin_established` 是唯一genesis：它必须是每个v1 feature Ledger的`ledger_seq=1`、`prev_event_digest=null`，并要求`contract_revision|contract_generation|contract_digest|activation_ref|activation_digest` 全为null。Payload是closed `origin_kind=new|migrated_legacy` union。New branch绑定rollout context、feature ID、resolved path、`skeleton_projection_digest`、origin snapshot ref/digest与creation-routine build；skeleton projection只覆盖预定义空目录/非事件固定文件，明确排除Ledger/head、payload/event，因而没有digest自环。Rollout context是`shadow_epoch|enforce_lock` union：前者绑定P0.9 immutable shadow epoch且物理路径只能在`.ae/shadow/v1/<epoch>/`，只支撑P1 shadow/dry-run，production reader不可见、永不finalize或晋级；后者绑定P3 effective rollout lock才可在production feature root建立new origin。Migrated branch绑定effective rollout-lock/live-inventory entry/external+feature marker refs/digests、cutover historical snapshot、converter build与current enumeration snapshot，不含skeleton digest；
- candidate-stage coverage D/S/review、candidate-scoped `capability_observation`、`contract_approval`与`contract_activated`的revision/generation/Contract字段绑定selected candidate，而envelope `activation_ref/digest` 绑定该candidate的**base activation pair**；首次activation前pair同为null，amendment时必须exact current base。`contract_activated`的新authority由它自身event identity与payload表达，envelope绝不引用自身；
- 所有activation后operational/proof/lifecycle event的revision/generation/Contract字段与`activation_ref/digest`必须exact绑定latest current activation。Swapped base/current、只换G、activation self-ref或pair半null均schema/semantic invalid。

Contract再引用已存在genesis event，故不形成循环。

New origin 不通过“先 mkdir final path、再慢慢写 genesis”建立。Creation routine在repo authority lease、stable external feature lock与closed `transaction_kind=origin_publication` journal/idempotency key下，先于同文件系统的protected sibling staging path构造完整tree：skeleton、origin snapshot、genesis payload、canonical seq=1 Ledger与matching head；校验后fsync全部files/directories，再用P0-qualified directory no-replace move一次发布到仍不存在的final path，最后fsync source/target parents并seal PUBLISHED，之后才释放两把锁。因此production/shadow final path不会出现partial genesis或move后被并发append的窗口。Crash后，target absent + matching prepared staging/journal只能继续原子发布；target present只在整树、genesis/head、idempotency/payload digest全匹配时向前seal；manual/partial/mismatch path为conflict/integrity error，绝不“收养”。任何matching origin journal nonterminal或target尚未PUBLISHED时，除同operation/recover外的candidate、record、approval、status closure入口全部零写入并投影`feature_status=integrity_recovery_required` + `origin_recovery_required`。

Origin journal按authority namespace位于final path外：production用`.ae/transactions/origins/...`，shadow只用epoch内`transactions/origins/...`，lock/staging亦在epoch。Closed PREPARED绑定staging/target identities、observed `origin_complete` staging snapshot与由它派生的`expected_after_move` target snapshot、genesis payload/event/head、helper result、move-plan/nonce与parent fsync obligations。恢复：staging exists+target absent只重验observed snapshot后move；staging absent+target exists只接受expected-target snapshot后补fsync/seal；both/mismatch invalid。ABORTED只在target absent且move前；target无journal不收养。Production ID union不枚举shadow。

`origin_complete`只判定PREPARED→PUBLISHED原子发布与紧邻crash recovery，不把合法后续写入误判成origin tamper。PUBLISHED稳态按lifecycle分支验证位置：draft/live时original target仍是genesis/activation锁定的stable live path；committed时允许original target absent，但必须恰有一个valid PREPARED/COMMITTED finalizer relocation，其source identity exact接续origin target，且done target/immutable evidence snapshot持有同一genesis prefix。无journal的manual move、零或多条冲突relocation、original+done both-exist都integrity error。两支都要求genesis payload/event仍是合法Ledger seq=1 prefix ancestor、origin snapshot与skeleton immutable projection仍匹配；允许Contract/runs与seq>1 Ledger按各自authority协议新增。若journal仍PREPARED且尚无后续authority event，才要求target等于initial whole-tree snapshot。对已演进或已finalized PUBLISHED origin的同idempotency creation retry按origin identity+genesis+journal/lifecycle chain返回already-created，不比较current whole tree；不同payload/identity仍冲突。`publish→draft→activation→run→finalize`必须保持origin valid；修改/删除genesis prefix、payload、origin snapshot或initial skeleton immutable字段仍为integrity error。

`migrated_legacy`不能套用“final path不存在”的whole-tree move。Converter使用另一个closed `transaction_kind=migration_genesis`，journal固定在`.ae/transactions/migrations/<feature-id>/OP-<idempotency>.json`，并在repo authority lease+stable feature lock内预计算完整initial v1 metadata（**明确不含最后的commit marker**）：origin snapshot、genesis payload/event与seq=1 Ledger/head。先写immutable `prepared_core` sidecar，绑定locked live-manifest entry、external+feature rollout markers、legacy path identity/current enumeration、每个待发布metadata file的exact bytes/digest与operation nonce；PREPARED journal只绑定该core ref/digest、`authority/migration-genesis.commit.json` marker target与marker schema/derivation version，**不绑定未来marker digest**。两者在外部staging fsync后，再把metadata逐项no-clobber发布到既有live tree，marker始终留到最后。Production reader在commit marker absent时仍按locked legacy-live处理且nonterminal journal阻断该feature其他operation；partial exact metadata无authority。

Migration的唯一commit point是最后把已在同filesystem临时source完整写入并file+parent fsync的commit marker，以qualified `atomic_file_noreplace` move发布到final marker path并fsynctarget parent；marker bytes由`prepared_core_digest + operation_nonce + genesis event/head + derivation_version`确定性生成，只绑定immutable core，不绑定可变phase journal。PUBLISHED journal随后绑定actual marker ref/digest并seal；DAG固定为`initial metadata → prepared_core → {PREPARED journal, commit marker} → PUBLISHED seal`，无环。Genesis event只绑定stable journal ref/nonce。恢复：marker absent时matching published subset可复用并补齐，existing mismatch invalid；未发布任何live file才可ABORT，已有partial必须recover；marker present+全部metadata/genesis/head matching只向前seal，任一不匹配invalid。PUBLISHED稳态只验immutable genesis/origin/marker，不要求initial tree。P3 pilot实现producer/recovery，P5只泛化UI。

`event_digest` 覆盖除自身外的 canonical envelope（包括 `payload_digest` 与 `prev_event_digest`）。Agent 的 family 标签不是自证：非空 `family_lineage_id` 必须能由 `family_attestation_ref` 指向的 host/backend record 推导；否则只记在非权威 seat payload 中。`command_result` payload 另记 exact `runner_build` 与 effective runner-policy digest。

Event 不绑定消费它的 Gate runtime identity。`producer_build`、`runner_build`、`recorder_build` 描述事实如何产生；reducer 的 plugin/code/schema/semantics digests 只写入 status/finalize snapshot。v1 Gate 使用版本化 compatibility table 校验 `schema_version + predicate_semantics_version + runner-policy schema`：build digest 不同本身不使旧事实失效；不支持的语义版本产生 feature-level `unsupported_version` 并禁止 finalize。v1 不猜测未来格式。

每个 kind family 的 required 字段：

| Family | Event kinds | 在 base 之外必须有 |
|---|---|---|
| Contract authority | `feature_origin_established`、`coverage_review`、`contract_approval`、`contract_activated`、`amendment_opened`、`amendment_resolved` | feature genesis origin或candidate/revision/view/coverage/approval/activation chain；coverage另要求candidate-coverage dispatch/result，不要求 proof attempt |
| Attempt control | `attempt_started`、`attempt_closed` | `proof_id`、`run_id`、`attempt`；closed 还需 event-set digest 与 terminal reason |
| Proof/provenance | `command_result`、`artifact_observation`、`judge_verdict`、`human_attestation`、`backend_invocation` | `proof_id`、`run_id`、`attempt`、成对的 input-manifest ref/digest；command/artifact/judge另需source-manifest pair，human按closed subject branch使用mutable subject pair或decision-only空material |
| Capability | `capability_observation` | closed `subject_kind=proof_attempt|candidate_coverage` union；前者要求proof/run/attempt/current activation，后者要求exact candidate/coverage-subject identities、coverage-run与coverage dispatch且禁止proof/run/attempt |
| Seat transport/provenance | `dispatch`、`seat_result` | closed `purpose` union：`proof_judge` 要求 proof/run/attempt/activation；`candidate_coverage` 要求 candidate/view/base-activation/coverage-run；两者都要求 seat/definition/input/prompt/host binding 与严格关联字段 |
| Coordination | `diagnosis`、`knowledge_hit` | 与语义相关的 run/proof 字段可选，但 payload schema 必须固定 |
| Live lifecycle control | `feature_paused`、`feature_resumed` | current activation、prior logical lifecycle state、reason/actor correlation；只改Ledger projection，不移动live directory |
| Lifecycle | `finalize_prepared`、`finalized` | `transaction_id`、source/target、eligibility fingerprint；不要求 proof ID |

v1 canonical Ledger 的 `event_kind` 是 closed enum。结果唯一：可识别且受支持的 `ae.event.v1` 中出现 unknown kind/field 是 `integrity_error`；base envelope 可识别、但 schema/predicate version 不在 compatibility table 是 `unsupported_version`；截断或连 base version 都无法解析也是 `integrity_error`。任何一种都不能以“不参与 closure”静默跳过。可任意扩展的 host telemetry 写独立 `telemetry.ndjson`，不进入 hash chain；只有已知 coordination kinds 才能被 reducer安全忽略。

`ledger_seq` 由 recorder 在 feature lock 内连续分配。Ledger 只追加；seq 缺口、倒序、重复、`prev_event_digest` 断链或 head 不符均为 integrity error。重复 `idempotency_key` 必须返回同一 event 或拒绝冲突 payload，不得静默写两份不同事实。

Canonical append 协议固定为：

1. payload 写临时文件，校验 digest，file fsync，no-clobber rename，parent-directory fsync；
2. 在 feature lock 内读取并验证 `ledger/head.json` 与完整 NDJSON prefix；
3. 分配下一 seq/prev digest，生成完整单行 event，append 后 file fsync；
4. 原子写 `head.json = {seq,event_digest,byte_offset}` 并 directory fsync；
5. 返回 idempotency key 对应的已持久 event。

payload-only orphan 可安全忽略/复用；完整 event 已追加但 head 尚未推进时，正常 Gate 先报 `integrity_recovery_required`，recorder recovery 只有在 suffix 恰好连续、digest/refs/idempotency 全部合法时才推进 head。尾行截断只能在核对旧 head 的 byte offset 与 prefix digest 后隔离，不能忽略后继续 pass；head 超前、完整尾部被删、行重排或 envelope 被改均 fail closed。

### 6.2 Source manifest

Manifest 只覆盖 Contract 声明的确定性 source set，而不是整个 repo。每个 selector 必须锁定：`id`、`kind=path|glob`、pattern、`existence=must_exist|may_be_absent|must_be_absent`、enumeration universe、精确 `declared_untracked`、`gitignored_policy=exclude|include_declared` 与 `symlink_policy=reject|within_root`。v1 默认 universe 是 tracked 文件加显式列出的 untracked 文件；gitignored/untracked 文件不会因为恰好匹配 glob 就被偷偷纳入。

`ae.source-manifest.v1` 至少保存：

- repo logical root 与 real root；
- matcher name/build、glob 语义版本、case/unicode 规则；
- baseline commit（provenance）与每个 selector 的 match count；
- 排序后的 entry：selector IDs、logical path、real path、type、mode、content/link digest、Git state；
- canonical `source_fingerprint`。

Enumeration universe 保留 Git index/baseline 中已 tracked 但工作树已删除的 logical path，并为其写 tombstone tuple；因此删除项可被 proof/product-delta 覆盖。`must_exist` 要求至少一个 present entry，零 present、root/symlink escape、无法枚举的 file type 都是 manifest hard error，不能生成 vacuous attempt；`may_be_absent|must_be_absent` 对 literal path 保存 explicit absent tuple，对 glob 分别保存 present/absent match counts。Schema 要求每个 `must_be_absent` selector 有对应的 `path_state_is=absent` 或 `selector_present_count_equals=0` direct assertion，因此意外存在产生 `failed`，不是用临时 shell 绕过 snapshot。新增/删除匹配文件也改变 fingerprint。完整 manifest digest 包含 baseline commit 等 provenance；用于 stale 的 `source_fingerprint` 只覆盖 selector/matcher 语义与选中文件 tuples，因此 source-set 外的 commit/文件变化不会制造 stale，选中内容或 matcher build 改变会。

Runner、evaluator 与 human adapter 还必须有 `ae.input-manifest.v1`。它保存 manifest kind、Seat/recipe/human-proof digest、Contract/proof 或 candidate/coverage refs、按branch出现的`{source_manifest_ref,source_manifest_digest}`、允许的 artifact/event refs、host binding/tool policy，以及明确排除的 executor summary/notes/review prose。Human branch另含上文closed `human_subject_identity`；`mutable_observation`要求nonempty exact material refs并绑定current-subject resolver，`decision_only`要求全部mutable material/source refs为空。它先于 prompt/view 构造，**不包含 prompt或view digest**，避免循环；deterministic renderer 再从 Definition/Proof ref/digest + Seat Contract（如适用）+ input-manifest ref/digest 生成实际 prompt或human view。Canonical `dispatch` event同时绑定renderer build、prompt digest与Seat三组输入；canonical human adapter则绑定renderer build、view/request digest与human input manifest。Seat-derived `seat_result|judge_verdict|coverage_review` 必须记录matching input-manifest与dispatch refs/digests；`command_result`记录recipe input manifest但按schema禁止伪造dispatch，`human_attestation`记录matching human input/view且由Gate重算current subject，非Seat artifact event按封闭kind schema决定。不能用一句“所有 proof event”误加循环或虚假来源。

Input manifest/`attempt_started`还必须带host recorder生成的 `material_author_anchors[] = {material_kind,role,context_id,family_lineage_id,attestation_ref}` 与由它投影的 `independence_from[]`。Recorder按实际写入关联收集所有product-delta作者与primary artifact bytes作者；`artifact_observation`绑定artifact-author anchors，不能由artifact seat自填。Artifact judge的anchors是全部product authors ∪ 该primary artifact authors；command/judge至少锚定实现/输入material authors；coverage review锚定candidate authors。`policy_extension_release`即使product_roots为空，也必须锚定extension artifact作者，作者不能成为自身唯一fresh judge。若一次变更有多个作者则全部列出。Required fresh context要求evaluator context与所有anchors不同；`required_family=different_from_implementation`还要求attested lineage与所有implementation/material anchors不同。Anchor/attestation缺失时不能靠seat补齐：dispatch前已知无法提供则`unavailable`，声称已提供但无法关联则`invalid`。

“source-first”在 v1 是可验证的 **delivery property**：dispatcher 先构造只含 Contract/source 的受控 input manifest，排除 executor 的结论，再提供声明 artifact/event refs。若 Contract 真正要求证明工具读取顺序，则还必须有 host-correlated tool trace；不得凭 evaluator 自述“我先读了 source”判 pass。Evaluator 发现 source set 漏掉 material 来源时，输出 `fail` + typed material-source-gap finding，controller 追加 `amendment_opened`；proof 为 `failed`。只有 event/ref/schema/provenance 本身不合法时才由 Gate 判 `invalid`。Evaluator 不能现场扩大 source set。

Source manifest 不能代替 feature-wide change accounting。Contract activation还固定`change_boundary`、**project-wide product universe baseline**与上节immutable seed。Closed `repo_product_v1` universe从repo logical root遍历所有supported files，并复用单一closed `ae_control_v1` exclusion profile：固定排除`.git/**`与project-root`.ae/**`整个control namespace；profile version/digest与enumerator build进入Contract/view，caller不能追加glob。AE control write不进入product delta，但Contract/Ledger/runs/authority/transaction/rollout/policy/marker等各由其closed schema、producer ACL、tree snapshot与write guard保护；`.ae/**`中的unknown/错位authority文件不会因product exclusion被接纳。Policy-extension content仍走feature-internal artifact+publication proof专用accounting，不冒充repo product。其他path包括ignored entries都必须枚举并绑定worktree/info/global ignore config digests；只有精确命中revision锁定`generated_or_non_product`规则才可不算product。Baseline保存activation时该全universe的commit/tree/index/worktree/untracked/tombstone tuples；pre-activation seed仍只声明人确认的boundary affected set，故既有boundary外dirty bytes可作为baseline存在，但activation后任何变化都会被发现。

每个work attempt/status/finalize生成`ae.product-delta.v1 post_activation`，对同一个**全project universe**比较activation snapshot→current并列出全部add/modify/delete/type/symlink tuples。Gate先要求每个non-generated delta path唯一命中`change_boundary.product_roots`；任何boundary外delta固定`invalid + product_boundary_violation`并要求amendment，不会因proof只看src而消失。随后effective feature delta才是locked boundary seed与已验证boundary内current post-delta的deterministic union；其每个path必须实际出现在至少一个current required proof source manifest resolved tuple，不能只做glob字符串匹配。PreToolUse对可静态解析的Edit/Write path直接拒绝越界；Bash/MCP/descendant或unattributed write由operation前后及Gate的project-wide snapshot兜底，host recorder可产mutation telemetry但不取代delta truth。Project-floor applicability、coverage与proof source coverage只消费这个validated union。这样同时拦住plan前dirty laundering、worker经Edit/Bash/MCP越界与未归属process修改仍finalize。

### 6.3 Event authority

| Event kind | 用途 | 可否直接闭合 proof |
|---|---|---:|
| `command_result` | 原始进程事实 | 仅 direct closure 且 assertions 全真 |
| `artifact_observation` | artifact/source manifest | 否，通常等待 judge |
| `judge_verdict` | 语义 adjudication | 可以，但必须满足 refs/independence/family/assurance |
| `human_attestation` | human proof | 只闭合绑定的 human proof |
| `backend_invocation` | 外部 backend 调用关联 | 否，只满足 provenance/assurance |
| `capability_observation` | canonical adapter 对 sandbox/backend/human channel 等的探测 | 否；只能支撑 unavailable/invalid，永不支撑 pass |
| `coverage_review` | 候选 Contract 的 fresh coverage 结果 | 否；是 lock 前置条件 |
| `feature_origin_established` | genesis建立 new或migrated origin | 否；只作为 derived origin authority |
| `contract_approval` | 人确认精确 candidate/view/coverage summary | 否；单独不能激活 revision |
| `contract_activated` | 单调提交 current revision | 否；建立 revision authority |
| `amendment_opened` / `amendment_resolved` | material amendment 阻塞状态机 | 否；未解决时禁止 finalize |
| `feature_paused` / `feature_resumed` | 改变v1 live logical lifecycle projection | 否；物理live path永久不随pause/resume移动 |
| `attempt_started` / `attempt_closed` | 划定当前 attempt 的完整 event set | 否 |
| `dispatch` | Pattern/seat 选择可观察性 | 否 |
| `diagnosis` | 下一 attempt 的语义梯度 | 否 |
| `seat_result` | host transport 原始结果 | 否，需 canonical normalization |
| `finalize_prepared` / `finalized` | lifecycle transaction/recovery | 否 |
| Hook/Task/Team/mailbox/`/goal` | telemetry/coordination | 否 |

Reducer 使用 allowlist，不使用“除黑名单外都可信”的规则。

`capability_observation` 只能由 canonical runner、dispatcher、human-channel adapter 或 host recorder 产生，并绑定 probe method/build、operation/input digest、observed state 与 reason。它是closed subject union：`proof_attempt`支遵守attempt envelope与下述terminal规则；`candidate_coverage`支遵守candidate-stage envelope，exact绑定candidate/coverage-subject identities、coverage-run、失败的D ref/digest、required capability/input/host operation，且禁止proof/run/attempt字段。Matching candidate observation只把该D标为transport/capability terminal，使同semantic key可重dispatch；它永不产生review、zero-gap或lock资格。错candidate/dispatch/host binding的observation invalid，D既不会被释放也不能被悄悄忽略。Agent/judge 的“我无法访问”只进 `seat_result`。`attempt_closed(terminal=capability_unavailable)` 必须引用至少一个与**具体stage** required capability/input/dispatch精确匹配的admissible proof-attempt observation。Runner/direct/human preflight stage要求零primary；judge stage允许恰好一个已有sole precursor `command_result|artifact_observation`、零`judge_verdict`，并必须绑定matching judge dispatch。超出这两个closed cardinality的组合才是`invalid`。

Recorder 还强制 producer ACL；caller 不能通过提交一个 shape-valid envelope 自选 authority：

| Internal producer endpoint | 唯一可写的 authoritative kinds |
|---|---|
| Feature creation/migration routine | `feature_origin_established`；new只在ID/path未占用且path尚不存在时以origin-publication journal + sibling complete tree + qualified no-replace move创建，migrated只接受locked live inventory+双marker；两支均须repo authority lease |
| Coverage/Seat dispatcher | `dispatch`，按 purpose 绑定 candidate coverage 或 proof judge subject，并签发绑定当时已知 subject/input/prompt/host-operation 的 normalization authorization token；Ledger 只保存 token digest |
| Host result collector | `seat_result`，必须引用对应 dispatch 与 host result channel，不能接受 TL 重写后的内容 |
| Foreground human adapter | `contract_approval`、`human_attestation`、human `amendment_resolved` |
| Approve/amend commit routine | `contract_activated`；不能由 generic record 调用 |
| Amendment controller | `amendment_opened`，绑定 base activation 与 material diff；不能自行 resolve |
| Canonical runner/adapter | `command_result`、runner `capability_observation` |
| Artifact dispatcher/normalizer | `artifact_observation` |
| Verbatim coverage normalizer | `coverage_review`，校验 matching candidate dispatch/raw `seat_result` 与 authorization；禁止 dispatcher/TL 代写语义结果 |
| Verbatim judge normalizer | `judge_verdict`，校验 matching proof dispatch/raw `seat_result` 与 authorization；禁止 TL 补字段 |
| Backend/host correlator | `backend_invocation`、host `capability_observation` |
| Attempt controller | `attempt_started`、`attempt_closed` |
| Lifecycle controller | `feature_paused`、`feature_resumed`；必须绑定current activation与expected prior state，不开放path move |
| Finalizer/recovery routine | `finalize_prepared`、`finalized` |

Envelope 的 producer、seq、prev/event digest、created_at 与 payload digest 全由 recorder 填充，caller 不得覆盖。公开 `ae-gate record-control` 只接受 schema 列出的非权威 coordination kinds，明确拒绝 `feature_origin_established|dispatch|seat_result|coverage_review|judge_verdict`；authority/provenance producer 必须走专用 internal endpoint并满足对应 authorization/input binding。这是 supported workflow 的权限边界，不声称抵御同 OS 用户直接改 Gate 程序。

### 6.4 Seat Delivery、Judge 与 Backend 分离

三者不能共用一个“review result”对象：

```text
Seat result           = transport 返回了什么
Backend invocation    = 哪个 backend 对哪个 input 确实被调用
Judge verdict         = 哪些 event/source 支持或不支持 proof criterion
```

`BACKEND: reached`、model 名或 response ID 的自述只作可见性信号。`backend_correlated` 必须来自 host/MCP 可关联记录，绑定 invocation ID、input digest 与 output digest。Family lineage 另由 revision 锁定的 lineage registry + adapter attestation 根据不可由 caller 任意填写的 backend/model identity 推导；OpenAI-compatible bridge 的 `family` 请求字段永不成为权威。无法证明 weight lineage 时记 `unknown`，不能满足 different-family requirement。

三个 payload schema 都是 closed，并与 base envelope 交叉校验：

| Payload | 必填绑定 |
|---|---|
| `ae.dispatch.v1` common | `purpose`、seat、feature-local Definition raw snapshot/input-manifest/renderer compatibility bundle/prompt refs+digests（另带plugin provenance）、effective tool policy、dispatch 时已知的 `host_operation_binding`（session/invocation/channel ID）、`normalization_authorization_digest` |
| `purpose=proof_judge` | current activation ref/digest、proof/run/attempt、criterion/rubric digest、closed `judge_subject_identity={judge_subject_semantic_digest,primary_observation_ref,primary_observation_digest,observation_projection_digest,source_fingerprint,material_input_digest,required_seat_class}`；base envelope subject 必须一致，Gate重算identity |
| `purpose=candidate_coverage` | exact candidate + coverage-subject identities、coverage-run ID、candidate-author anchors；base activation 只在尚无任何activation时为null；禁止 proof/run/attempt 字段 |
| `ae.seat-result.v1` | dispatch event ref/**event digest**、purpose/seat、从 D 复制的 `normalization_authorization_digest` 与 `host_operation_binding`、实际 `host_result_ref` + raw-byte digest、raw result artifact ref/**raw-byte digest**、transport terminal；不含明文 token/semantic verdict |
| normalized `judge_verdict|coverage_review` | dispatch event ref/digest、seat-result event ref/digest、input/prompt/authorization digests、与 D/S 相同的 `host_operation_binding`、与 S 相同的 `host_result_ref/digest`；judge还必须exact复写可重算`judge_subject_identity`，coverage复写两种candidate/subject identity；再加各自 rubric/findings/source/backend refs |

这里 `seat_result_event_digest` 永远指 canonical event envelope digest，`raw_result_artifact_digest` 永远指 host 返回 raw bytes；不得复用一个模糊的 `result_digest`。每个 dispatch D 有 first-result latch：host collector 在 stable feature lock 内最多追加一条 authoritative S；相同 idempotency + byte-identical host result返回原 S，不同 result或第二 event固定 `seat_result_conflict`。测试中若直接构造一条 D 对两条 schema/hash-valid S，Gate把对应 proof/candidate判 invalid，normalizer不能挑有利的一条。一个 normalized event必须由 refs **恰好匹配一条** D→S链；Ledger可以同时保留其他 aborted/unrelated dispatch，它们不制造基数冲突。

Raw→normalized语义也必须封闭。Seat Contract要求host result channel产出exact一个closed `ae.judge-output.v1`或`ae.coverage-output.v1` canonical JSON object + LF；qualified host adapter可从版本化transport envelope取得一个**指定content field的raw bytes**，但不得在prose中找JSON、挑多个block或修格式。Leading/trailing prose、第二个JSON值、unknown/duplicate field、wrong schema、invalid UTF-8或`pass + unresolved`都使S transport artifact inadmissible/normalization invalid，不能挑其中有利部分。

Normalizer不作语义编辑：它只解析该单对象，复写semantic fields并添加D/S/provenance refs，记录`normalizer_build`与raw-output schema/semantic-projection digests。`coverage_review`的findings/unresolved summary、`judge_verdict`的verdict/rationale/source refs/unresolved/advisories必须与raw object的JCS semantic projection byte-equivalent；不得删finding、改fail为pass或补citation。Gate从S绑定的raw bytes按event所锁定且compatibility-supported schema重新parse，重算projection并与normalized event exact比较；build已知但unsupported产生`unsupported_version`，build/schema claim与bytes不符为`invalid`。Multi-block、trailing prose、drop-finding、pass+unresolved与normalizer-build-drift各有fixture；single canonical object是positive control。

`ae.judge.v1` 的最小 payload：

```json
{
  "schema_version": "ae.judge.v1",
  "seat_id": "review-P-02-a1",
  "activation_event_ref": "EV-contract-activated",
  "activation_digest": "sha256:...",
  "proof_id": "P-02",
  "run_id": "RUN-7",
  "attempt": 1,
  "judge_subject_identity": {
    "judge_subject_semantic_digest": "sha256:...",
    "primary_observation_ref": "EV-observation",
    "primary_observation_digest": "sha256:...",
    "observation_projection_digest": "sha256:...",
    "source_fingerprint": "sha256:...",
    "material_input_digest": "sha256:...",
    "required_seat_class": "fresh_context"
  },
  "seat_contract_digest": "sha256:...",
  "input_manifest_ref": "runs/RUN-7/input-review-P-02-a1.json",
  "input_manifest_digest": "sha256:...",
  "prompt_digest": "sha256:...",
  "dispatch_event_ref": "EV-dispatch",
  "dispatch_event_digest": "sha256:...",
  "seat_result_event_ref": "EV-seat-result",
  "seat_result_event_digest": "sha256:...",
  "normalization_authorization_digest": "sha256:...",
  "host_operation_binding": {"session": "cc-session", "invocation_id": "tool-use-17", "channel": "subagent_return"},
  "host_result_ref": "host-result-17",
  "host_result_digest": "sha256:...",
  "criterion_ref": "R0001/P-02",
  "verdict": "pass",
  "observation_event_refs": ["EV-observation"],
  "source_refs": [{"path": "src/auth.ts", "line": 42, "digest": "sha256:..."}],
  "backend_invocation_refs": [],
  "rationale": "逐项对应 rubric，不引入新事实",
  "unresolved": []
}
```

每个 `judge_verdict` 只有在 refs 恰好匹配一个更早的 canonical dispatch D 与其后、verdict 之前的 raw seat result S 时才 admissible：feature、activation/contract digest、proof、run、attempt、seat ID、Seat Contract digest、input-manifest digest、prompt digest、normalization-authorization digest、`judge_subject_identity` 与 `host_operation_binding` 必须跨 D/S/verdict 全部一致，Gate必须由exact sole-primary observation/rubric/source/input bytes重算subject；实际 `host_result_ref/digest` 只要求 S/verdict 一致，因为 D 不可能预知未来结果内容。还必须有 `D.ledger_seq < S.ledger_seq < verdict.ledger_seq`；排序只信 Ledger seq，不信 caller timestamp。Generic control dispatch、别的 seat 的真实 result、旧 result replay或错 prompt/input/subject digest 都 fail closed。

Verdict 的 `observation_event_refs` 必须 exact包含同一 proof/run/attempt closed event set中的 sole primary：`command/judge` 对应唯一 `command_result`，`artifact/judge` 对应唯一 `artifact_observation`，并同时绑定 event digest。它不能引用另一 proof、旧 attempt或仅仅“真实存在”的有利 observation。额外 supporting event/artifact/source refs必须全部出现在该 judge input manifest的 allowlist；existent-but-undelivered ref同样 invalid。Coverage finding/resolution refs使用相同 allowlist规则，被input manifest明确排除的 executor summary、notes或review prose不能支撑 zero-gap review。Judge schema还封闭 `verdict=pass ⇒ unresolved=[]`；material unresolved非空时只能 verdict=`fail`，非阻塞建议另写不参与closure的 `advisories`。

Authorization token 绑定 dispatch 时已知的 subject/input/prompt/`host_operation_binding`，不绑定未来 result content。“single-use” 完全由 Ledger 重放定义，不存在可丢失的外部 consumed bit。Dispatcher 在 append D 前把明文 token与scope以 file+parent fsync写入 model/seat/input不可读、tool guard保护的 durable internal capability record；D只保存 token digest。该 record不含 consumed状态，不进入 closure，保留到 candidate/attempt terminal之后才可清理，因此进程崩溃后 controller仍能恢复同一 capability。Normalizer在 stable feature lock内校验 record/token hash等于 D digest，然后 append normalized event；Ledger中第一条引用该 D/token digest的合法 normalized event就是消费事实。同一 idempotency key + byte-identical payload重试返回原 event；同一 D/token的第二个不同 payload deterministic conflict。若 host collector也需要 bearer capability，必须使用独立 phase token与独立 durable record，不能复用 normalization token。Gate事后只校验 D/S/V或D/S/coverage的 digest唯一性，不读取 mutable token registry。

崩溃语义因此唯一：D 后或 S 后、normalized event append 前崩溃都没有消费事实，可用原 token 继续；event 已 append 但 response 前崩溃时，retry 只能以同 idempotency/payload 取得原 event；相同 token 的不同 payload 冲突。任何实现不得在 append 前写独立 consumed marker。

Coverage review 使用相同交付代数，只把 subject 换成 exact candidate/coverage-subject identities 与 coverage-run：raw result 中的 typed findings 经 verbatim normalizer 写 `coverage_review`，dispatcher本身没有语义 verdict 权限。尚无任何current activation时，D 的 `base_activation_ref/digest=null`；amendment coverage 必须精确绑定当前 base activation。

`verdict` 只能是 `pass|fail`。`invalid` 是 Gate 对 schema/ref/provenance/cardinality 的判断；`unavailable` 只能来自 canonical capability observation + attempt closure，二者都不能由 judge 自报。Evaluator 无法完成时只留下 `seat_result`/诊断并让 attempt 保持 open/aborted，或由 host adapter 记录可验证的 capability failure；TL 不得把它补成 judge verdict。

## 7. Gate 与状态代数

### 7.1 Gate 性质

对`active|paused` feature，以及尚未跨过durable move point的finalize transaction，Gate是读取live workspace的本地确定性程序：

```text
evaluate(latest activation, contract revision, lock, ledger/head, artifacts,
         current source/product-delta manifests, effective policy set/floor facts,
         amendment state)
  → proof_status[]
  → obligation_status[]
  → finalize_eligible + reasons
```

另有一个closed、不运行closure的pre-activation分支：只要genesis合法但还没有`contract_activated`，Gate输出`lifecycle_status=draft_unactivated`、current activation pair=null、`finalize_eligible=false`，并禁止proof/floor/finalize fingerprint字段；只可投影inert candidate/rejection诊断。R0001被拒绝后起草R0002仍在此分支，不被误当integrity error。

Gate 不做：

- 调模型或选择 reviewer；
- 创建 Task、Team 或 workflow；
- 决定 retry、re-plan、ask-human 或 amendment；
- 读取 review prose 猜 verdict；
- 把“没有数据”解释成 pass。

`committed` 不是把上述函数永远重跑一遍。不可逆 lifecycle commit point 是 matching valid `PREPARED` 下的 no-clobber move：恢复时一旦观察到 `source absent + target exists + prepared snapshot matches`，状态固定为 `lifecycle_status=committed`、`feature_status=integrity_recovery_required`，只能向前补 durability/finalized seal，不能移回 source。`finalized` event + `COMMITTED` journal 只是把这笔已提交事务 seal 成 `feature_status=ok`，不是第二个 commit point。

Commit-time Contract、`proofs_at_commit`、source/product manifests、Gate runtime、Ledger head 与 prepared evidence snapshot 先由 `PREPARED` journal 冻结，settled reader 再以 `finalized` event、`COMMITTED` journal 和 final immutable evidence snapshot 交叉封印同一组事实。Done reader 只验证这些历史对象彼此的 digest/identity/head 一致性，不再把 manifest 与未来 live workspace 比较。后续 feature 合法修改同一路径不会 reopen、revoke 或 stale 已提交 feature；只有 committed target 的权威快照、Ledger 或 external journal 被篡改/损坏才进入 `integrity_error`。

### 7.2 Proof status

| 状态 | 含义 |
|---|---|
| `pending` | 当前 revision 尚无足够 admissible evidence |
| `passed` | closure 所需的全部 facts/adjudication 成立 |
| `failed` | 有有效 observation/verdict 明确不满足 criterion |
| `invalid` | schema、引用、independence、digest、non-vacuity 或 provenance 不成立 |
| `unavailable` | required capability/backend/human channel 无法提供 |
| `stale` | Contract 或 source snapshot 已变化 |

`human_required`、`retry`、`replan` 是 Strategy action，不是 Gate 状态。Retry cap 由 workflow policy 读取 attempts 后决定，Gate 不计算 cap。

`superseded` 是旧 revision event 的 admissibility reason/历史标签，不是 current proof status。Current proof 如果只有旧 revision pass 而没有 current attempt，状态固定为 `pending`。

`ae.status.v1` 分层保存：

```json
{
  "lifecycle_status": "active",
  "feature_status": "ok",
  "feature_reasons": [],
  "current_activation_ref": "event:EV-contract-activated",
  "current_activation_digest": "sha256:...",
  "current_candidate_identity_digest": "sha256:...",
  "evaluated_ledger_head": {"seq": 42, "event_digest": "sha256:..."},
  "proofs": {"P-01": {"status": "passed", "attempt": 2, "reason_codes": []}},
  "floors": {"PF-code-regression": {"status": "passed", "disposition": "bound", "applicable": true}},
  "evidence_eligible": true,
  "finalize_eligible": true,
  "eligibility_core_fingerprint": "sha256:...",
  "reducer": {
    "plugin_version": "1.0.0",
    "gate_code_digest": "sha256:...",
    "schema_bundle_digest": "sha256:...",
    "reducer_semantics_digest": "sha256:..."
  }
}
```

`lifecycle_status` 是 `unresolved|draft_unactivated|active|paused|committed|legacy_readonly`，与 `feature_status`、proof status 正交。首次activation后，new origin的logical基态是`active`，migrated origin的基态来自locked live-manifest的`active|paused` classification；之后`feature_paused|feature_resumed`必须按expected prior state交替归约，duplicate pause/resume invalid。物理source path固定为genesis/activation所绑live path，不靠`active/paused`目录名或可删status cache。

`active|paused`都可重放live proofs/floors并显示`evidence_eligible`，但操作型`finalize_eligible = (feature_status=ok ∧ lifecycle_status=active ∧ evidence_eligible)`。Paused固定`finalize_eligible=false`，且除read-only status/diagnostic inspection、`ae-gate resume`与matching transaction/origin recovery外，work、runner、attempt/dispatch/result、record、approve/amend、pause与finalize入口全部零写入并返回`feature_paused`。Pause只可从active、resume只可从paused，在repo无active product/authority/finalizer operation且无nonterminal transaction时由专用controller append；resume后Gate从current bytes/head完整重验，不沿用pause前session cache。Migrated基态paused也遵守同一allowlist。

`committed` projection必须保存`committed_transaction_id`、`committed_eligibility_fingerprint`、`eligible_at_commit=true`、`proofs_at_commit`及当前transaction head，并把操作型`finalize_eligible=false`。Move后seal前引用PREPARED matching H+1或exact H+2且`feature_status=integrity_recovery_required`；seal后COMMITTED/`feature_status=ok`。两者都不把current live Gate结果当完成真值。

`legacy_readonly` 是独立closed healthy branch，只来自matching lock +唯一PUBLISHED journal/core构成的healthy rollout authority精确列举、且current tree snapshot matching的legacy-done对象。它要求`feature_status=ok`、rollout-lock/journal/core/done-entry/tree-snapshot refs+digests与permanent adapter build/semantics digest；activation pair=null、`finalize_eligible=false`，并禁止v1 proofs/floors/fingerprint/commit字段。Healthy `draft_unactivated`也要求`feature_status=ok`、activation pair=null、`finalize_eligible=false`，禁止proof/floor/fingerprint/commit字段。

每条 `proofs_at_commit` 不是只有字符串 status；它冻结 proof ID/status、selected attempt number、attempt event-set digest，以及全部 primary/supporting event IDs/digests。这样 extension resolver 与 done reader可以证明某个 artifact observation/human attestation 当时确实是 selected passed evidence，而不是从永久 Ledger 中挑一个旧事件。

`feature_status` 是 `ok|integrity_error|unsupported_version|integrity_recovery_required`。Status schema按`{lifecycle_status,feature_status}`做closed matrix，而不是假设non-ok无法序列化：

- 若仍有可靠discriminator，draft/live/committed/legacy可各自带non-ok；必须`finalize_eligible=false`、nonempty closed `feature_reasons[]`与`diagnostic_basis={classification_refs[],expected[],observed[]}`。除下述committed recovery外，正常`proofs|floors|evidence_eligible|eligibility_core_fingerprint|eligible_at_commit|proofs_at_commit`均禁止；可选`diagnostic_projection`有独立schema并显著标non-authoritative；
- matching PREPARED move后的committed recovery是唯一non-ok仍要求`eligible_at_commit=true`、`proofs_at_commit`、transaction/head/snapshot refs的分支，因为这些是commit-time冻结事实；它仍`finalize_eligible=false`；
- origin/migration nonterminal可投影`draft_unactivated + integrity_recovery_required`；pointer/transaction recovery可投影reliably classified live state；legacy tree mismatch可投影`legacy_readonly + integrity_error`并带expected/observed snapshot；valid commit discriminator后的target evidence tamper可投影`committed + integrity_error`。任何分支都不补造proof authority或回退prose reader；
- 若缺失/冲突严重到无法可靠选择lifecycle（例如ambiguous path、无法验证任何origin/finalize discriminator），使用closed `lifecycle_status=unresolved`，只允许`feature_status=integrity_error`、identity hints、nonempty reasons/diagnostic basis与`finalize_eligible=false`，禁止全部proof/commit truth字段。

这与proof status是不同enum，不能把Ledger/identity损坏伪装成某一proof failed。每个healthy、recoverable、tampered与unresolved组合均有schema fixture；未列组合invalid。

Floor projection 使用 closed status `not_applicable|not_triggered|pending|passed|failed|invalid|unavailable|stale`。N/A/false 与 bound/false 先分别得到前两态；N/A/true 固定 invalid；bound/true 再按 obligations 的固定优先级 `invalid > stale > unavailable > failed > pending > passed` 聚合。该优先级只决定显示一个 floor summary，不改写任何 obligation 的原状态。

### 7.3 Attempt 选择与互斥代数

每个 proof 的 attempt number 单调递增。`attempt_started` 打开一次取证，`attempt_closed` 必须列出本 attempt 的完整 authority event IDs、event-set digest 与 terminal reason：`completed|precursor_terminal|capability_unavailable|aborted`。该集合不由caller挑选：recorder扫描Ledger中matching `activation_ref/digest + proof_id + run_id + attempt`、从matching `attempt_started`起到close append前的全部recognized attempt/dispatch/result/provenance/coordination events，包含start，按`ledger_seq`排序，明确排除即将写入的`attempt_closed`本身以避免digest循环；foreign/unrelated event不进集合。Close endpoint重算并要求caller所绑IDs/digest byte-equal，不能省掉不利event。

v1 每个 closed proof-attempt 的 authoritative primary slots 有精确基数：

| Proof closure | `terminal=completed` 必须恰好包含 |
|---|---|
| `command/direct` | 1 `command_result` |
| `command/judge` | 1 `command_result` + 1 `judge_verdict` |
| `artifact/judge` | 1 `artifact_observation` + 1 `judge_verdict` |
| `human/human` | 1 `human_attestation` |

`backend_invocation` 可有多条，但只有被 primary event 明确引用且满足 lineage/assurance 的记录参与 closure。对 judge attempt，`attempt_closed.event_ids/event_set_digest` 必须覆盖 matching dispatch、raw seat result、judge verdict、被 verdict 引用的 observation/backend invocation 与 capability/support records；primary-slot 表只定义闭合结果基数，不表示 D/S/provenance 可从 event set 省略。Primary result 缺失、重复、一绿一红或跨 attempt 混用一律 `invalid`，不存在“最后一条赢”或 TL 选择。Production attempt controller 在 close 前验证可见 primary slot；缺 slot 的 `terminal=completed` 请求被拒并保持 open，不能让 caller制造非法 completed attempt。Reducer 仍必须能对 test-only/损坏 Ledger 中已经存在的缺-slot completed fixture归约为 `invalid`。

`terminal=precursor_terminal`只允许`command/judge|artifact/judge`在judge dispatch前结束：event set必须恰有sole precursor `command_result|artifact_observation`、零dispatch/S/verdict，且Gate独立重算该precursor为`invalid|stale|failed`。先验证schema/ref/cardinality、artifact contract completeness/type/delivery与run内source binding；任一结构或语义错误始终是`invalid`，即使随后current source又漂移也不能降格为`stale`。只有上述检查全合法、但command outcome为timeout/signal等真实失败时，current source与attempt snapshot不同才优先显示`stale`，否则为`failed`。若precursor其实valid且可judge、存在任何D/S/verdict或caller只自报reason，该attempt invalid。这样无须为了得到红色状态而浪费judge，也不会因completed-slot缺verdict把事实洗成pending。

Gate 对 current activation 的每个 proof 按以下固定顺序归约：

1. 先验证 latest activation→pointer→lock→revision→coverage→approval authority chain、Ledger head/seq/hash chain 与版本 compatibility。Pointer 缺失或只落后且指向某个合法旧 activation 时为 `integrity_recovery_required`；pointer ahead/非 activation target 或其他 chain 损坏为 `integrity_error`；不支持的已知语义为 `unsupported_version`。三者都禁止 closure/finalize。
2. 只保留exact绑定current activation ref/digest与其generation-qualified Contract的events；旧 activation/revision event 在历史查询中显示 `superseded`，永不成为当前候选。
3. 选择编号最大的合法 `attempt_started`。编号复用、倒退、重复 start/close 或 event 跨 attempt 引用均为 `invalid`。
4. 没有 attempt 为 `pending`；最新 attempt 未 closed 或 terminal=`aborted` 为 `pending`。打开新 attempt 会让旧 pass 暂时退出 current selection，但不删除历史。
5. 验证closed attempt的完整event set、按terminal分支的primary cardinality、schema/refs/idempotency/conflict。任一失败为`invalid`。`precursor_terminal`按上文以`invalid > stale > failed`的封闭顺序重算并直接结束，不进入judge closure；其中`stale`只对结构合法但outcome failed的precursor可达。
   对 command 还先应用 outcome matrix：policy violation、run 内 source drift、adapter error、required truncation 为 `invalid`；timeout/signal 为 `failed`；preflight capability failure 只能走第 7 步。
6. 重新计算当前 source manifest；与 selected attempt 不同为 `stale`。这是运行完成后的漂移；run 内 pre/post 不同已经在第 5 步为 `invalid`。
7. terminal=`capability_unavailable` 按stage封闭归约：runner/direct/human preflight必须零primary；judge-stage必须有恰好一个valid、fresh sole precursor observation、零verdict，且capability observation exact匹配judge requirement/dispatch。Gate先归约precursor；policy violation、source drift、invalid artifact、timeout/signal等`invalid|stale|failed`不能被后来backend unavailable洗掉，只有合法precursor + judge capability缺失才为`unavailable`；其他组合`invalid`。
8. terminal=`completed` 时执行 closure：direct assertion、human acceptance rule 或 judge verdict 为 false 时 `failed`，全部成立才 `passed`。Judge 的自报 unavailable/invalid 没有该语义。

同一 attempt 的 v1 judge closure 只允许一个 authoritative `judge_verdict`；pairwise/calibration 结果必须是 control/seat artifact。为防止对同一件artifact/命令输出无限换reviewer，`command/judge|artifact/judge` 定义 `judge_subject_semantic_digest = hash(activation + proof-definition/rubric + normalized sole-primary observation bytes/facts + source fingerprint + material input content digests + required seat class)`，排除attempt/seat/dispatch/run/created_at/storage-ref等transport metadata。同一 `{activation,proof_id,judge_subject_semantic_digest}` 使用与coverage相同的single-flight/first-normalized latch：第一个legal verdict永久authoritative，同subject后来green是`judge_already_completed`冲突，fail不能靠换seat变pass。只有verdict前transport/capability terminal可同subject重dispatch；primary observation/source的normalized semantics确实变化才能新建attempt，并绑定prior verdict与typed changed-field old/new digests。因此“old fail + new pass”只在new semantic subject时passed，旧fail仍留历史；同subject则仍failed/conflict。Direct command的新process observation与human reconsideration保持各自的typed attempt规则，不伪装成semantic judge。

Feature-level `integrity_error|unsupported_version|integrity_recovery_required` 高于所有 proof status。Selected attempt 内的检查顺序即互斥优先级：`invalid → stale → unavailable → failed|passed`；`pending` 由缺 attempt/未完成或 aborted attempt 产生。

Material amendment 也由 Ledger 归约，而不是扫描 draft 目录猜测。`amendment_opened` 绑定 amendment ID、base activation digest、material diff/原因；只有带 human correlation/assurance 的 `amendment_resolved(outcome=rejected)`，或明确引用该 amendment 的新 `contract_activated`，才能关闭它。当前 activation 上仍有未解决 amendment 时，所有 proof 状态照常展示，但 `finalize_eligible=false`。孤立 draft 不阻塞，也没有 authority。

### 7.4 Closure

```text
proof passed
  = current contract digest matches
  ∧ current source manifest matches required snapshot rules
  ∧ required event kinds exist and are schema-valid
  ∧ all referenced event/artifact IDs exist and digests match
  ∧ closure rule evaluates true
  ∧ independence/family/assurance floors are met

finalize_eligible
  = lifecycle_status = active
  ∧ every required AC proof passed
  ∧ every catalog floor has one activated, coverage-adjudicated disposition
  ∧ every bound/applicable floor obligation passed
  ∧ no unresolved material amendment or human proof
```

## 8. Instruction Delivery Contract

当前实测首先证明的是 **declared instruction/configuration 可能没有 effective delivery**：frontmatter 解析失败会让 model/tools/effort 静默失效，而输出仍可能形似正常。此前把某次 backend 未达归因于“模型档位/任务密度”的结论受这个混淆变量污染，必须在修复后重测；v1 不依赖该因果归因，而是让任何未履行义务或未关联 backend 的结果都无法产生 authoritative evidence。

### 8.1 三层输入

| 层 | 内容 | 权威 |
|---|---|---|
| Agent Definition | 稳定职责、通用工程知识、工具边界、输出协议 | 版本化 policy |
| Seat Contract | 本次 objective、proof、source、tools、write rights、assurance、stop 条件 | canonical dispatch input |
| Cast view | Role / Angle / Why 的人类可读投影 | UX，不是机器真值 |

项目事实与路径进入 Seat Contract，不写进通用 Agent Definition。Seat Contract 可声明比 Definition 更窄的权限，但声明本身不改变 CC 已授予的工具。`allowed_capabilities`/`mutation_rights` 只有在 Agent Definition 本身已足够窄，或 plugin-level `PreToolUse` policy 与 host recorder 对该 invocation 强制并关联成功时，才是可验证边界；否则 rights-sensitive seat 为 `unavailable`，不能靠 prompt 自律获得 authority。

“版本化”不能只指向可被插件升级覆盖的安装路径。每次authority coverage/judge dispatch前，dispatcher必须把exact Agent Definition raw bytes以content-addressed、no-clobber、file+parent-fsync方式快照到feature-local `authority/definitions/<digest>`；Input/D同时绑定local ref/raw digest与原plugin provenance ref/digest。

同一规则泛化到**所有authoritative view producer**：Contract approval、human mutable/decision proof、publication view、Seat prompt都把命中locked renderer registry的exact compatibility bundle快照到feature-local`authority/renderers/<digest>/`；rollout approval则快照到inert`rollout/candidates/CUT-*/authority/renderers/<digest>/`并由approval/lock绑定。每个candidate/input/event/approval/lock exact绑定local bundle manifest/ref/digest、registry entry/ref/digest、原plugin provenance、runtime selector与renderer input/output digests。Local bundle只是被验证的历史副本，Gate只允许执行bytes+manifest完全命中已锁trusted registry entry的deterministic renderer，绝不执行任意feature-local code。

Active replay与done `feature_evidence` snapshot只读local bytes；rollout replay只读lock-bound candidate bytes。插件升级、删除旧Definition或current renderer改变都不改历史prompt/view。Gate用受支持的historical compatibility semantics逐byte复算；known bundle/schema semantics但当前runtime不支持固定`unsupported_version`，local snapshot missing/tamper或与registry不符为`integrity_error`，绝不静默改用current plugin文件。Contract/human/publication/rollout四类view各有upgrade/remove、tamper与unsupported fixture。

### 8.2 最小 Seat Contract

```yaml
schema_version: ae.seat.v1
seat_id: review-P-02-a1
seat_kind: judge
objective: adjudicate P-02 only
contract_revision: R0001
contract_generation: G0001
contract_digest: sha256:...
activation_ref: event:EV-contract-activated
activation_digest: sha256:...
proof_ids: [P-02]
run_id: RUN-7
attempt: 1
source_set_ref: R0001/P-02
definition_ref: agents/review/judge.md
definition_digest: sha256:...
allowed_capabilities: [fs.read, fs.search]
capability_mapping_ref: ae.cc-tools.2.1
capability_mapping_digest: sha256:...
mutation_rights: none
required_independence: fresh_context
required_family: different_from_implementation
required_assurance: backend_correlated
result_schema: ae.judge.v1
authority: result_is_input_not_gate
stop:
  - source_unavailable
  - backend_not_correlated
  - contract_digest_mismatch
```

Seat schema 是按 `seat_kind=coverage|judge|worker|researcher` 封闭的 tagged union：coverage 绑定 candidate/view digest 而非 proof；judge 恰好绑定一个 proof/run/attempt；二者都要求 `mutation_rights=none`。Worker 要求 product mutation right 时必须绑定当前 repo lease；researcher 只能 `none|own_artifacts`。互斥字段、缺所需contract/candidate/current-activation digest 或 rights 与 kind 不匹配都是 schema error。Canonical hash-chain `dispatch/seat_result` 的closed purpose只有`candidate_coverage|proof_judge`，并携带normalization authority；worker/researcher selector与invocation只写non-authoritative host telemetry及guard input，不得伪造normalization token或closure event。Pre-Contract `/ae:analyze|discuss` 不使用canonical `ae.seat.v1`/dispatch，只用CC编排与telemetry，其输出只能成为draft source。

Seat schema 使用 AE abstract capabilities，不把某一 CC 版本的工具拼写当永久语义；dispatcher 通过 live-tested、digest-bound mapping 映射到 `Read/Grep/Glob/WebSearch` 等 actual tools。实际 prompt 只能由 versioned deterministic renderer 从 Agent Definition ref/digest、Seat Contract 与 input-manifest ref/digest 生成；caller 不能在 canonical `objective`/约束字段之外追加自由 instruction，材料通过受控 refs 交付而不把长正文塞回 prompt。Canonical dispatch 记录 renderer build、Seat Contract/input manifest/definition/prompt digests、实际 host binding 与 effective tool policy/mapping。实际 provider/model/profile 只作 host-attested telemetry 和 selector 评估，不形成硬编码的跨 provider “模型档位” Gate。Agent 自报冲突或 `BACKEND: not-reached` 是有用的 fail-fast UX，但 Gate 只相信 canonical event 与外部 attestation。

## 9. Pattern Policy

### 9.1 Selector 输入

Selector 是小型 decision table，不是新 DSL：

1. **Locked proof constraints**：independence、family、assurance、source set；
2. **Task geometry**：广度、依赖、隐含决策冲突、是否需要 peer exchange、风险与不确定性；
3. **Live host state**：Teams、Agent result channel、sandbox、backend 与 invocation mode。

Plan-time 选择只是 provisional；work/review dispatch 前必须重探测可能变化的 capability。

### 9.2 最小拓扑阶梯

| 条件 | 默认选择 |
|---|---|
| 一个上下文可完成且无独立 proof | solo |
| 一个独立、return-only 问题 | anonymous subagent |
| 多个互不依赖的读取/验证问题 | independent subagent fan-out |
| 参与者必须相互交换证据或测试竞争假设 | Agent Team |
| capability 不足或需要 authority | human |

Cross-family 是 seat 的 family/assurance 属性，不是一条平行工作流。

### 9.3 并发规则

冲突单位是“必须让别人保持一致的隐含决策”，不只是文件句柄。v1 用一个更强的安全界线：

- 一个 feature 同时只有一个 active product mutation owner；
- 其他 seats 只读产品 source，写自己的隔离 finding/artifact；
- 同一文件、共享 fixture/端口/DB、重叠 source decision 全部串行；
- 未来 worktree 多 writer 需要独立设计、integration owner 与合并后重新取证，不属于 v1。

PreToolUse 进程无法把自己的 OS lock 传给随后执行的 CC tool，所以 repo barrier 是 **durable logical lease**，不是一句 `flock`。`.ae/transactions/repo-mutation.json` 原子保存 closed `state=idle|writer|authority_commit|finalizer|rollout_cutover`、owner feature/session/context、随机 lease token/operation nonce、issued/heartbeat/expiry、active host operation IDs，以及本次`active_release_operation` provider/result/capability ref+digest与active manifest digest；短时 `.lock` 只串行 lease-state 更新。Acquire/heartbeat/每个write endpoint都重验release capability，不能只在launcher启动时验一次。v1 全 repo 同时只允许一个 AE product writer，宁可先保守串行。

`/ae:work` 在 mutation session 前取得 writer lease；`PreToolUse` 对 Edit/Write/NotebookEdit、Bash 及所有声明或可能写 product 的 MCP tool 逐次核对 context/token/state，`PostToolUse`/host recorder 关闭 operation 并 heartbeat。只读 seat 没有 token。Contract activation/finalizer 只有在没有 writer/active operation 时才能分别原子转为 `authority_commit|finalizer`，并持有到 pointer/move 完成。`rollout_cutover` 也只能从零writer/operation取得，并阻断所有writer/activation/finalizer/旧lifecycle path move；只有matching nonce的cutover routine可写预计算rollout files与live marker。Lease 过期不自动视为安全：recovery 必须确认 host operation/child process 已结束，否则保持 blocked；cutover crash在final lock前只能显式abort/recover candidate并恢复guard，lock已durable则只能向前恢复enforce。需要 feature lock 的操作统一先取得 repo lease/barrier、再取得 stable feature lock，避免死锁。

这个 barrier 关闭受支持 AE 路径的 recheck→commit race；不受 AE 控制的编辑器/同用户恶意进程仍在威胁边界之外，但会被前后 manifest 尽力检测。Bash/MCP 若不能被 host recorder 可靠判定结束或可能留下 detached writer，v1 不授予 product mutation right。

### 9.4 Worker 与 evaluator loop

- 一次 attempt 内，mutation owner 可按观察自适应执行和 TDD；
- attempt 失败必须记录结构化 `diagnosis`：failed event refs、expected、observed、hypothesis、next action；
- 跨 attempt 只有一个 bounded evaluator→optimizer loop；
- 相同失败连续出现或达到 cap 时，Strategy 选择 re-plan、human 或 stop；
- diagnosis 永不作为 pass evidence。

### 9.5 Review 与 Debate

普通 review：

```text
proof manifest
→ one fresh evaluator per proof question
→ canonical judge events
→ Gate reduction
→ optional human-readable summary
```

不默认 Debate。只有存在至少两个可证伪的竞争假设、错误代价高、参与者能独立先行且有真实异质性时才升级 Team：

- Round 1 peer-invisible 独立取证；
- 后续最多两轮交换具体 evidence refs；
- 新信息停止增长或假设被证伪即结束；
- pairwise comparison 可用于候选选择并交换顺序，但最终 proof closure 必须回到绝对 Contract rubric。

### 9.6 v1 不发布 Dynamic Workflow

当前插件没有 workflow declaration。CC Dynamic Workflow 的 agents 固定 `acceptEdits`、无普通 mid-run human input、跨 session 不保留 run，并需要独立的 workflow→ledger 幂等桥。[官方 Dynamic Workflows](https://code.claude.com/docs/en/workflows)

为保证最小纵向切片，v1 不发布 workflow preset，也不让 workflow 成为 required path。未来启用前必须先证明：固定 seat schema、null/invalid 保留、唯一 recorder、ack + content digest、idempotency、partial failure replay、Gate 在 workflow 外独立运行。

## 10. Claude Code Host Binding

### 10.1 Session capability snapshot

每次前台 lifecycle 开始及重要 dispatch 前记录：

```yaml
cc_version: ...
invocation_mode: interactive | print | sdk
teams_enabled: true | false
agent_request: anonymous | named
isolation: none | worktree | unknown
context_fork: shared | forked | unknown
run_in_background: true | false
agent_binding: ordinary_subagent | teammate | unknown
result_channel: return | mailbox | task_poll | unavailable
team_resumable: false
sandbox:
  available: true | false
  level: ...
backends:
  codex: backend_correlated | host_recorded | unavailable
  gemini: host_recorded | unavailable
workflow_available: true | false   # observed only; v1 does not dispatch it
```

Snapshot 是input，不是 proof；每个coverage/judge invocation都需自己的canonical dispatch event，worker/research/pre-Contract invocation只写独立non-authoritative telemetry。

### 10.2 Agent 与 Team

截至本设计快照，binding 不是 `teams_enabled + name` 两个字段就能决定。当前实测规则必须进入 P0 compatibility table：

- interactive、Teams effective、named 且不带会改变 binding 的 isolation/background/fork 选项时才走 teammate 路径；`-p`/SDK 下 named request 当前仍可能是 ordinary subagent；所有组合以 live probe 为准，unknown 不猜；
- 期望 foreground return-only result 时使用经当前 invocation mode 实测为 `ordinary_subagent` 的 anonymous request，不能只根据 name 缺失推断；
- subagent result 返回 caller，teammate idle notification 不携带结果；Team 必须用 mailbox/Task 显式交付；
- 一个 session 只有一个隐式 Team；resume 不恢复 in-process teammates；Task 状态可能滞后；
- `TeamCreate`/`TeamDelete` 已移除，`team_name` 不承载 AE 语义；
- Team/Task 完成只表示协调状态，永不等于 proof closure。

这些是可漂移的 host binding，必须由 live tests 覆盖，而不是写死成永久产品哲学。[官方 Agent Teams](https://code.claude.com/docs/en/agent-teams)

### 10.3 Skills、Hooks 与 `/goal`

- Skill 是薄控制器：读 Gate facts、询问人类、调用 runner/recorder、dispatch seat、展示结果；
- plugin-level `PreToolUse` 在 artifact/judge seat 上强制 effective tool/mutation policy，并与 dispatch/input digest 关联；它也是 defense-in-depth，Gate 的 manifest/digest/provenance 校验是 backstop；
- `PostToolUse`、`SubagentStop`、`TaskCompleted`、`Stop` 可提供 telemetry 或触发重新 evaluate；原始 payload 不自动成为 evidence；
- `TaskCompleted` hook 可以阻止 Task UI 关闭，却不能代替 AE Gate；
- `/goal` evaluator 只看 transcript 中呈现的内容，不能独立读文件或运行命令，只适合 continuation UX；Gate output 可展示给 `/goal`，反向不成立。[官方 Goals](https://code.claude.com/docs/en/goal)

## 11. `/ae:*` 职责

### `/ae:analyze`

- 建立 source/intent facts，不写 Contract；
- 可对独立读取问题 fan-out；
- 输出引用真实文件与命令结果，不输出完成 verdict；pre-Contract fan-out只有host telemetry，没有canonical Seat/dispatch authority。

### `/ae:discuss`

- 发散 Intent、Scope、约束和替代方案；
- 只有竞争假设需要 peer exchange 时使用 Team；
- 结论只是 Contract draft 输入，不是批准事件。

### `/ae:plan`

- 起草 canonical Contract 与业务视图；
- 运行独立 coverage review；
- 通过明确 AskUserQuestion 让人接受、修改或拒绝；
- 批准后由 commit routine 写 immutable lock、`contract_activated` 与 matching pointer；
- 生成只引用 AC/proof ID 的可变 plan，并记录non-authoritative provisional selector telemetry；只有实际coverage才写canonical dispatch。

### `/ae:plan-review`

- 独立检查 Contract coverage、proof 可执行性和 Strategy 风险；
- 不能替用户批准，也不能在锁定后静默修 Contract。

### `/ae:work`

- 从 Gate 获取 pending/failed/invalid/unavailable/**stale** obligations；
- 取得 durable repo writer lease并保持一个 mutation owner；
- 执行 bounded attempts，命令通过 canonical runner；
- 失败先记录 diagnosis；需要 material change 时停止并提出 amendment。

### `/ae:review`

- 从 current Contract 生成 proof manifest；
- 对需要 judge 的 proof 使用 fresh evaluator；
- 只写 canonical judge/observation events与人类视图；
- 不计算全局完成、不写 done、不直接归档。

### `/ae:status`、`/ae:next`、dashboard

- 读取 Gate status/projection；
- 不再从 `review.md.verdict`、notes 或目录散文二次推断真值。

### Finalize

- 只有 `ae-gate finalize` 可执行；
- Skill 只能请求并展示结果。

## 12. Human Authority 与 Amendment

### 12.1 中断条件

必须联系人的情况：

- initial lock/material amendment；
- human proof；
- coverage gap 的 scope 处置；
- 新权限、不可逆外部动作、安全/合规选择；
- cap 后继续需要改变 Contract 或产品决策。

cap 到达本身不必强制询问；如果可以安全 stop/blocked，Strategy 可直接报告。

### 12.2 Amendment 事务

所有 revision commit、Ledger append 与 finalize 共用一个位于可移动 feature 目录外的 stable feature lock：`.ae/transactions/F-NNN.lock`。

1. 保留 current revision 与全部 evidence；append `amendment_opened`，绑定 base activation、material diff 与原因；
2. 验证 derived feature origin 与 prior activation，生成 `seed_generation=carried_forward` 的 immutable seed：绑定 origin/comparison-base provenance、prior activation/effective-union并按 known/unknown-conservative removal规则计算到当前 snapshot的 net delta；再在generation-qualified `contract/revisions/<revision>/<generation>.json`与matching view path生成immutable candidate并fsync；被activation选中前它们没有current authority；
3. fresh coverage evaluator 对该精确 candidate/seed/input manifest 产出 first-terminal `coverage_review`；有 material gap时必须先落实typed resolution，使`candidate_semantic_digest`与`coverage_question_projection_digest`都实际改变，才能提高generation并从第2步重来；只bump G/R不可重审；
4. 人类查看精确 view + coverage/risk summary，接受、修改或拒绝；拒绝时追加 human-correlated `amendment_resolved(rejected)`；
5. 接受时追加 `contract_approval`，绑定exact `candidate_identity`、`candidate_generation_binding`、latched coverage review/subject digests 与 human assurance；
6. 原子取得 repo `authority_commit` lease，再在 stable feature lock 内重新验证 base activation仍是 current、origin authority未变、coverage source/product baseline/seed snapshot、所有 digest/event且无并发 finalize，然后写 immutable lock并 fsync；
7. append+fsync 单调 `contract_activated`（同时 resolve 对应 amendment），再 atomic replace + fsync `current.json`，释放 authority lease；
8. Gate 重放：旧 revision event 全部只作 `superseded` 历史；v1 **一律重新取证，不存在跨 revision 兼容复用**。

同一 idempotency key 的 commit 可安全重试。Activation 前任一点崩溃都保留旧 current，孤立 candidate/coverage/approval/lock inert；activation event 后、pointer 前崩溃进入 `integrity_recovery_required`，恢复器只能把 pointer 补到已提交的新 activation。两个 approve/amend/finalize 竞争时由 stable lock 串行；若 base activation 已变，较晚事务 deterministic conflict，不能覆盖。

## 13. Finalize 事务

唯一 finalizer 使用 `.ae/transactions/F-NNN.lock` 与 `.ae/transactions/F-NNN/TX-*.json` journal。每个 transaction 文件永久保留，phase 只按 `PREPARED→COMMITTED|ABORTED` 原子前进；新事务不覆盖旧 journal，同一 feature 同时最多一个 nonterminal journal。任何 nonterminal journal 都先阻断该 feature 的**新** writer、authority commit、public/internal record 请求与新 finalize。唯一例外是创建该 PREPARED 的同一 finalizer operation仍连续持有 matching durable repo lease + stable feature lock + transaction ID/operation nonce时，只能执行下述已预计算的 `finalize_prepared` append、move、seal步骤，不能接受外部 payload或开启第二事务；这不是 generic record 入口。该 operation一旦丢失 lease/lock、进程退出或宿主无法证明连续 ownership，之后除read-only status/diagnostic inspection（不append canonical `diagnosis` event）外只允许显式 `recover` 绑定同一 TX并按恢复状态机归约成 `COMMITTED|ABORTED`。Approve、amend、record、recover、finalize都竞争 stable lock；锁不随 feature directory move。

Gate 的 `eligibility_core_fingerprint` 覆盖 latest activation ref/digest及其exact `candidate_identity`/lock、每个 selected attempt/event-set digest、source manifests、locked pre-activation seed ref/digest/provenance、current post-activation delta 与 effective-union digest、effective catalog 中每个 floor 的 applicability inputs/evaluation/disposition/status，以及 Gate runtime identity（plugin version + Gate code/schema/reducer/filesystem-helper digests），但不包含 lifecycle control event。Finalizer 的 transaction `eligibility_fingerprint = hash(core_fingerprint + evaluated_ledger_head H)`。不得用“当前项目的 git HEAD”冒充已安装插件 build。

Node ESM 是主 runtime，不代表 Node `fs.rename` 已提供完整no-clobber语义。P0 platform feasibility spike必须资格认证一个versioned native/external filesystem commit helper，并把能力拆成closed `atomic_directory_noreplace` 与 `atomic_file_noreplace`：两者都从同文件系统已完整fsync的source/staging原子发布、target exists绝不覆盖，并分别实测并发race、source/target parent fsync与power-loss；macOS可用等价于`renameatx_np(..., RENAME_EXCL)`的原语，但不能因目录臂通过就推定文件臂通过。Origin/finalizer要求directory capability，migration marker/rollout lock要求file capability。

Helper selector不止是OS/arch：closed qualification entry/result还绑定实际filesystem implementation/type/version（可观测时）、local|remote、mount/volume capability与相关flags、source/staging/target device identity及same-filesystem关系。每次operation在持锁后从resolved paths live采样并要求exact match；unknown filesystem、APFS结果用于exFAT/NFS/SMB、同OS不同mount/flag/device或source-target跨device固定`unavailable`。Isolation provider若其保证依赖filesystem/mount，同样必须把适用维度纳入selector。Helper catalog绑定per-environment suite+**passed result artifact**、source/build、exact selector与capability；digests进入Gate runtime identity。Missing/failed/mismatched result、probe mismatch、`open(O_EXCL)`直接写final bytes或`exists(target)→rename` TOCTOU都不合格，平台/volume不能进入相应enforce路径。

规范中任何“no-clobber/no-replace发布”的authoritative regular file（payload、seed、Definition/renderer snapshot、migration marker、rollout lock等）都必须选择上述qualified file capability；任何authority directory publication/move选择qualified directory capability。普通可重建projection的atomic replace另按temp file fsync→same-filesystem rename-replace→parent fsync协议，不冒充no-replace authority commit。

提交协议：

1. 原子取得 durable repo-mutation `finalizer` lease，再取得 stable feature lock；解析 source/target，验证同一文件系统、source identity、target 不存在，并确认平台支持 atomic **no-clobber** rename 与两个 parent-directory 的可靠 fsync；缺任一能力返回 `unavailable`；
2. 验证 latest activation→pointer→lock→coverage/approval、Ledger hash/head、无 unresolved amendment，并在锁内 Gate evaluate；非 eligible 只返回原因；
3. 重算所有 source/post-activation product-delta manifests；只校验 activation 锁定的 pre-activation seed ref/digest/bytes并计算同一 effective union，绝不重生成 seed。随后生成 core/transaction eligibility fingerprints、完整 `proofs_at_commit` 与 `pre_ledger_head=H`；固定 created_at/idempotency/producer/seq/prev/payload ref+digest等全部字段，同时预计算canonical `finalize_prepared` H+1 与 `finalized` H+2 的payload/event-line exact bytes、IDs/digests/heads。**两份payload**都在source authority tree中以no-clobber发布并file+parent fsync，event templates写入external transaction sidecars并fsync；payload-only orphan因而在move前就固定，H+1 prepared snapshot明确包含它们。由于H+2所有authority bytes已固定，可分别预算target在H+1的`prepared_evidence_snapshot_digest`与H+2的`expected_committed_evidence_snapshot_digest`。`finalize_prepared`与`finalized`两份payload schema都**禁止**任何evidence-snapshot ref/digest；snapshot digests只位于external PREPARED/COMMITTED journal，journal再绑定两条event IDs/digests，因此authority DAG固定为`templates/payloads → snapshots → journal`，不形成循环；
4. 原子写并 fsync `PREPARED` journal，其中绑定 transaction/feature/source/target identity、fingerprints、`proofs_at_commit`、source/post-activation manifest digests、pre-activation seed ref/digest、effective-union digest、`pre_ledger_head`、**两组** payload/template refs+raw digests、完整prepared/finalized event IDs/digests/created_at/idempotency、`prepared_ledger_head=H+1`、`committed_ledger_head=H+2`、两个evidence snapshot digests与Gate runtime identity。Journal/sidecars足以跨进程逐byte恢复，不依赖重新取时钟或让recorder重填envelope；
5. Finalizer专用 recorder endpoint只能把journal绑定的**精确 canonical event-line bytes** append到仍为H的Ledger；任何字段重建或byte差异拒绝。正常head转移只允许 `pre_ledger_head → prepared_ledger_head`；
6. 在 H+1 上立即重新 evaluate并重算 **core** fingerprint，确认 Ledger 相对 H 唯一 suffix 就是预计算 event；core/authority/current/source/delta/build 任一变化都 abort，不把 H+1 当作新的 transaction fingerprint、不 move；
7. 使用同文件系统 no-clobber rename 将genesis/activation锁定的exact stable live source path移至 `done/F-*`，绝不根据logical `active|paused`状态猜source、也绝不覆盖已有 target；rename 是不可逆 lifecycle decision。随后必须 fsync target parent 与 source parent（相同 inode 只一次）形成正常 durable move；若其间崩溃，恢复观察到 matching `source absent + target exists` 后先补 fsync，但仍固定为 `committed + integrity_recovery_required`，绝不反向 move；
8. 从 target 内复核 identity、activation、prepared event 与 manifests，finalizer专用endpoint只能幂等追加/fsync journal预绑定的exact `finalized` H+2 event bytes并推进head；不得现场重建created_at/envelope。随后重算target内权威文件集合（含 Contract、Ledger/head、artifacts 与 manifests；排除可重建 projection）并要求等于PREPARED所绑`expected_committed_evidence_snapshot_digest`，再以 temp file + file fsync + atomic replace + journal-parent fsync 更新为 `COMMITTED`；COMMITTED 额外绑定 finalized event ID/digest、committed Ledger head 与该 snapshot digest，且只能写在 durable move 后；
9. 更新可重建 projection，释放锁。

任何 move 前的正常退出都必须原子标记尚存 journal 为 `ABORTED`（若已创建）并释放 feature/repo lease；进程崩溃则由 lease recovery 先确认无 active operation，再按下述状态机继续。

生命周期的规范 commit predicate 是：`source absent ∧ target exists ∧ external journal 为有效 PREPARED 或 COMMITTED ∧ journal/target/precomputed lifecycle events/at-commit eligibility fingerprint 全部匹配`。Valid PREPARED 分支允许两个唯一向前中间态：Ledger/head在H+1时必须匹配`prepared_evidence_snapshot_digest`；在H+2时必须只多出exact finalized suffix并匹配`expected_committed_evidence_snapshot_digest`。两者都投影 `committed + integrity_recovery_required`；进入 `COMMITTED` 后再满足 finalized event、committed Ledger head 与 snapshot digest 的交叉校验，投影 `committed + ok`。Target 路径本身不是 authority；这里的 fingerprint 是 transaction 捕获的历史值，绝不与未来 live repo 重新比较。

恢复规则唯一：

- `PREPARED + source exists + target absent`：尚未提交；canonical Ledger recovery必须先把合法partial tail唯一归约到H或exact H+1。Head=H时只能从journal sidecars逐byte补exact prepared event；head=exact H+1时重新evaluate后重试move。若head/activation仍是H/H+1但source/core fingerprint已漂移，可把未提交TX标`ABORTED`后重新evaluate；template/payload缺失或digest不符、任意其他完整head/suffix、旁路authority append或无法唯一归约的tail一律`integrity_error`，绝不能用ABORT接纳并从新head继续；
- `PREPARED + source absent + target exists`：lifecycle 已 committed、feature 为 `integrity_recovery_required`。Head=H+1且prepared snapshot匹配时，只向前补parent fsync、exact finalized H+2、snapshot校验与COMMITTED seal；finalized line尾部截断或event完整但head未进时，只按canonical Ledger recovery验证/隔离到H+1后重放exact template；head=H+2时必须唯一suffix与expected committed snapshot全匹配，然后只补COMMITTED journal与`feature_status=ok` projection。其他head/suffix/snapshot为`integrity_error`；
- `PREPARED + both-exist|both-absent`：`integrity_error`；
- `COMMITTED + source absent + matching target/finalized-event/committed-head/immutable-evidence-snapshot`：幂等返回 already-finalized；COMMITTED 下 source-only、both-exist、both-absent、target mismatch、snapshot mismatch 或 final event/head mismatch 全是 `integrity_error`；未来 live source/product delta 不参与此分支；
- `ABORTED` 只有 source exists + target absent 合法；其他 path 组合为 `integrity_error`；
- target 无有效 PREPARED journal、identity/fingerprint 不匹配、journal 截断或非法 head 转移：`integrity_error`，要求人工诊断；
- 两个 finalizer 并发：只有持 stable lock 者可继续，另一方随后得到 already-finalized 或 deterministic conflict。

`review.md`、Task completed、manual `mv` 都不是受支持的 finalize 路径；manual move 到 done 会因缺有效 PREPARED journal 被标 integrity defect，不能伪装成 lifecycle commit。唯一例外是 cutover 前已被 v1 rollout lock 精确列入 legacy-done manifest 的历史对象，它只走 read-only adapter，绝不转成 v1 commit。

## 14. 存储形态

新或 migrate-on-touch feature：

```text
.ae/features/{active|paused}/F-NNN-slug/ # new固定active；migrated沿rollout原path；pause/resume不move，finalize才去done
├── index.md                         # 人类视图/投影，不是完成真值
├── plan.md                          # 可变 Strategy，只引用 AC/proof ID
├── contract/
│   ├── revisions/R0001/G0001.json   # immutable generation；activation前inert
│   ├── views/R0001/G0001.md         # matching exact approval view
│   ├── locks/R0001/G0001.lock.json  # selected generation digest + approval
│   ├── seeds/<digest>.json           # immutable pre-activation affected set
│   ├── policies/extensions/<digest>/ # selected project extension 本地 immutable bytes
│   └── current.json                 # pointer
├── authority/
│   ├── definitions/<digest>         # dispatch时快照的exact raw Definition bytes
│   ├── renderers/<digest>/           # historical deterministic renderer compatibility bundle
│   ├── releases/<digest>.json        # activation policy epoch的local historical release manifest
│   └── migration-genesis.commit.json # 仅migrated；atomic file publication commit marker
├── ledger/
│   ├── events.ndjson                # append-only canonical hash chain
│   ├── head.json                    # seq/digest/byte offset；原子更新
│   └── telemetry.ndjson             # optional；非权威、非 hash-chain 输入
├── runs/
│   └── RUN-.../                     # raw output, manifests, event payloads
└── state/
    └── status.json                  # Gate cache，可删除重建

.ae/shadow/v1/<epoch>/
├── features/                         # P1 shadow-only mirror；永不被production reader/finalizer消费
└── transactions/origins/**           # shadow-local journal/lock/staging；不进入production ID union

.ae/transactions/
├── repo-mutation.lock               # 只保护 lease-state 的短时 OS mutex
├── repo-mutation.json               # durable writer/authority/finalizer/rollout lease + host operations
├── origins/F-NNN/OP-*.json           # origin_publication PREPARED→PUBLISHED|ABORTED journal
├── migrations/F-NNN/OP-*.json        # existing-tree migration_genesis journal；marker是commit point
├── rollout/
│   └── CUT-*/
│       ├── prepared-core.json         # immutable cutover inputs + deterministic lock fields
│       └── journal.json               # PREPARED→PUBLISHED|ABORTED anti-rollback witness
├── F-NNN.lock                       # stable feature lock，位于可移动目录外
└── F-NNN/
    └── TX-*.json                    # 保留每次 finalize transaction；amendment state 在 Ledger

.ae/rollout/
├── candidates/CUT-*/                 # inert immutable candidate；done/live/reserved manifests + safe view
├── approvals/<digest>.json           # foreground-adapter rollout approval record
├── live-origins/F-NNN.json           # path-independent ID+origin-nonce external marker
└── v1.lock.json                     # 唯一 no-clobber enforce commit；3 manifests + approval

.ae/proposals/floors/
└── FP-<content-digest>.json          # post-COMMITTED、非权威；不进入 done snapshot/Gate
```

Canonical JSON/NDJSON 不允许由 Markdown 反向解析生成。Markdown 只作人类视图。

## 15. 兼容与迁移

- `/ae:*` 用户入口尽量保持；语义变化在 README 明示；
- 新 feature 只走 1.0 真值路径；
- active/paused legacy feature 在下一次 plan/work/review 时显式 migrate-on-touch；
- migration 展示转换后的 Contract 并要求人确认，不推测旧 assurance/closure，不自动给历史 pass；
- `product-delta-v1.schema.json` 是closed `pre_activation_seed|post_activation` union。Seed origin只允许new的`new_workspace`或migrated的`human_adopted_conservative`；migrated必须绑定完整historical-path universe，把Git history paths∪current index/worktree/untracked的present与current-absent historical tombstone纳入，shallow/missing/coverage不全blocked。Current HEAD、mtime/prose/human attestation不能创建第三种trusted-base分支。应有entry却空seedinvalid；只有完整证明count=0才可真空，不能借baseline得到N/A；
- Active Gate/finalize 的 effective product delta 是 deterministic path-keyed `locked_pre_activation_seed ∪ current_post_activation_delta`：保留 seed provenance，重叠 path 的 current tuple 取 post-activation 分支，tuple/digest 冲突 fail closed，canonical path 排序保证重放同值。Floor applicability、coverage 与 proof source coverage 都消费这一个 union。任一 root/type/tombstone 无法完整枚举时，candidate/convert 固定 `activation_blocked`（若由环境能力缺失则附 canonical `unavailable` 原因）；migrated feature 可显示更具体的 `migration_blocked`。人可先收窄/修正 boundary 再确认新 candidate，但这仍是 material amendment；
- 后续 revision 不能把 migrated origin改成 new，也不能把当前 Git HEAD/index当新起点。其 `carried_forward` seed必须绑定 prior activation/effective-union并按每条 tuple的 bound comparison base计算 net delta；“pre-creation dirty D（Git base C）在 R0002 未变却因 D 等于 creation workspace而消失”与“R0001 后修改并 commit，R0002给空 new seed”都固定 invalid。Known tuple只有恢复其 trusted base才移除，unknown-conservative不自动移除；先前 affected path即使被新 boundary遗漏仍进入 seed并使 boundary coverage invalid；
- done 历史只读，不批量改写；
- v1 committed done 只走两个封闭分支：valid `PREPARED` + matching prepared target snapshot 投影 `committed + integrity_recovery_required`；`COMMITTED` + finalized event + matching final snapshot 投影 `committed + ok`。两者都读取 journal 冻结的 `proofs_at_commit`；后续 feature 对相同 live source 的修改属于新事务，不使旧 done stale；
- 只有旧 done 的 target 权威快照、Ledger/head 或 external journal 交叉 digest 失配才是 `integrity_error`；不得因为当前 workspace 与 commit-time manifests 不同而报错；
- Healthy rollout已由matching lock +唯一PUBLISHED journal/core建立后，feature-level legacy/new判别只相信该immutable lock所绑manifest、migration marker与matching genesis event。Lock绑定一个inert candidate中的三份一次性closed manifest：`legacy-done` 收录done、`legacy-live` 收录active/paused、`legacy-reserved` 收录abandoned及其他明确terminal/reserved IDs；每项含normalized feature ID、resolved non-symlink path、canonical tree snapshot digest与closed lifecycle classification。Cutover scan必须枚举所有production `active|paused|done|abandoned`对象，要求每个discovered object恰在一个manifest、三集按ID与resolved path同时两两不交，不得有duplicate ID/path、symlink/hardlink alias、ghost或漏项。Done matching项才走read-only adapter；reserved项只保留ID/path占用，不伪装done/live。
- Live entry另绑定**cutover historical** snapshot与一对no-clobber marker refs/digests。External/feature marker只含feature ID +随机stable origin nonce + producer build，不含可变path/snapshot；两者必须byte-equal，manifest再绑定当时resolved path。这使未生效candidate的marker可在同一legacy identity上安全复用，而删除后复用ID/path会因internal marker缺失/不同nonce被拒绝。Migration genesis验证lock/live entry/双marker与current path，但不要求current tree等于cutover snapshot，期间content变化由seed接管。
- Cutover approval不由lock字段自证。Trusted renderer把sorted三manifest entries、双marker、guard/drain、cutoff/nonce、runtime/schema digests与current singleton activation-policy epoch/base-bundle digest生成不截断safe view；foreground adapter证明exact request/response后专用producer no-clobber写closed approval。Lock绑定approval、local renderer/input/view/host attestation与cutover policy epoch；missing/self-authored/summary/truncated/无host correlation不可发布。未来runtime epoch可变更new-candidate minimum，但lock保留cutover历史值，不替代current release singleton。
- Cutover必须在单一 repo `rollout_cutover` authority barrier内完成：先部署guard拒绝所有旧`pause|resume|abandon|restore|finalize`等path-changing lifecycle操作，以及所有会修改done/abandoned subtree的graph refresh、edge/index backfill、metadata formatter等retained writer，等待并证明旧writer/在途move为零。随后只做identity pre-scan以找出live对象，先写/复用双marker并fsync，**再**做第一次全量partition/tree snapshot；canonical tree projection因而包含已存在的protected feature marker及其digest，不会因cutover自己造成drift。由此生成candidate manifests与human view；人批准后在同一barrier内第二次全量扫描，并要求inventory/tree/markers/runtime/guard全部相等。所有new-ID创建检查也覆盖locked/candidate manifests、production roots、markers与transactions的ID/path union。Duplicate/alias/ghost/漏项必须在approval前显式处置，不可猜测合并。
- Human approval与final re-scan相等后，routine先在stable `.ae/transactions/rollout/CUT-*/`写immutable `prepared_core`并fsync，再写closed PREPARED journal并file+parent fsync。Core绑定candidate/三manifest/markers/approval/trusted renderer/guard/drain/runtime/schema/policy epoch与预计算lock fields；PREPARED只绑定core ref/digest、lock target、derivation version与operation nonce，不绑定未来lock digest。此时没有enforce authority，lock absent时可ABORT；任何PUBLISHED rollout journal必须全局唯一。
- Guard、reader、qualified runtime与final scan就绪后，routine才把同filesystem临时source中完整fsync的final lock用qualified `atomic_file_noreplace`发布到`.ae/rollout/v1.lock.json`并fsync parent。Lock bytes由prepared core确定性生成并绑定core digest/journal ref/nonce；**durable lock path是唯一positive、不可逆enforce commit**。随后journal原子seal为PUBLISHED并绑定actual lock ref/digest；DAG为`candidate/approval → prepared_core → {PREPARED journal, lock} → PUBLISHED seal`，无环。Lock move后崩溃固定enforce+recovery并只向前seal；不能open-final后写。Final path不存在且没有PUBLISHED witness时candidate/approval/marker/PREPARED均inert，可abort后重scan；不得先inventory后guard或lock后回legacy。
- PUBLISHED journal是anti-rollback witness，不是第二个可选择mode：matching lock+receipt才是healthy enforce；PUBLISHED+lock missing/mismatch、lock存在但matching journal/core missing/mismatch、多个PUBLISHED receipts均全局`rollout_integrity_error`并保持所有旧writer guarded，绝不回off/shadow。PREPARED+matching lock视为commit已发生的`rollout_recovery_required`全局barrier：除read-only status/diagnostic与matching recover外，new origin、migration、work、record、approve、lifecycle与finalize均零写；持matching lease/nonce的同一continuous cutover owner也只能执行预计算parent fsync与PUBLISHED seal。Guard在读取mutable config前同时枚举lock与stable rollout journals。单独删除/回滚lock或receipt、恢复pre-cutover config/tree都fail closed。若同一存储故障同时抹除lock与全部PUBLISHED witness，纯本地v1无法与pre-cutover区分；这属于备份/介质灾难边界，发布运维必须把`.ae/rollout`与`.ae/transactions/rollout`作为一个原子恢复集，不能宣称本地协议可检测全量历史抹除。
- Effective rollout先检查stable journal+lock：matching lock+PUBLISHED⇒healthy `enforce`；matching lock+PREPARED⇒commit已发生但只返回`rollout_recovery_required`，不得路由到普通enforce业务入口；PUBLISHED witness但lock missing、lock/journal/core任一损坏⇒全局`rollout_integrity_error`且旧writer继续guard；只有lock absent且无PUBLISHED witness时，mutable`off|shadow|enforce`才作为request/diagnostic，其中request enforce=`rollout_lock_required`。Healthy lock存在时config改off/shadow仍persist enforce并报mismatch。PUBLISHED后legacy-live可在原path受单writer content work，但旧lifecycle move固定migration-required；三legacy sets不可扩张。Receipt只提供rollback detection，不提供另一套normal-mode current authority；
- 清单外或cutoff后产生的journal-less done一律`integrity_error`；legacy-done（以及manifest明确声明immutable的reserved）current tree snapshot mismatch同样invalid。Legacy-live的cutover tree digest只作历史provenance：稳态只校验lock entry/path+双marker identity，允许single-writer content drift并由migration seed接管，不能套用done snapshot equality。已migrate对象改走matching genesis/commit marker与v1 Ledger。Reader不得用prose、mtime、文件名外观或“看起来很旧”自行grandfather；
- Active/paused reader先按上述global rollout state分流，再运行feature discriminator：lock absent且无PUBLISHED rollout witness时，production继续旧reader（requested shadow只在`.ae/shadow/**`旁路比较，candidate/approval/双marker均inert且不能改变production结果）；rollout recovery/integrity state分别返回全局barrier/error；只有matching lock+PUBLISHED的healthy enforce才依次检查matching nonterminal migration journal→migration recovery barrier、matching PUBLISHED migration commit marker+genesis→v1 `draft_unactivated|active|paused` Gate、marker absent且ID/path+双marker命中locked legacy-live→临时legacy prose reader，marker/journal存在但不匹配或三支皆不命中→integrity error。`goal.frozen.md`/notes/review只在pre-cutover旧reader与healthy-lock第三支暂时有legacy truth作用，迁移后不再是machine truth；
- `legacy_live_prose_truth_fallback` config只是**project-local**退役request：locked legacy-live仍有任一未PUBLISHED entry时effective fallback强制true，request false报`rollout_configuration_mismatch`而不能断reader；只有本项目全量join证明每项已由v1 reader接管且零consumer后，才允许effective false并让该项目的执行branch永久不可达。该事实不能授权从共享插件发行物删除shadow、pre-lock old reader、migrate-on-touch或live fallback实现；AE 1.0包必须按每项目rollout state保留这些兼容模块，使新安装/晚升级项目仍能完成P1→cutover→P5。Plugin-global sunset需要独立产品版本、支持期与跨安装迁移策略（或随包独立migrator），不由任一项目的lock/manifest推导。Requested-mode诊断字段仍保留用于lock+off/shadow mismatch测试，不删除parser；
- shadow 只用于有限 rollout；enforce 后 new feature 不允许双真值；
- 删除旧机制前必须有 property map 与 mutation test。

## 16. Knowledge

v1 保持 `.ae/graph` 与现有 readers 的兼容，不重命名。Knowledge 从 completion path 解耦：

- 可记录非阻塞 `knowledge_hit` telemetry；
- graph refresh/edge backfill只能写committed/legacy target之外的`.ae/graph` authority/derived store，禁止回写locked done/abandoned feature tree；
- finalize 后可产生带 source 与 invalidation condition 的候选；
- knowledge 不闭合 proof、不改变 current Contract；
- 发布后用 seeded delivery test 验证读取链；30/60/90 日的 read-hit、节省与维护成本只进入人类 review，由人决定保留、改造或删除，不设自动时间死刑；
- 自然 hit > 0、写入数量或图健康不作为 1.0 Gate。

Floor 演进与普通 knowledge 分开：逃逸缺陷、被推翻判决或系统性 coverage gap 可以由 **post-COMMITTED `/ae:retrospect`** 在 committed target 外的 `.ae/proposals/floors/` 以 content-addressed、no-clobber 方式产生 `ae.floor-proposal.v1` 候选，建议字段含原始 event refs/digests、applicability、obligation、invalidation condition 与 producer build。Finalizer 不调模型生成 proposal，proposal 不进入 PREPARED/final target snapshot；malformed/missing proposal 只使该 proposal 无效，永不改变已提交 feature、Contract、catalog、Gate 或 feature integrity，也不强制本次 finalize 再询问人。

项目级采纳/收紧/退休只能成为后续独立、human-confirmed 的 `feature_kind=policy_extension_release`：它可把 proposal 当非权威 source，产出恰含一个新 floor ID 的 `ae.policy-extension.v1` content artifact与完整 schema fixtures，经 explicit human proof 批准 exact digest后由普通 v1 finalizer committed。未来 Contract candidate 才能显式选择并本地快照该 extension；收紧选择新 ID 的 extension并省略旧 extension，退休则只省略旧 extension，旧 Contract 永不追溯受影响。Plugin-global floor 仍走新 plugin bundle；project extension 不要求插件发版，也不伪装成全局默认。v1 不实现仅凭 proposal/文件存在就自动获得 project-wide authority 的 promotion；若未来需要“所有 Contract 必继承”，必须另行设计 project-policy activation/current chain。

## 17. 设计决策

- **D1**：AE 1.0 本体是 Proof Loop，不是生命周期阶段。
- **D2**：Contract 是唯一验收真值，Strategy 可变。
- **D3**：当前 revision 内执行者不能弱化；人类可通过新 revision 改变任何 material boundary。
- **D4**：Canonical JSON/NDJSON 是机器真值，Markdown 是生成视图。
- **D5**：Ledger append-only，状态由 pure reducer 重放。
- **D6**：完成只有一个写入口，finalize 是可恢复事务。
- **D7**：运行语义只有 command/artifact/human 三种 proof mode。
- **D8**：Structured output 只证明 shape；claim 必须有 provenance 与 semantic adjudication。
- **D9**：Definition 与 Seat Contract 分层；agent 自述不是权威。
- **D10**：Pattern 是 Execution Policy，不是 Gate、阶段或 DSL。
- **D11**：一个 feature 一个 active mutation owner。
- **D12**：Agent Team 只用于 peer exchange；ordinary review/research 使用 return-only subagent。
- **D13**：Cross-family 是 proof seat 属性，必须按 family lineage 与 invocation assurance 计数。
- **D14**：Dynamic Workflow、knowledge rename、跨 runtime Core 均不进入 v1。
- **D15**：Approval view 是 candidate 的确定性、字段完备投影；摘要不能隐藏 material recipe 或 floor 字段。
- **D16**：Judge authority 必须闭合 `dispatch → raw seat_result → verdict` 的单次授权链；producer role 或 shape-valid JSON 单独不够。
- **D17**：Floor catalog 必须被逐项处置；floor proposal 只是未来 opt-in extension release 的非权威输入，不能追溯修改当前 Gate，v1 不伪称 project-wide 自动 promotion。
- **D18**：Gate、runner、renderer 与 adapter 只认识版本化协议，不硬编码 feature/项目语义；业务事实只由 Contract 与 policy bundle 注入。

## 18. 成功判断

v1 成功不是“新文件都写完”，而是：

- F-082 类已有 false-pass 在新 Gate 下稳定 fail closed；
- Contract 未经人确认不能 current，material drift 不能绕过；
- command/artifact/human proof 都能从原始事件重放；
- backend 未调用、同族伪装、无效引用、伪造 verdict 和 stale snapshot 都不能闭合 proof；
- floor catalog 的漏项、伪 N/A 与原地 policy 改写都不能激活或追溯改变 Contract；
- session resume、partial output、双 finalize 与 crash point 有唯一结果；
- Teams/cross-family 不可用时能显式降级，纯 command feature 仍可完成；
- new-feature 生产路径只有一个 finalizer；
- 默认 topology 相对 solo baseline 有证据，否则回退到更简单路径；
- 删除的每个旧机制都有相同 assurance property 的替代测试。

完整发布门见 [`acceptance-and-evaluation.md`](acceptance-and-evaluation.md)。
