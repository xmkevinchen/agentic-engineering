---
name: ae:status
description: Session-level state readout — branch + recent commits + active features + roadmap progress
user-invocable: true
---

# /ae:status — 当前状态

回答："我现在做到哪里了？"

跟 `/ae:dashboard` 不一样：dashboard 是 feature pipeline progress（哪个 feature 在哪个 stage），status 是 session-level snapshot（git 状态 + 最近活动 + 下一步候选）。

## 输出格式

```
Branch: main
Last commits:
  abc1234  F-014 P1: ae:plan-review TaskCreate (5m ago)
  def5678  F-013 Step 5: README ceremony (3h ago)
  ...

Active features (.ae/features/active/):
  F-015 — /ae:status session readout (size: XS, just promoted)

Recent done (last 5):
  F-014 done 2026-05-09  TaskCreate plan-review
  F-013 done 2026-05-09  ceremony preset
  F-012 done 2026-05-09  adhoc review target
  F-011 done 2026-05-08  vendor MCE
  F-010 done 2026-05-08  frozen section fix

Roadmap (active):
  v0.10.x — 5 done / 1 active / 5 trigger-gated
```

## 实现

读源（按顺序）：

1. **Branch + commits**:
   ```
   git rev-parse --abbrev-ref HEAD
   git log -5 --pretty=format:'%h  %s  (%cr)'
   ```

2. **Active features**: `ls .ae/features/active/F-*/index.md` → 读每个 frontmatter `id` / `title` / `size` / 任意可选 `deferred:` 字段 → 单行汇总。

3. **Recent done features**: `ls -t .ae/features/done/F-*/index.md | head -5` → 单行汇总（id / title / done date if present）。

4. **Roadmap progress**: `ls .ae/roadmaps/active/*.md` → 每个 roadmap 数 done / active / pending count（粗略 grep `✅ done` vs 行数）。

5. 输出按上述格式，不超过 ~25 行。

## Pre-check

`.claude/pipeline.yml` 不在 → 提示 `/ae:setup` 然后停。其他全部 best-effort（feature/roadmap 目录缺也只是输出"(none)"）。

## Out of scope

- 不显示 in-flight skill execution（要 hook，独立后续）
- 不持久化 / 无 cache
- 不自动触发（用户主动跑）
- 不修改其他 skill

## Output

只 stdout，无文件写入。
