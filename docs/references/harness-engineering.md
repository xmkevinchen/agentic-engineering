# Harness Engineering — 借鉴记录

## 来源

- [OpenAI: Harness Engineering](https://openai.com/index/harness-engineering/)
- [Anthropic: Harness Design for Long-Running LLM Apps](https://www.anthropic.com/engineering/harness-design-long-running-apps)
- [OpenAI: Building AI-Native Engineering Teams](https://developers.openai.com/codex/guides/build-ai-native-engineering-team)
- [Ralph Wiggum Plugin](https://github.com/anthropics/claude-code/blob/main/plugins/ralph-wiggum/README.md)
- [Ralph Wiggum 原理详解](https://paddo.dev/blog/ralph-wiggum-autonomous-loops/)
- [Ralph Loop Quickstart](https://github.com/coleam00/ralph-loop-quickstart)
- [Ralph Orchestrator](https://github.com/mikeyobrien/ralph-orchestrator)

## 借鉴了什么

### 生成/评估分离（OpenAI）
写代码的 agent 不能审查自己的代码。ae 从 v0.0.1 就实现了这个原则 — developer agents 生成，reviewer agents 评估，challenger 仲裁。

### 评判标准结构化（OpenAI + Anthropic）
Review 需要显式 checklist 而不是 agent 自由发挥。ae 的 5 个 reviewer 各有专属 checklist + P1/P2/P3 分级。Phase 1 进一步扩展到 plan 和 discuss 环节的 self-check。

### Drift Detection（Anthropic）
Agent 执行时可能偏离计划。ae 的 Phase 2 实现了 contract-based drift detection — 从 plan 的 "Expected files" 提取预期范围，pre-commit 时用 `git diff --name-only` 验证。

### Auto-pass 默认开（Ralph Wiggum 启发）
Ralph 证明了：有明确完成标准的任务可以自动迭代。ae 的 auto-pass gate 默认开启 — gate 条件满足就自动继续，只在异常时暂停。方向是 "auto always, pause on exception"。

### 讨论收敛（Meta 内部 AE 实战）
三态评分（converged/revisit/deferred）+ Sweep 机制（deferred 必须全部落盘）。来源不是外部文章，而是内部版本的实战经验。

## 淘汰了什么

### Context Budget 硬限制
最初从 "context 是有限资源" 推导出 "限制读 N 个文件"。淘汰原因：硬限制降低 agent 信息量 = 降低输出质量，与 ae 的 multi-agent 高质量协作哲学矛盾。Claude Code 的 native compaction 已处理 context 管理。

### CLAUDE.md 目录化检查
`/ae:setup` 检查 CLAUDE.md 行数并建议拆分。淘汰原因：ae 作为插件无法也不应该改用户的 CLAUDE.md，检查了也没有 actionable 的事情可做。

### Context Checkpoint（主动压缩）
在 skill 关键阶段清空 context 只保留摘要。淘汰原因：Claude Code 没有原生 "清空 context" API，只能靠 scratch + 新 agent 模拟，不现实。

### Ralph Stop Hook 循环
用 Stop hook 拦截退出实现自动迭代。淘汰原因：Ralph 适合机械性任务（明确完成标准、可自动验证），ae 的流程是 review-heavy 的（讨论、plan review、code review），需要多 agent 判断而不是简单循环。ae 用 auto-pass gate 替代。

### `--auto N` 参数
用户手动授权 N 步自动执行。淘汰原因：方向错了 — 应该是默认自动、异常暂停，而不是默认手动、用户 opt-in。

### 4 级自动化系统（level 0-3）
让用户选择自动化级别。淘汰原因：simplicity-reviewer 指出会退化成开关（要么全开要么全关），中间级别无人使用。简化为 auto-pass 默认开 + `work.auto_pass: false` 可关。
