# 当前 AE 实现地图（供 v1 设计使用）

> **Status: historical — a source proposal, not a plan.** This is one of the
> independent proposals written before AE v1's design was consolidated. It was
> never the specification, and the specification it fed into has itself since
> been archived. **Nothing here has authority over current work.** The set and
> how each source was judged: [`README.md`](../README.md). The current account of what AE
> is and where it is going: [`rebuild.md`](../../../rebuild.md).

> 这份地图描述当前仓库实际实现，不把愿景材料当作代码事实。
> 它只回答“v1 从哪里改、哪些基础可复用、哪些保证目前只是约定”。

## 1. 实现性质

AE 不是一个独立应用或服务。它是 Claude Code 原生插件，主体是：

| 构件 | 当前数量 | 作用 |
|---|---:|---|
| `SKILL.md` | 24 | `/ae:*` 入口、流程规范、状态读写规则 |
| Agent 定义 | 19 | review、research、workflow、engineering 角色 |
| 辅助脚本 | 35 | harness、loop、trace、graph、ID、静态约束 |
| Shell 机制测试 | 61 | 以脚本/文本契约为主的确定性测试 |
| 自有 MCP bridge | 2 | Gemini、generic OpenAI-compatible；Codex 使用供应商 MCP server |

关键入口：

- 市场清单：`.claude-plugin/marketplace.json`
- 插件清单：`plugins/ae/.claude-plugin/plugin.json`
- Skills：`plugins/ae/skills/*/SKILL.md`
- Agents：`plugins/ae/agents/**/*.md`
- 确定性机制：`plugins/ae/scripts/`
- 项目配置模板：`plugins/ae/templates/pipeline.template.yml`
- 持久状态：项目 `.ae/`

不存在独立 orchestrator、daemon、REST API、数据库或 Web UI。Claude Code 解释 skill 文本并调用宿主工具，AE 自己只实现少量确定性辅助逻辑和 MCP bridge。

## 2. 当前主链

```text
/ae:backlog
    ↓
/ae:analyze        创建/填充 feature
    ↓
/ae:discuss        可选，多 Agent 形成 conclusion
    ↓
/ae:plan           Steps + AC + verify_by + recipe；写 goal.frozen.md
    ↓
/ae:work           step TDD → checks → review → commit → loop
    ↓
/ae:review         AC judgment + verdict + fixup + archive
    ↓
features/done/
```

代码锚点：

- Analyze promote 与 feature 建立：`plugins/ae/skills/analyze/SKILL.md:83-176`
- Plan 的 AC/harness 结构：`plugins/ae/skills/plan/SKILL.md:145-229`
- Plan 自动冻结目标：`plugins/ae/skills/plan/SKILL.md:371-382`
- Work 预检、TDD、pre-commit、自动 gate：`plugins/ae/skills/work/SKILL.md:69-175,256-390,477-500`
- Work harness loop：`plugins/ae/skills/work/SKILL.md:536-591`
- Review harness satisfaction：`plugins/ae/skills/review/SKILL.md:215-228`
- Review completion/archive：`plugins/ae/skills/review/SKILL.md:615-714`

## 3. 当前持久数据模型

### Feature 生命周期

固定目录：

```text
.ae/features/{active,paused,done,abandoned}/F-NNN-<slug>/
```

路径是当前最强的 lifecycle 信号。`index.md` 另有 `status:`，因此存在路径与 frontmatter 双写；多数 reader 以路径优先（`plugins/ae/templates/pipeline.template.yml:4-17`）。

### Plan

Plan frontmatter 有 `draft / reviewed / done / cancelled`。正文同时拥有：

- steps 与 checkbox；
- expected files；
- AC 内容；
- `verify_by`；
- `fixture`；
- exact `verify:` recipe；
- derived `human-gate`。

也就是说，当前 plan 同时承担正确性定义、证明定义和执行策略三种责任。

### Frozen goal

Plan review 后，`## Acceptance Criteria` 被原样复制到 `goal.frozen.md`。Review/Archive 优先读它，防止 live plan 在执行期移动目标。

已有正确意图：goal 与 plan 分开。当前缺口：

- freeze 没有用户批准事件；
- 没有 digest；
- 没有 amendment；
- 文件被改后没有通用 hard gate；
- recipe 与 AC 仍是 Markdown 文本契约。

### Milestones

- `step-summaries.md`：每步 decision/rejected/dependency/actual files；
- `notes.md`：deferred、waiver、unverified AC、loop iteration；
- `evidence/`：collector 输出；
- `artifacts/`：judge AC 运行产物。

这已经证明“状态落盘抗 compaction”是 AE 的正确方向，但太多不同语义共享自由文本 `notes.md`。

### Review

Pipeline review 以 `review.md` frontmatter `verdict: pass|fail` 参与流程；ad-hoc review 刻意不写 verdict。Loop mode 会覆盖 canonical review，避免读到 stale verdict。

这修复了一个具体 stale 路径，但仍让“最后一份 review 文件”承担过多状态责任；失败历史会被覆盖，终态与 verdict 强耦合。

