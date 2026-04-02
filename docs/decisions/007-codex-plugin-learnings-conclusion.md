---
id: "007"
title: "Codex Plugin Learnings — Cross-family Prompt Infrastructure — Conclusion"
concluded: 2026-03-31
plan: "docs/plans/006-cross-family-prompt-infrastructure.md"
---

# Codex Plugin Learnings — Conclusion

## Decision Summary (Converged)

| # | Topic | Decision | Rationale | Reversibility |
|---|-------|----------|-----------|---------------|
| 1 | Cross-family Prompting Skill | B — 强化 proxy agent 定义 | Agent 定义是 system prompt，直接生效。独立 skill 需要运行时加载机制（不存在）。 | high |
| 2 | 结构化输出约束 | B — Markdown + verification 指令 | MCP proxy 是文本通道（`gemini/src/index.ts:97` 无 `outputSchema`），JSON Schema 增加 parse failure mode。 | high |
| 3 | Adversarial Review 强化 | A — 加入 challenger.md，分场景标注 | challenger 已有 Claim/Evidence/Objection/Confidence 骨架（`challenger.md:104-119`），直接扩充。attack surface 按 `[CODE REVIEW]` vs `[DESIGN DISCUSSION]` 标注。calibration rules 不用机械的跨家族一致+2规则。 | high |
| 4 | Result Handling 规范 | B — 加入 proxy agent 定义 | Topic 1 决定不做独立 skill，规则内联到 proxy 定义。5 条规则：保持原始结构、保持 inference/fact 区分、不二次加工、no auto-fix（代码片段可以/执行指令不行）、失败时不替代。 | high |
| 5 | 命令级工具权限控制 | 维持现状 + 显式注释 | Doodlestein 修正：reviewer agent 已无 Write/Edit（`code-reviewer.md:4` 等），"精准收紧"找不到收紧对象。加注释 `# Write/Edit intentionally excluded — review only` 使隐式约束显式化。 | high |

## Doodlestein Review

### Q1: Smartest Alternative — 统一方案
- Codex 提议 `AGENT_CONTRACT.md` 横切约束文件；Gemini 提议 MCP server middleware
- **判定**：T1/T2/T4 改动都落在 `codex-proxy.md` + `gemini-proxy.md` 两个文件，执行时作为一次 PR 协调即可。AGENT_CONTRACT 和 MCP middleware 是未来演进方向，不是当前替代。
- **行动**：记录为未来方向，不重开。

### Q2: Problem Validity — 伪问题
- **三方一致**：T5 解决的是不存在的问题。所有 reviewer agent 物理上已无 Write/Edit。
- **行动**：**重开 T5**，决策从 "A 精简版" 改为 "维持现状 + 显式注释"。用户接受。

### Q3: Regret Prediction — 最可能被推翻
- Codex：T2（Gemini SDK 未来支持 JSON output）→ Challenger 反驳：只是换 failure mode，核心决策不变
- Gemini：T3（challenger.md 膨胀）→ Challenger 反驳：增量约 30-40 行，在合理范围
- Challenger：T4（no auto-fix 边界模糊）→ 已通过 Doodlestein 澄清边界
- **行动**：T4 边界已澄清（代码片段可以/执行指令不行），降低推翻风险。

## Process Metadata
- Rounds: T1: 1轮, T2: 1轮, T3: 1轮, T4: 1轮, T5: 2轮
- Topics: 5 total (5 converged, 0 spawned, 0 explained)
- Deferred resolved in Sweep: 0
- Revisit cycles: 1 (T5)
- Doodlestein: executed (cross-family: yes — Codex + Gemini + Challenger)
- Doodlestein modifications: T5 决策修改, T4 边界澄清

## 跨 Topic 执行依赖

T1/T2/T4 共享载体（`codex-proxy.md` + `gemini-proxy.md`），应作为一次修改协调：
1. **codex-proxy.md + gemini-proxy.md** — 输出格式强化(T2) + result handling 规则(T4)，与 T1 的 proxy 定义强化合并
2. **challenger.md** — attack surface + calibration rules (T3)
3. **reviewer agent 定义** — 加注释 (T5)

## Next Steps
→ `/ae:plan` for converged decisions — 3 个执行单元（proxy 定义 / challenger 定义 / reviewer 注释）
