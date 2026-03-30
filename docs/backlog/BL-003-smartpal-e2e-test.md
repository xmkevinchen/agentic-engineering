---
id: BL-003
title: "SmartPal 端到端实测"
type: backlog
created: 2026-03-30
status: open
---

# SmartPal 端到端实测

所有 SKILL.md 改动都是 prompt 指令，未在真实项目上验证过。需要在 SmartPal 上跑完整流程：

- `/ae:setup update` — 更新 pipeline.yml（加 work config）
- `/ae:discuss` — 验证三态评分 + Sweep + topic 目录结构
- `/ae:plan` — 验证 plan self-check + Expected files + Doodlestein
- `/ae:work` — 验证 drift detection + auto-pass + circuit breaker
- `/ae:review` — 验证 outcome 统计

前提：SmartPal 需要重新安装 ae 插件（cache 还是旧版）。