## 4. 当前确定性边界

| 脚本 | 当前回答的问题 | 不回答的问题 |
|---|---|---|
| `check-harness.sh` | 每个 deterministic AC 是否声明 `verify:` | command 能否运行、是否非空、是否覆盖 AC |
| `collect-ac-evidence.py` | 运行 recipe、解析少数 runner、写 facts JSON | 业务充分性；但 parser/vacuity 与执行耦合 |
| `parse-review-verdict.sh` | 从 review frontmatter 归一化 verdict | verdict 是否可信 |
| `loop-decide.sh` | verdict + iteration + cap → next action | verdict 从何而来、evidence 是否完整 |
| `verify-contract.sh` | jq spec 对 sample 是否退出 0 | spec 是否代表真实业务 |
| graph scripts | 结构、路径、锚点、边 schema | 关系语义是否正确 |

当前最值得保留的边界是：**脚本测量可确定事实，LLM 判断语义。** v1 不是把判断都塞进 Python，而是把事实、判断和状态决策拆开。

## 5. Claude Code 宿主能力映射

| CC 原语 | 当前 AE 用法 | v1 用法 |
|---|---|---|
| Skill 目录发现 | 24 个 `/ae:*` 命令 | 继续作为稳定入口；内部变薄 |
| `Agent` | 专业 subagent | Worker/fresh evaluator；v1 正确性硬依赖 |
| Agent Teams | 并行、debate、消息、任务面板 | 只服务真正协作；不作为完成真值 |
| `SendMessage` | TL/teammate/proxy 通信 | 临时协作，不承载最终 evidence |
| `Task*` | UI 阶段进度 | 继续做 UI；状态由 ledger 重放 |
| `AskUserQuestion` | setup、风险、manual 等 | contract approval/amendment/manual 的人类接口 |
| `ToolSearch` | 延迟工具与 capability probe | 继续探测；缺失能力进入显式状态 |
| Agent isolation/worktree | blind test、部分隔离 | fresh judge 与测试隔离；不自造 sandbox |
| Plugin hooks | SessionStart/SessionEnd | 可加 early contract-write guard；digest 才是 hard gate |
| MCP | Codex/Gemini/OpenAI-compatible seat | 按 proof/risk 提供 independent judge |
| Filesystem | `.ae/` 跨会话状态 | contract/lock/ledger/gate cache |
| Git | diff、commit、review scope | evidence 记录 HEAD，并结合 source-set manifest 绑定 dirty/untracked 工作树 |

当前 AE 自己的 CC 依赖表把 `Agent` 与 plugin agent namespace 列为 hard dependency，把 Teams、hooks、ToolSearch 等列为 silent-degrade/empirical（`docs/references/cc-plugin-contract.md:22-37`）。v1 应按这个真实边界设计，不在插件 prose 中虚构它无法施加的权限或 sandbox。

## 6. 当前 Agent 编排

### 角色与规模

Agents 分 review、research、workflow、engineering。`agent-teams/SKILL.md` 定义 HOW，`agent-selection/SKILL.md` 定义 WHO；两者共 1156 行。

协议包括：

- TL moderator；
- Round 1 isolation；
- lateral communication；
- dynamic composition；
- debate/discussion/investigation modes；
- Doodlestein 四角色；
- Cast/selection trace；
- Task panel lifecycle；
- proxy relay、timeout、receipt、shutdown。

这些机制中，以下是 v1 load-bearing：

- fresh-context/independent judgment；
- backend unavailable 不得替代；
- required receipt/correlator；
- timeout 与 fail-closed/fail-open 边界；
- TL 与 worker/judge 职责分离；
- 会话结束时清理。

以下只是策略或可观测性：

- 固定队伍人数；
- 每个阶段都加入 cross-family；
- 详细 Cast 样板；
- 每个 role slot 的完整 selection trace；
- Task 面板状态；
- 不服务具体 proof obligation 的 Doodlestein round。

v1 的简化必须按这个分界做，而不是按文件整删。

## 7. Cross-family 当前形态

### Codex

插件清单直接运行：

```text
codex mcp-server
```

Claude proxy agent 调 MCP，记录 thread ID 与 effort receipt。Codex 是 Claude Code 内的独立 review seat，不是 AE runtime。

### Gemini / OpenAI-compatible

AE 自有 Node MCP bridge；`dist/index.mjs` 提交入仓，安装时不 build。Generic bridge 把 family、host、endpoint/model 分开。

### 已知边界

- Cross-family provenance filtering 尚未在所有 aggregation surface 闭合；
- Gemini 没有等价的 backend-correlated receipt；
- proxy relay 可能丢失 hedge 或增加结构化判断；
- backend 不可用时“有一个 Agent 文件”不等于独立意见真实到达；
- v1 不重写 transport，只把这些能力状态纳入 evidence contract。

## 8. 当前恢复与并发假设

### 恢复

- Work 每步 fresh read plan/conclusion/framing，抵抗 context compaction；
- loop iteration 从 `notes.md` 重读；
- step summary 落盘；
- MCP session 只保存在进程内 Map，重启即丢。

