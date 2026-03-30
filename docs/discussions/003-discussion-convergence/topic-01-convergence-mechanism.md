---
id: "01"
title: "讨论收敛机制 — 评分、落盘、嵌套工作流"
status: resolved
created: 2026-03-29
decision: "Option B — 分阶段实现"
rationale: "三态 + Sweep 是核心收敛机制，必须先解决才能做嵌套并行。基于 Meta 内部 AE 的实战设计。"
reversibility: "low"
---

# Topic: 讨论收敛的完整机制

## Context

Meta 内部 AE 实战的两个高频问题：
1. 没有真的 converged 但讨论停止了（最常见）
2. TL 偷懒跳过（像到点下班一样自然）

内部版本的设计思路：
- 每个讨论点有评分系统
- deferred 不等于不讨论，是稍后讨论
- 讨论结束前所有 deferred 必须 resolve 或解释为什么无解
- 无法操作的必须转化为新的可操作单元（新 discussion/topic/feature）
- 讨论可以多轮，不限于固定轮次

进一步构想：nestable workflow — divide and conquer，讨论可以递归拆分并行，每次讨论的结果要么可以 plan，要么形成新讨论点进入下一循环。

## 设计

### 1. Topic 三态评分

每个 topic 讨论后，评分为以下之一：

| 状态 | 含义 | 下一步 |
|------|------|--------|
| `converged` | 有明确方案，可以 plan | 记录决策，进入 conclusion |
| `revisit` | 当前讨论不够充分，需要更多信息或视角 | 标记缺什么，稍后再议 |
| `deferred` | 当前可以后置，但必须在流程结束前处理 | 推迟，但不遗忘 |

**没有 irresolvable** — 不存在 "无解就不管了" 的逃逸口。

### 2. 讨论流程（多轮，可嵌套）

```
Round 1: 逐个 topic 讨论
  → 每个 topic 评分: converged / revisit / deferred

Round 2: 处理 revisit topics
  → 补充信息或换角度重新讨论
  → 重新评分

Round N: 继续直到没有 revisit
  → 不限轮次，直到所有 topic 是 converged 或 deferred

Sweep: 处理所有 deferred
  → 每个 deferred 必须达到以下之一：
    a) converged — 有答案了
    b) 转化为新 discussion — 问题需要独立讨论，spawn 子 discussion
    c) 转化为新 feature/backlog — 不是讨论问题，是执行问题
    d) 告知用户为什么无法解决 + 给出建议 — 不是静默跳过

Sweep 后不允许存在 deferred — 全部必须落盘。
```

### 3. 落盘规则：所有讨论结果必须可操作

讨论的每个输出只有两种去向：

```
讨论结果
  ├→ Plannable（可执行）→ /ae:plan
  └→ New discussion（需要更多讨论）→ spawn 子 discussion → 下一循环
```

没有第三种。不存在 "记录了但不做任何事" 的状态。

具体落盘路径：

| 情况 | 落盘到 | 格式 |
|------|--------|------|
| 方案明确，可以执行 | conclusion.md → `/ae:plan` | Decision + Rationale + Evidence |
| 问题需要独立讨论 | 新 discussion 目录 | index.md 引用父 discussion |
| 是执行问题不是设计问题 | backlog（`output.backlog`） | `BL-NNN-slug.md` |
| 需要外部信息才能决定 | 新 discussion + 阻塞条件 | `revisit_trigger` 说明需要什么信息 |

### 4. Nestable Workflow（嵌套讨论）

讨论可以递归拆分：

```
Discussion 003: API 设计
  ├ Topic 1: REST vs GraphQL → converged (GraphQL)
  ├ Topic 2: 认证方案 → deferred
  │   Sweep → 问题太大，spawn 子 discussion:
  │   └ Discussion 003a: 认证机制详细设计
  │       ├ Topic 1: JWT vs Session → converged
  │       ├ Topic 2: Token 刷新策略 → converged
  │       └ Conclusion → plannable ✅
  ├ Topic 3: 缓存策略 → converged (Redis)
  └ Conclusion:
      Topic 1 + 3 → plannable ✅
      Topic 2 → 引用 Discussion 003a 的 conclusion
```

**并行可能性**：子 discussion 之间如果没有依赖，可以用 Agent Teams 并行讨论。每个子 discussion 是独立的 team，各自收敛后汇总。

```
TeamCreate(team_name: "003-parallel-discussions")

Agent(name: "003a-auth", prompt: "执行 Discussion 003a...")
Agent(name: "003b-caching", prompt: "执行 Discussion 003b...")

→ 各自独立收敛
→ 汇总结果到父 discussion
```

### 5. 收敛信号（给理性 TL 的工具）

每轮讨论后输出收敛状态：

```
📊 Discussion 003 收敛状态 (Round 2):
- Topics: 5 total
  - converged: 3 ✅
  - revisit: 1 🔄 (Topic 4: 缺性能测试数据)
  - deferred: 1 ⏳ (Topic 2: 认证方案)
- Rounds completed: 2
- Next: 处理 Topic 4 (revisit)，然后 Sweep deferred
```

### 6. 执行保障

**理性 TL**：
- 收敛信号让 TL 知道 "还没完"
- Sweep 机制防止 deferred 被遗忘
- 三态评分给 TL 正确的分类工具（不用硬塞 converged）

**非理性 TL**：
- Process Metadata 自动嵌入 conclusion（不可编辑）：
  ```
  ## Process Metadata
  - Rounds: 3
  - Converged: 4/5
  - Deferred resolved: 1 (→ Discussion 003a)
  - Revisit cycles: 2
  - Doodlestein: executed (cross-family)
  ```
- 下游验证：`/ae:plan` 读 conclusion 时检查
  - 有 deferred 未落盘？→ 拒绝
  - Process Metadata 缺失？→ 警告
- Outcome 数据：`/ae:review` 的返工率反映上游讨论质量

**已知限制**：
- TL God Mode 不可改变，metadata 可以让偷懒可见但不能阻止
- 用户催促时 TL 仍会服从用户
- 嵌套讨论的深度需要合理限制（建议最多 2 层）

## Options

### A: 完整实现（三态 + Sweep + 嵌套 + 并行）

实现上述全部设计。改动范围：
- `/ae:discuss` SKILL.md — 大幅重写（评分、多轮、Sweep、嵌套）
- conclusion.md 模板 — 三区（Resolved / Spawned Discussions / Process Metadata）
- `/ae:plan` SKILL.md — 下游验证逻辑
- index.md 模板 — 支持子 discussion 引用

**Pros**: 完整解决收敛问题；与内部版本对齐
**Cons**: 改动量大；嵌套 + 并行的 Agent Teams 交互复杂

### B: 分阶段实现

**Phase 1**（立即）：三态评分 + Sweep + 落盘规则 + Process Metadata
**Phase 2**（验证 Phase 1 后）：嵌套讨论 + 子 discussion spawn
**Phase 3**（验证嵌套后）：并行子讨论（Agent Teams）

**Pros**: 渐进验证；Phase 1 就有价值；风险可控
**Cons**: 完整收益要等 Phase 3

### C: 只做评分 + Sweep

不做嵌套和并行，只加三态评分和 Sweep 机制。deferred 转化为 "新 topic 加到当前 discussion" 而非 spawn 子 discussion。

**Pros**: 最小改动；解决最频繁的问题（没 converge 就停了）
**Cons**: 不支持 divide and conquer；大问题仍然卡在一个 discussion 里

## Recommendation

**Option B**。三态 + Sweep 是核心价值，立即可做。嵌套和并行是进阶能力，验证了基础后再加。
