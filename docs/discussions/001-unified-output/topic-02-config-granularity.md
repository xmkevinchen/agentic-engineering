---
id: "02"
title: "pipeline.yml 配置粒度"
status: decided
created: 2026-03-22
decision: "D — 语义槽 + 合理默认值，无 root"
rationale: "从 SmartPal 实际用例出发：已有项目的路径天然兼容默认值，无需迁移。新项目零配置即可用。root 概念不必要。同时修正议题 01 的决定。"
---

# 议题：pipeline.yml 配置粒度

## 背景

当前 pipeline.yml 的 `output` 块有 `output.plans` 和 `output.review` 两个独立路径，且 think 自己又引入了 `output.analyses`。需要决定 pipeline.yml 给用户多大的配置自由度。这个决策依赖议题 01（根目录选择）。

## 选项

### A：只配根目录

```yaml
output:
  root: "docs/ae/"    # 唯一可配项，默认 docs/ae/
```

子目录 `analyses/`、`discussions/`、`plans/` 等由各 skill 内部决定，不可配。

- **优点**：配置极简，一行搞定；不会出现路径配错的问题；skill 之间有固定的相对路径引用
- **缺点**：无法单独把 plans 放到别的位置；灵活性最低

### B：根目录 + 可覆盖子目录

```yaml
output:
  root: "docs/ae/"            # 默认根
  analyses: "analyses/"       # 相对于 root，可覆盖
  discussions: "discussions/"
  plans: "plans/"
  reviews: "reviews/"
```

- **优点**：兼顾简洁和灵活；大多数用户只改 root；有特殊需求的可以逐项覆盖
- **缺点**：配置项多了；子目录覆盖后 skill 之间的交叉引用可能断裂

### C：每个 skill 独立配置（当前方向）

```yaml
output:
  plans: "docs/milestones/"
  reviews: "results/reviews/"
  analyses: "docs/analyses/"
  discussions: "docs/discussions/"
```

- **优点**：最大灵活性；适合有强烈目录偏好的项目
- **缺点**：配置冗长；各路径之间没有关联，容易散乱；没有统一感；当前实际也没人用

### D：语义槽 + 合理默认值，无 root（讨论中产生的新方案）

```yaml
output:
  discussions: "docs/discussions/"   # 默认值
  plans: "docs/plans/"              # 默认值
  milestones: "docs/milestones/"    # 默认值
  backlog: "docs/backlog/"          # 默认值
  reviews: "docs/reviews/"          # 默认值
  analyses: "docs/analyses/"        # 默认值
```

不需要 root 概念。每个 slot 独立，有合理默认值。不配 = 用默认值。

关键验证：SmartPal 已有的 `docs/discussions/`、`docs/milestones/` 天然匹配默认值，**零迁移**。

同时修正议题 01 — 不需要 `docs/ae/` 隔离层，因为：
- 新项目的 docs/ 里本来就全是 ae 产出
- 加 ae/ 是 YAGNI
- ae 产出本身就是项目文档，不应被隔离

- **优点**：零配置能用；已有项目向后兼容；agent 读取逻辑简单（一个 slot 一个路径）；不需要 root + 相对路径的解析
- **缺点**：配置项比 A 多（但都可省略）

## 建议

推荐 **D：语义槽 + 合理默认值**。这是从 SmartPal 实际用例倒推出的方案——已有项目天然兼容，新项目零配置。比选项 C 多了"默认值"的概念，比选项 A/B 少了"root"的概念。
