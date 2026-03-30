---
id: BL-005
title: "用户自定义 Agent 机制"
type: backlog
created: 2026-03-30
status: open
---

# 用户自定义 Agent 机制

让用户能定义自己的 agent，ae 能发现并使用。

已有基础设施：
- 项目 agents 放 `.claude/agents/`
- `agent-selection` skill 规则 4：project agents 优先
- Claude Code agent discovery 能发现项目/插件/全局 agents

缺的：
- Agent 模板 — 用户怎么知道要定义什么格式
- `/ae:setup` 引导 — 检测项目 agents，建议创建
- 文档 — 怎么写一个和 ae 兼容的 agent

需要独立 discussion。
