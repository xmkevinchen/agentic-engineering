---
id: "01"
title: "流程完整性验证 — 怎么知道 TL 真的按流程走了"
status: pending
created: 2026-03-29
decision: ""
rationale: ""
reversibility: ""
---

# Topic: 流程完整性验证

## Context

`/ae:discuss` 的 SKILL.md 定义了完整流程：research → 创建 topics → 逐个讨论 → self-check（rationale + reversibility + evidence）→ Doodlestein challenge → generate conclusion。

但 SKILL.md 是**提示词**，不是代码。TL 可以：
- 跳过 Doodlestein（"时间不够了"）
- 写 rationale 但内容空洞（"综合考虑选 A"）
- 不做 self-check
- 编造 evidence

内部 AE 实战：约 30% 的 discussion 缺少有效的 Doodlestein review，约 50% 的 rationale 不够 specific。

## Options

### A: 结构化 Conclusion 验证（下游卡上游）

conclusion.md 必须包含指定 section，下游 skill 验证完整性：

```
/ae:plan 读 conclusion.md 时检查：
- ✅ ## Decision Summary 存在且非空
- ✅ 每行有 Decision + Rationale 列（非空）
- ✅ ## Doodlestein Review 存在且包含至少 1 个挑战 + 用户回应
- ✅ 高 reversibility 决策有额外 evidence
- ❌ 缺任何一项 → 拒绝执行，提示补充
```

- **Pros**: 零成本（纯 SKILL.md 改动）；利用下游天然依赖做验证；不需要 TL 配合
- **Cons**: 只验证结构不验证质量（TL 可以写一句话应付）；下游拒绝执行可能让用户烦

### B: 独立 Audit Agent

在 `/ae:discuss` 结束后、conclusion 生成后，自动 spawn 一个 audit agent：
- 读 conclusion + 所有 topic files
- 检查：每个决策的 rationale 是否引用了具体分析？reversibility 是否合理？Doodlestein 挑战是否被认真回应？
- 产出 audit report，附在 conclusion 里

- **Pros**: 独立于 TL；检查质量不只是结构；可以发现 "表面合规实质空洞"
- **Cons**: 额外 token 成本；audit agent 本身也是 Claude，可能有同样的 bias

### C: Cross-family Audit

audit agent 不用 Claude，而是用 Codex + Gemini 做。不同 model family 的 bias 不同，更可能发现 Claude TL 的盲点。

- **Pros**: 真正独立的视角；与 ae 的 cross-family 哲学一致
- **Cons**: 依赖 cross-family 可用性；Codex/Gemini 对项目上下文了解有限

### D: 人工 Review Gate

不自动验证，而是在 conclusion 生成后要求用户（人类）显式 approve。用户是最终的质量把关者。

- **Pros**: 最可靠；人类理解上下文
- **Cons**: 用户可能也"快速 approve"；增加人工负担；和自动化目标矛盾

## Recommendation

待讨论。这个问题本身就是 convergence 的核心，不应该草率推荐。
