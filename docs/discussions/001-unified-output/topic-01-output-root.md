---
id: "01"
title: "输出根目录选择"
status: decided
created: 2026-03-22
decision: "废弃 — 被议题 02 的方案 D 合并取代"
rationale: "不需要统一根目录。语义槽方案让每个 slot 独立配路径，默认值直接在 docs/ 下（如 docs/discussions/），无需 docs/ae/ 隔离层。已有项目（SmartPal）零迁移兼容。"
---

# 议题：输出根目录选择

## 背景

ae 产出的文件（分析、计划、讨论、审查结果）需要一个统一的根目录。当前散落在 `docs/discussions/`、`docs/milestones/`、`docs/analyses/`、`docs/backlog/`、`results/reviews/` 等多个位置。根目录的选择影响项目整洁度和可发现性。

## 选项

### A：`docs/ae/`

所有 ae 产出集中在 `docs/ae/` 下，子目录按 skill 类型分：

```
docs/ae/
  analyses/
  discussions/
  plans/
  reviews/
  traces/
  backlog/
```

- **优点**：命名空间隔离，不污染项目已有 `docs/`；一目了然哪些是 ae 产出
- **缺点**：嵌套多一层；如果项目本身用 `docs/` 管文档，ae 的产出可能被混入 docs 的构建流程

### B：`.claude/ae/`

产出放在 `.claude/ae/` 下（隐藏目录）：

```
.claude/ae/
  analyses/
  discussions/
  plans/
  reviews/
```

- **优点**：完全隔离，不影响项目文档结构；`.claude/` 已是 ae 配置的家
- **缺点**：隐藏目录不易发现；团队成员可能忽略；部分项目 `.gitignore` 排除 `.claude/`；不适合需要版本控制的产出（计划、决策）

### C：项目根目录平铺（维持现状改良）

保持 `docs/` 下平铺，但统一前缀：

```
docs/
  ae-analyses/
  ae-discussions/
  ae-plans/
  ae-reviews/
```

- **优点**：扁平结构，路径短；与现有习惯接近
- **缺点**：前缀方案不优雅；`docs/` 目录变杂；没有真正的命名空间隔离

## 建议

推荐 **A：`docs/ae/`**。一层嵌套换来干净的命名空间隔离，且产出本质上是文档（计划、分析、决策），放在 `docs/` 下语义正确。`.claude/` 适合配置和运行时状态，不适合需要团队共享和版本控制的知识产出。
