---
id: "004"
title: "动态 Agent 选择 — 团队讨论报告"
created: 2026-03-30
status: complete
participants: [lead, challenger, simplicity-reviewer, gemini-proxy]
---

# 团队报告：动态 Agent 选择

## 参与者

- **lead**（本报告作者）：综合分析与最终建议
- **challenger**：结构化挑战，质疑核心假设
- **simplicity-reviewer**：简洁性视角，最小可行方案
- **gemini-proxy**：Gemini (gemini-2.5-flash) 外部视角

注：codex-proxy 未提交反馈，报告基于已收到的三方意见。

---

## Topic 01：Agent 选择机制

### 问题陈述

当前 `/ae:review` 永远启动 security + performance + architecture 三个 reviewer，无论任务是 iOS UI 改动还是数据库迁移。`/ae:team` 的 8 类查表粒度同样粗糙。

### 各方观点

**simplicity-reviewer**：最小可行方案是选项 A——把 SKILL.md 里的硬编码列表改为指令，让 TL 根据 context 选 2-4 个并说明理由。加上数量约束（"超过4个需解释为什么全部必要"）可防止 TL 偷懒全选。零基础设施改动。

**challenger**：挑战了核心假设。提出了一个更激进的替代方案：**不做动态选择，而是在每个 agent 中加 `skip_if` 指令**，让 agent 自己判断是否相关，不相关就返回空。这样覆盖面不降低，token 节省来自 agent 自过滤，完全不需要选择阶段。challenger 还明确排除了选项 B（agent 自荐），理由是 LLM 存在确认偏误，自评相关度不可靠。

**gemini-proxy**：推荐混合方案，比 Option D 更结构化：先结构化分析任务 → 标签匹配过滤候选池 → LLM orchestrator 二次筛选。关键观点：纯 LLM 选择是单点故障，agent 自荐可靠性最低，混合方案在生产环境最适合。

**lead（综合）**：

Challenger 的 "skip 指令" 提案有重要价值，但解决的是不同问题：
- **"agent 自过滤"解决的是**：不相关 agent 不浪费 token（量的问题）
- **"动态选择解决的是"**：让真正擅长此任务的 agent 参与，而不是让通用 reviewer 自我判断是否跳过（质的问题）

这两个方案并不互斥，但首先应该明确解决的是哪个问题。

### 建议方案

**分两步走，先易后难：**

**第一步（立即可行）**：在 agent 定义中加 skip 指令（challenger 方案）
- 每个 reviewer 加一句：如果当前任务与你的专业领域完全无关，发送一行"不适用，跳过"给 challenger 即可
- 零改动，立即上线，解决 token 浪费问题
- 这是最小成本、最高确定性的改进

**第二步（后续迭代）**：在 `/ae:team`（非 `/ae:review`）中实现 context-aware 选择
- `/ae:review` 保持宽泛团队（让 agent 自过滤），因为 review 场景需要覆盖面保证
- `/ae:team`（ad-hoc）场景才真正需要动态选择，因为任务类型差异极大
- 实现方式：选项 A（TL 读描述选择）+ 选择必须输出理由
- 明确排除选项 B（自荐）和纯标签方案（C）

**理由**：简洁性优先，覆盖面是 review 场景的根本约束，不能为了省 token 而降低覆盖率风险。

---

## Topic 02：Cross-family 角色化

### 问题陈述

当前 codex-proxy 和 gemini-proxy 每次都收到通用 "review this" prompt，两个 proxy 的贡献几乎相同，cross-family 的差异化价值没有体现。

### 各方观点

**simplicity-reviewer**：可以用纯 SKILL.md 改动解决。在调用 cross-family agents 的地方加 4-5 行角色参考示例（按任务类型分类），让 TL 以此为框架自由构造 prompt，不需要维护独立模板库。

**challenger**：质疑了基础假设——"Codex 擅长 X，Gemini 擅长 Y"缺乏实证基础。Cross-family 的真正价值是**独立性**（不同训练数据、不同偏见），而不是领域专长。专业化 prompt 的效果来自 prompt 质量，不来自模型天然专长——给 Claude 同样的专业化 prompt 会有相同效果。

