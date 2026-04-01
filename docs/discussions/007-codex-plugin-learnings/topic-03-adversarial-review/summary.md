---
id: "03"
title: "Adversarial Review 模式强化"
status: converged
current_round: 1
created: 2026-03-31
decision: "A — 直接加入 challenger.md，attack surface 分场景标注"
rationale: "challenger 已有 Claim/Evidence/Objection/Confidence 骨架（challenger.md:104-119），直接扩充最简单。attack surface 按 [CODE REVIEW] vs [DESIGN DISCUSSION] 分场景标注，不靠 challenger 自行判断。calibration rules 不用机械的跨家族一致+2规则。"
reversibility: "high"
---

# Topic: Adversarial Review 模式强化

## Current Status
已收敛：A — 直接加入 challenger.md。三方一致（Codex/Gemini/Challenger）。

## Round History
| Round | Score | Key Outcome |
|-------|-------|-------------|
| 1 | converged | 三方一致选 A。Challenger 补充：attack surface 分场景标注，calibration rules 不用机械+2规则 |

## Context
codex-plugin-cc 的 `adversarial-review.md` prompt 有几个我们没有的设计模式：

1. **`<operating_stance>`**：明确的认知立场 — "Default to skepticism. Assume the change can fail until evidence says otherwise."
2. **`<attack_surface>`**：7 类具体攻击面清单（auth/permissions, data loss, rollback safety, race conditions, empty-state, version skew, observability gaps）
3. **`<finding_bar>`**：每个 finding 必须回答 4 个问题（what can go wrong / why vulnerable / impact / fix）
4. **`<calibration_rules>`**：质量 > 数量 — "Prefer one strong finding over several weak ones. Do not dilute serious issues with filler."
5. **`<grounding_rules>`**：所有 claim 必须基于代码证据，不能臆测

我们的 challenger 有 Claim/Evidence/Objection/Confidence 格式，有 Disagreement Value Assessment，但缺少 attack surface 清单和 calibration rules。

## Options

### A: 把 adversarial 模式加入 challenger agent 定义
- 在 challenger.md 中加入 `<attack_surface>` 清单和 `<calibration_rules>`
- 保持现有 Claim/Evidence/Objection/Confidence 格式，补充 attack surface 作为检查维度
- **Pros**: 直接提升 challenger 质量；低成本修改
- **Cons**: challenger.md 可能变太长；attack surface 太代码化，challenger 也用于设计讨论（不只是代码 review）

### B: 分离 adversarial-review 为独立 agent 或 prompt 模式
- challenger 保持通用，但 /ae:review 和 /ae:code-review 在调用 challenger 时注入 adversarial 上下文
- attack surface 和 calibration rules 放在调用方的 prompt 里，不是 challenger 本身
- **Pros**: challenger 保持通用性；不同场景注入不同 attack surface
- **Cons**: 每个 skill 都需要记得注入；可能不一致

### C: 创建 `adversarial-review` 内部 prompt 模板
- 类似 Topic 1 的 prompting skill，提供一个 adversarial review 模板
- skill 或 TL 在需要时引用模板组装 challenger prompt
- **Pros**: 可复用；与 Topic 1 的 prompting skill 天然整合
- **Cons**: 额外的间接层

## Recommendation
倾向 A — 直接加到 challenger 里最简单有效。attack surface 可以标注"代码 review 时使用"，设计讨论时 challenger 自然忽略不适用的维度。calibration rules 是通用的（任何场景都应该 "prefer one strong finding over several weak ones"）。
