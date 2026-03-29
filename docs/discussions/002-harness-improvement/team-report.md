---
title: "Agent Harness 改进 — 团队综合报告"
discussion: "002-harness-improvement"
created: 2026-03-29
status: partial
sources_received:
  - architect
  - simplicity-reviewer
sources_pending:
  - challenger
  - codex-proxy
  - gemini-proxy
---

# Agent Harness 改进 — 团队综合报告

## 来源说明

本报告整合了以下已收到的视角：

1. **architect**：基于全部 topic 文件 + `/ae:work`、`/ae:discuss`、`/ae:setup` SKILL.md 的独立分析
2. **simplicity-reviewer**：过度设计审查报告（YAGNI 立场）

尚未收到：**challenger**、**codex-proxy**、**gemini-proxy** 的反馈。如后续收到，将更新本文件。

---

## Topic 01：上下文预算管理

### 最终推荐：只做 Option B（Token Budget 指令）

在各 skill 的 research 步骤加 budget 约束，纯 SKILL.md 文本改动：

> "读取不超过 N 个文件，总结在 500 token 以内后继续。"

- Option A（Activity Log）、Option C（两阶段 Research）归档——等 context 膨胀导致实际失败的案例再实施
- Option D（Context Checkpoint）排除——Claude Code 无原生 context 清空 API，不现实

### 关键分歧

| 来源 | 立场 |
|------|------|
| architect（原始） | A+B+C 组合；`/ae:discuss` 已用 Explore agent，应统一到其他 skill；预防性建基础设施 |
| simplicity-reviewer | 没有观察到的失败案例，A/C 是 YAGNI，B 已够用 |
| **采纳** | simplicity-reviewer 立场 |

### 开放问题

- Token budget 数字（N 个文件 / 500 token）是否适合所有 skill？`/ae:plan` 的 research 需求可能远大于 `/ae:work`。建议各 skill 设不同 budget，而非统一数字。
- Activity Log（Option A）的触发条件如何定义？建议：单次 skill 执行超过 20 个文件读取，或 session 长度超过 2 小时，作为观察指标。

---

## Topic 02：自动迭代模式

### 最终推荐：整个 topic 归入"unproven"归档，暂不实施

- 用户已可通过 prompt 说"继续执行不要问我"实现零成本非正式 auto 模式
- `/ae:work` 的暂停机制是有意安全设计，不是 bug
- **触发条件**：有用户反馈"因缺少 overnight 运行能力而受阻"时再议

### 关键分歧

| 来源 | 立场 |
|------|------|
| architect（原始） | Option A（`--auto` flag）先行；overnight 运行是 ae 进阶必要条件；建议 plan 步骤级标注 `auto: true/false` |
| simplicity-reviewer | "overnight 运行需求"是未验证假设；`--auto` 实现复杂度被低估（需要 max-steps、max-time、失败处理循环）；`/ae:work` 暂停是有意安全设计 |
| **采纳** | simplicity-reviewer 立场 |

### 开放问题

- 如果用户真的反映 overnight 运行需求，哪个方案最合适？architect 认为 Option A（step 级 `auto` 标注）比 Ralph 集成（Option B）更轻量，应优先于 Option B/C。
- `--auto` 模式下 code-review 的自动化边界在哪里？fix-now 自动修复可接受，但 re-review 循环应有上限（建议最多 3 轮，超出暂停）。

---

## Topic 03：讨论收敛与 Doodlestein 挑战

### 最终推荐：只做 devil's advocate prompt 改动

在 `/ae:discuss` SKILL.md 的"Generate Conclusion"阶段前加入：

> "在生成 conclusion 之前，以批评者角色审视所有决定，提出 3 个最重要的质疑。用户回应后，再生成 conclusion。"

- 不做：Option B 量化字段（`confidence` 是伪精确，流于形式）、Option C cross-family 多 agent 协调（对项目上下文了解不足，协调开销不值得）
- **可选折中（architect 保留意见）**：只加 `reversibility` 字段（高/中/低，纯分类，无伪精确），不加 `confidence` 数值——强制思考最坏情况，不引入虚假精度

### 关键分歧

