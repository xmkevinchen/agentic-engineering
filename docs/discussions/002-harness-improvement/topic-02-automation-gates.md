---
id: "02"
title: "自动化判定机制 — 什么条件下可以不等人"
status: pending
created: 2026-03-29
decision: ""
rationale: ""
---

# Topic: 自动化判定机制

## Context

ae 当前的人工参与点：

| 环节 | 暂停点 | 人做什么 |
|------|--------|---------|
| `/ae:plan` | Step 4 Confirm | 看完整 plan，确认或修改 |
| `/ae:work` | 每步完成后 | 确认继续下一步 |
| `/ae:work` | pre-commit | 看 disposition table，选 fix/defer/backlog |
| `/ae:discuss` | 每个 topic | 选 option |
| `/ae:review` | findings | 看 review 结果，确认 fixup |

内部 AE 经验：大部分人工参与是**确认性的**（"是的，继续"），真正需要人判断的是少数关键节点。但因为没有机制区分 "可以自动过" 和 "必须人看"，所以全部暂停。

### 核心问题

不是 "要不要自动化"，而是 "怎么判断什么时候可以自动化"。需要一套 gate 条件。

## Options

### A: Confidence-based Gates

每个暂停点定义 "自动通过" 的条件。满足条件 → 自动继续；不满足 → 暂停等人：

**`/ae:work` 步骤间**：
- 自动继续条件：tests green + code-review 无 P1 + diff 范围在 plan step 内
- 暂停条件：任何一项不满足

**`/ae:work` pre-commit disposition**：
- 自动处理：P3 全部 skip，P2 中 "style/naming" 类自动 skip
- 需要人：P1 任何、P2 中 "logic/security" 类

**`/ae:plan` confirm**：
- 自动通过条件：plan-review 结果全部 approved，无 must-fix
- 暂停条件：有 must-fix 项

- **Pros**: 精确控制；高风险一定有人看；低风险自动过
- **Cons**: gate 条件本身可能不完备（漏掉了某种情况）；需要逐步调优

### B: 分级自动化模式

用户在 `/ae:setup` 或命令参数中选择自动化级别：

```
level 0: 全手动（当前默认）
level 1: 低风险自动（tests green + no P1 → auto continue）
level 2: 高度自动（只在 P1 或 test fail 时暂停）
level 3: 全自动（Ralph 风格，只在全部完成或 max-iterations 时停）
```

用户根据任务性质选择：重构用 level 2，新功能用 level 0。

- **Pros**: 用户掌控；渐进式信任；不同任务不同级别
- **Cons**: 选错 level 的后果可能严重；需要用户理解每个 level 的含义

### C: 渐进信任（Earn Autonomy）

初始全手动。每次人确认 "继续" 后，系统记录当时的条件。多次相同条件下人都选了 "继续" → 下次自动通过。

```
记录：{ step_type: "refactor", tests: "green", p1: 0, p2: 1, user_action: "continue" }
同类条件累计 3 次 "continue" → 下次自动
```

- **Pros**: 基于实际行为学习；不需要预设规则；自然适配用户风格
- **Cons**: 冷启动问题（前 N 次全手动）；跨项目不迁移；实现复杂

### D: 暂不改，优化人工参与的效率

不减少暂停点，而是让每次暂停更快：
- 一键 "continue"（不需要看详情）
- 默认 disposition（P3 auto-skip，只展示 P1/P2）
- 批量确认（"接下来 3 步都自动执行？"）

- **Pros**: 最小改动；不引入自动化风险；用户体验改善
- **Cons**: 根本问题没解决；overnight 运行仍不可能

## Recommendation

**A 先行，B 作为 UX 封装**。先定义每个暂停点的 auto-pass 条件（A），然后用 level 参数（B）让用户选择启用哪些 auto-pass。D 的 "优化手动效率" 可以同时做，不冲突。C 太复杂，归档。