v1 应保留“磁盘状态优先”，并将 loop 真值从 notes/free prose 提升为 event ledger。

### 并发

当前多处假设单写者：

- 同一 plan/step 不支持并发 `/ae:work`；
- staging 文件会竞争；
- BL allocator 无全局锁；
- Agent 名是消息地址，团队 teardown 不完整会冲突；
- MCP session reply 并非事务性。

v1 继续明确“一 feature 一 active writer”。不为未观察到的 same-feature 并发构建 scheduler；event writer 只需防止崩溃和意外重复，不承诺多 writer 并发语义。

## 9. 测试能力的真实含义

标准 runner 主要覆盖：

- skill frontmatter；
- corpus wiring；
- shell/Python helper 的 fixture 行为；
- prompt 文本约定的静态检查；
- 部分本地 MCP contract。

它不自动覆盖：

- 完整 Claude Code skill→Agent→judge→gate 行为；
- 所有 prompt/assertion 的 Layer 2；
- model relay fidelity；
- 真实 backend availability；
- context compaction 后的全流程恢复；
- false-pass mutation；
- CI（仓库当前没有 CI 配置）。

因此 v1 不把“现有 suite 绿”当成中心证据；它只作为回归底线。发布依据必须增加真实 CC 行为测试和 AE-on-AE dogfood。

## 10. 从当前对象到 v1 对象

| 当前 | v1 | 处理 |
|---|---|---|
| Plan 中的 AC | `contract.draft.json` → `contracts/rev-NNNN.json` | 迁出，plan 只引用 AC ID；锁定 revision 不覆盖 |
| `goal.frozen.md` | current pointer + immutable revision + digest/attestation | migrate-on-touch；历史保留 |
| Plan `verify_by` 六类 | proof `command/artifact/human` | unit/e2e 等降为 command scope 标签 |
| `notes.md` loop/waiver/unverified | `run/events.jsonl` | 结构化追加事件；notes 仅保留人类执行笔记 |
| Evidence JSON 当前快照 | append-only attempt events | 旧失败不覆盖 |
| `review.md verdict` | 人类可读投影 | Gate 从 ledger 派生，不以 prose 为真值 |
| Work prompt gate | `ae-gate evaluate` + work policy | gate 只归约 proof/eligibility；skill 选择 retry/ask/amend/stop |
| Review archive side effects | `ae-gate finalize` | 唯一、幂等终态入口 |
| Task panel | UI cache | 不影响完成 |
| Agent Teams gate | 协作策略 | 纯 command 路径可串行退化 |
| Cross-family report | independent judge event | 按 contract/risk 请求，缺失显式化 |
| Knowledge graph gate | 非阻塞 post-completion | v1 不扩建 |

## 11. 最直接的修改面

### 核心行为

- `plugins/ae/skills/discuss/SKILL.md`
- `plugins/ae/skills/plan/SKILL.md`
- `plugins/ae/skills/plan-review/SKILL.md`
- `plugins/ae/skills/work/SKILL.md`
- `plugins/ae/skills/review/SKILL.md`

### 跨 skill 协议

- `plugins/ae/skills/agent-teams/SKILL.md`
- `plugins/ae/skills/agent-selection/SKILL.md`
- `plugins/ae/agents/workflow/challenger.md`
- 必要的 review agents

### 确定性机制

- 新增 `plugins/ae/scripts/ae-gate.py`
- 兼容/收缩 `check-harness.sh`
- 兼容/收缩 `collect-ac-evidence.py`
- 兼容/最终合并 `parse-review-verdict.sh`
- 兼容/最终合并 `loop-decide.sh`

### 配置、hook、测试

- `plugins/ae/templates/pipeline.template.yml`
- `plugins/ae/.claude-plugin/plugin.json`（可选 write guard）
- `plugins/ae/tests/scripts/`
- `plugins/ae/tests/fixtures/proof-loop/`
- `plugins/ae/tests/prompts/` 与 assertions（真实 CC 接缝）

### 不应直接编辑

`plugins/ae/bin/` 中是到 scripts 的符号链接；修改 canonical `plugins/ae/scripts/`。MCP `src` 若因 required evidence contract 必须修改，需要同步重建已提交的 `dist/index.mjs`。

## 12. 代码事实导出的 v1 判断

1. v1 不需要新的 orchestrator；CC 已经提供执行与 Agent runtime。
2. v1 需要一个确定性真值核，因为当前关键状态被多个 LLM skill 分散维护。
3. v1 不应依赖 Agent Teams 才能判定 command-only 工作完成；Teams 是并发/协作能力。
4. v1 必须把 contract 与 plan 分开，并给 frozen 状态真实 digest。
5. v1 必须把 evidence 从“最新报告”变成“全部 attempt 的追加历史”。
6. v1 必须把 finalize 从 review 长文中抽成唯一、幂等路径。
7. v1 必须以行为和故障注入验收，而不是继续增加 prose-shape 测试。
8. v1 不应提前提炼跨 runtime API；在 CC 上证明有效之后，v2 再从真实压力中抽象。