| 来源 | 立场 |
|------|------|
| architect（原始） | B（量化字段）应先于 A 实施；`risk` 和 `reversibility` 字段有价值（强制最坏情况思考）；Doodlestein 结果应记录进 conclusion.md 成为可审计历史 |
| simplicity-reviewer | 单一 devil's advocate prompt 效果等同于 challenger agent + 新字段，成本为零；`confidence: 0.8` 是伪精确；B/C 全部 YAGNI |
| **采纳** | simplicity-reviewer 立场为主；architect 的 `reversibility` 字段作为可选保留 |

### 开放问题

1. devil's advocate 步骤应该是 Claude 自我批评，还是独立 subagent 执行？自我批评存在 confirmation bias，但 subagent 有成本。
2. 如果用户 dismiss 了所有挑战，这个过程应被记录吗？architect 建议在 conclusion.md 加 `## Doodlestein Review` 节，但这与 simplicity-reviewer 的极简立场有张力。
3. "3 个质疑"的数量是否合适？太少可能流于表面，太多可能让用户疲于应对。

---

## Topic 04：CLAUDE.md 目录化

### 最终推荐：Option A（`/ae:setup` 检测 + 建议），各来源无分歧

`/ae:setup` 加 CLAUDE.md 行数检查，分级建议：

- < 150 行：不提建议
- 150-300 行：建议拆分
- \> 300 行：强烈建议目录化

**architect 的补充调整（simplicity-reviewer 未反对）：**

- 阈值从原文 100/200 调整为 150/300（更符合多语言项目实际）
- 整合进 `setup update` 流程：update 模式顺带运行一次 CLAUDE.md 行数检查
- 行数是粗略代理，附加说明："行数仅为参考，代码片段密集时应适当降低阈值"

### 开放问题

- 行数是否是正确指标？token 估算更准确但在 SKILL.md 中不易实现。建议加说明："行数仅为参考，代码片段密集时应适当降低阈值。"
- `@RTK.md` 这类 `@file` 引用是否计入行数？引用本身 1 行但展开后可能很长，检查时应提示用户留意引用文件。

---

## 实施清单

全部为 SKILL.md 文本改动，无新基础设施：

| 优先级 | 行动 | 文件 | 规模 |
|--------|------|------|------|
| 立即 | T04：`/ae:setup` 加 CLAUDE.md 行数检查（阈值 150/300） | `plugins/ae/skills/setup/SKILL.md` | ~10 行 |
| 立即 | T03：`/ae:discuss` 加 devil's advocate 步骤 | `plugins/ae/skills/discuss/SKILL.md` | ~10 行 |
| 立即 | T01：各 skill research 步骤加 budget 约束 | 4-5 个 SKILL.md | ~5 行/每个 |
| 归档 | T01：Activity Log、两阶段 Research | — | 等 observed problem |
| 归档 | T02：全部选项 | — | unproven assumption |
| 可选 | T03：topic 文件模板加 `reversibility` 字段 | `plugins/ae/skills/discuss/SKILL.md` | ~3 行 |

---

## 视角对比总表

| Topic | architect 原始 | simplicity-reviewer | 最终采纳 |
|-------|--------------|---------------------|---------|
| T01 | A+B+C 组合 | 只做 B | 只做 B |
| T02 | A 先行（step 级 auto 标注） | 整个归档 | 整个归档 |
| T03 | A+B 为主，C 增强 | 只做 devil's advocate prompt | devil's advocate prompt，reversibility 可选 |
| T04 | Option A（阈值 150/300） | Option A | Option A（阈值 150/300） |

---

## 总结

simplicity-reviewer 的 YAGNI 审查对原始推荐构成实质性简化：

- Topic 02 从"先行实施"变为"完全归档"——最重大的推翻，原始推荐的前提假设未经验证
- Topic 03 从"三层方案堆叠"收缩到"单一 prompt 改动"——一段 SKILL.md 指令可达到同等效果
- Topic 01 从"A+B+C 预防性基础设施"收缩到"只做 B"——当前规模下 B 已够用

最终实际需要实施的内容极少：3 处纯文本 SKILL.md 改动，合计约 30 行，无任何新基础设施。