**gemini-proxy**：明确支持角色化。专业化 prompt 能降低幻觉率、提升输出质量，通用 prompt 导致冗长失焦的回应。但同时确认了模型间有一定差异：Claude 擅长长上下文批判性分析，Codex 擅长代码生成重构，Gemini 擅长多模态和特定领域。

**lead（综合）**：

Challenger 的质疑和 Gemini 的确认并不完全矛盾：
- **Gemini 说的是**：专业化 prompt 比通用 prompt 好（这是对的）
- **Challenger 说的是**：专业化是 prompt 的属性，不是模型的属性（这也是对的）
- **真正的问题是**：我们是否需要为 codex/gemini 定制**与 Claude 不同的**专业化角色

如果 cross-family 的价值是独立性（不同视角），那么合理做法是：
- 给两个 proxy 相同的专业化 prompt（专注同一个关注点）
- 但独立分析，期待它们给出不同的答案

而不是：
- 给 codex-proxy 和 gemini-proxy 不同的专业化角色（这是基于模型专长假设，该假设存疑）

### 建议方案

**接受 challenger 的核心修正，但保留角色化的实用价值：**

**实现方式（选项 B 精简版）**：
- 在 SKILL.md 中加指令：调用 cross-family proxy 时，构造专业化 prompt，而不是通用 "review this"
- codex-proxy 和 gemini-proxy 收到相同的专业化聚焦点（不基于模型专长假设分配不同角色）
- 在 SKILL.md 里内嵌 4-5 行参考框架（simplicity-reviewer 的方案）

**放弃选项 C**（agent 声明 cross_family_roles）：
- 26 个角色描述维护成本高
- 基础假设（模型有稳定的领域专长）不可靠

**核心原则调整**：Cross-family 的价值定位从"利用各模型专长"改为"获取独立视角"。两个 proxy 得到相同的专业化问题，但我们期待它们给出不同的视角——这才是 cross-family 的真正价值。

---

## 跨 Topic 交互

Challenger 指出两个 topic 联合决策的重要性：如果 Topic 01 动态选 agents + Topic 02 动态构造 cross-family 角色，TL 每次需要做 4-6 个独立判断，认知负担是乘法关系。

本报告的建议已考虑这一约束：
- Topic 01 在 `/ae:review` 中保持硬编码（减少 TL 认知负担），只在 `/ae:team` 中实现动态选择
- Topic 02 用内嵌参考框架减少 TL 从零构造 prompt 的负担

两个改动都落在 SKILL.md 层面，不新增基础设施，符合 simplicity-reviewer 的最小改动原则。

---

## 行动建议

### 立即可行（低风险）

1. **在 reviewer agents 中加 skip 指令**：如果任务与专业领域无关，发送"不适用"给 challenger
2. **在 `/ae:review` 和 `/ae:team` 的 cross-family 调用处**，将通用 prompt 改为专业化 prompt 指令 + 内嵌参考框架

### 后续迭代（需要更多验证）

3. **`/ae:team` 的 context-aware 选择**：选项 A（TL 读描述选择），限定最多 4 个 agents，必须输出选择理由
4. **观测数据积累**：通过 outcome statistics 验证 agent 自过滤是否足够，再决定是否需要步骤 3

### 明确放弃

- 选项 B（Agent 自荐广播）：token 成本高 + 自评不可靠
- 选项 C（tag 体系）：维护负担 > 收益
- 选项 C of Topic 02（cross_family_roles 字段）：26 个维护点不值得

---

## 关键认知更新

本次讨论中最有价值的不同意见（来自 challenger）：

> **Cross-family 的价值是独立性，不是专长。**

这个修正影响深远：它意味着我们不应该试图根据"Codex 擅长什么"来分配角色，而是应该给两个 proxy 同样的专业化问题，然后看它们给出什么不同的答案。这才是 cross-family 能提供的真正价值：相同问题的不同视角，而不是不同问题的专家意见。
