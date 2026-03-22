---
id: "03"
title: "文件命名与格式规范"
status: decided
created: 2026-03-22
decision: "B — 每类独立编号 + slug"
rationale: "实现最简单，与 SmartPal 已有约定（discussions/001-xxx, BL-002-xxx）天然兼容。跨类型时间关系通过 frontmatter created 字段查询。"
---

# 议题：文件命名与格式规范

## 背景

当前命名方式混乱：analyze/discuss 用 `NNN-slug` 三位编号目录，plan 没有规定文件名，think 用 `<topic>.md`，review 的 notes.md 路径不明。需要统一命名规范和文件格式。

## 选项

### A：全局递增编号 + slug

所有产出共享一个全局计数器，跨 skill 类型：

```
docs/ae/
  analyses/001-auth-flow.md
  discussions/002-api-design/
  plans/003-implement-auth.md
  analyses/004-perf-bottleneck.md
```

- **优点**：天然排序反映时间线；跨类型可以看出工作顺序
- **缺点**：全局计数器实现复杂（需要扫描所有子目录）；编号间有空洞不直观

### B：每类独立编号 + slug

每个子目录独立编号：

```
docs/ae/
  analyses/001-auth-flow.md
  analyses/002-perf-bottleneck.md
  discussions/001-api-design/
  plans/001-implement-auth.md
```

- **优点**：实现简单（只扫当前子目录）；各类型编号连续无空洞
- **缺点**：跨类型无法看出先后关系（analyses/001 和 plans/001 谁先？）

### C：日期前缀 + slug

```
docs/ae/
  analyses/2026-03-22-auth-flow.md
  discussions/2026-03-22-api-design/
  plans/2026-03-23-implement-auth.md
```

- **优点**：自带时间信息；无需计数器；天然排序
- **缺点**：同一天多个产出需要额外区分（加序号？）；文件名较长

## 格式规范（各选项通用）

无论选哪种命名方式，格式统一为：

- **文件格式**：Markdown + YAML frontmatter
- **frontmatter 必含字段**：`id`, `title`, `type`（analysis/discussion/plan/review/trace）, `created`, `status`
- **讨论目录结构不变**：discuss 因为多文件性质（index + topics + conclusion），保持目录形式
- **其余为单文件**：analyses、plans、reviews、traces 各为单个 .md 文件

## 建议

推荐 **B：每类独立编号 + slug**。实现最简单，语义清晰。跨类型的时间关系通过 frontmatter 的 `created` 字段查询，不需要靠文件名编码。discuss 已有的 `NNN-slug` 目录约定自然延续。
