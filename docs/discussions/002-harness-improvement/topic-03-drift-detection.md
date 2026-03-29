---
id: "03"
title: "Drift Detection — 执行中检测和拉回跑偏的 agent"
status: pending
created: 2026-03-29
decision: ""
rationale: ""
---

# Topic: Drift Detection

## Context

内部 AE 经验：agent 跑偏是最常见的问题之一。表现：
- 执行 step 3 时去改了 step 5 的东西（scope creep）
- 代码实现偏离了 plan 描述的方案
- 测试写对了但实现走了完全不同的路
- agent 陷入 fix loop（反复修同一个 bug，越改越糟）

当前 ae 的问题：**靠 review 事后发现**。`/ae:work` 里 QA agent 在 step 完成后才 review。如果 agent 在 step 执行过程中就跑偏了，要到 step 结束 + QA review 后才知道，浪费大量 context 和 token。

### 跑偏的类型

1. **Scope drift** — 改了不该改的文件，做了 plan 没要求的事
2. **Approach drift** — 用了和 plan 描述不同的技术方案
3. **Fix loop** — 反复修同一个问题，3+ 次 test fail 在同一点
4. **Hallucination drift** — 引用不存在的 API、创建不需要的文件

## Options

### A: Pre-step Contract + Post-step Verification

每个 step 开始前，从 plan 提取 "contract"：
```
Step 3 Contract:
- Files to touch: src/auth/middleware.ts, src/auth/types.ts
- Files NOT to touch: anything outside src/auth/
- Approach: add JWT refresh token rotation
- AC: AC3 (token rotation works)
- Max test-fix cycles: 3
```

执行后验证：
```
Post-step check:
- git diff --stat → 改了哪些文件？在 contract 范围内？
- 新增文件合理吗？（contract 没提到的新文件 = 可能 drift）
- test-fix 循环次数？超过 3 → 暂停
```

违反 contract → 暂停 + 通知用户，不是自动回滚。

- **Pros**: 明确的 "什么算跑偏"；基于 git diff 可客观验证；contract 从 plan 自动提取
- **Cons**: contract 可能过于严格（合理的小改动也触发）；需要 plan 足够详细

### B: Continuous Monitoring（执行中检测）

在 step 执行过程中，parallel 跑一个 monitor agent：

```
Agent(subagent_type: "qa", name: "drift-monitor",
      prompt: "Monitor step execution. Every 2 minutes:
               - Check git diff against step contract
               - If files outside scope changed → SendMessage to dev: 'scope drift detected'
               - If test-fix cycle > 3 → SendMessage to dev: 'fix loop detected'
               - Do NOT block, only alert")
```

- **Pros**: 实时检测，不等 step 结束；非阻塞（alert 不 block）
- **Cons**: 实现复杂（需要 parallel monitoring）；额外 token 成本；"每 2 分钟" 在 Claude Code 中不自然

### C: Commit-based Checkpoints

不在执行中监控，而是要求 agent 频繁 commit（每个 subtask 一次），每次 commit 时做 drift check：

```
Subtask done → git add → pre-commit drift check:
  - diff in scope?
  - approach matches plan?
  - no new unplanned files?
→ pass: commit
→ fail: warn user, don't block commit but flag in review
```

- **Pros**: 自然嵌入 TDD cycle（每个 red→green 就是一个 checkpoint）；不需要 parallel agent；粒度细
- **Cons**: 频繁 commit 可能产生噪音；squash 后丢失中间状态

### D: Fix Loop Circuit Breaker

只解决最痛的问题 — fix loop。不做全面 drift detection，只加一个 circuit breaker：

```
In /ae:work TDD cycle:
  Track: consecutive test failures on the same test
  If same test fails 3+ times:
    → STOP
    → Show: "Fix loop detected on [test name]. 3 attempts failed."
    → Options: "Retry with different approach" / "Skip and defer" / "Ask for help"
```

- **Pros**: 最小改动；解决最痛的问题（fix loop 是最大的 token 浪费）；明确的触发条件
- **Cons**: 不覆盖 scope drift 和 approach drift；只是 circuit breaker 不是 detection

### E: Plan-anchored Execution（从根本防止 drift）

改变 `/ae:work` 的执行模式：每个 step 开始时，强制 agent 先复述 plan 内容，然后明确 "我要做什么、不做什么"：

```
Step 3 开始:
Agent: "根据 plan，Step 3 要做：[复述]。
        我会改这些文件：[列表]。
        我不会碰：[列表]。
        AC 验证方法：[具体]。
        开始执行。"
```

这不是检测 drift，而是通过 **重新锚定** 来预防 drift。

- **Pros**: 预防 > 检测；强制 agent 理解 plan 而不是自由发挥；零额外基础设施（纯 prompt 改动）
- **Cons**: 增加每步的 prompt 开销；agent 可能 "复述了但没遵守"

## Recommendation

**D + E 先行，A 作为下一步**。

1. **E（Plan-anchored）**：每步开始前强制复述 plan contract — 纯 prompt 改动，预防 drift
2. **D（Circuit Breaker）**：fix loop 3 次触发熔断 — 解决最痛的 token 浪费问题
3. **A（Contract + Verification）**：在 E 和 D 验证后，加 post-step 的 git diff 验证

B 太复杂（实时监控），C 的频繁 commit 引入噪音，都归档。
