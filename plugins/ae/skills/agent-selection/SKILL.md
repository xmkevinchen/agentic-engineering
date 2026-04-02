---
description: Agent selection reference — context-based team composition and cross-family role assignment. Used by skills that create Agent Teams.
---

# Agent Selection Reference

所有需要组建 Agent Team 的 skill 引用此表。

## Selection Table

| Context Signal | Core Agents | Typical Lead |
|---------------|-------------|--------------|
| DB / SQL / migration / schema | performance-reviewer, architect | architect |
| Auth / token / session / secrets | security-reviewer, architecture-reviewer | security-reviewer |
| UI / CSS / layout / frontend | simplicity-reviewer, code-reviewer | code-reviewer |
| API / endpoint / contract / protocol | architecture-reviewer, standards-expert | architecture-reviewer |
| New feature (cross-module) | architect, dependency-analyst, code-reviewer | architect |
| Refactor / delete / simplify | simplicity-reviewer, archaeologist | simplicity-reviewer |
| Performance / latency / scaling | performance-reviewer, architect, dependency-analyst | performance-reviewer |
| Bug / debug / trace | archaeologist, dependency-analyst, qa | archaeologist |
| Design / architecture decision | architect, challenger, simplicity-reviewer | architect |
| Research / analysis | archaeologist, standards-expert, dependency-analyst | archaeologist |
| Plan review | architect, dependency-analyst, simplicity-reviewer | architect |

## Rules

1. **Pick 2-4 core agents** from the table. Multiple rows can match — combine.
2. **Always add challenger** to any team with 3+ agents.
3. **Cross-family** (codex-proxy + gemini-proxy): external experts brought in for specific review angles.
   - TL decides **what angle** the external expert should review from, based on where blind spots are most likely.
   - Give a **specialized prompt with clear focus** — not generic "review this".
   - Cross-family can review from the same angle as a Claude agent (two independent opinions) or a different angle (covering blind spots).
   - Example: if Claude has security-reviewer and architecture-reviewer, cross-family could review from performance angle (补盲区) or also from security angle (双重独立验证). TL decides based on context.
4. **Project agents**: discover all available agents (project `.claude/agents/`, plugins, global `~/.claude/agents/`). If a project agent matches the task better than a built-in one, prefer it.
5. **Show selected team** to user before launching. User can adjust.

## Cross-family Prompt Reference

TL 根据 context 决定外部专家从什么角度审查。以下是常见角度的 prompt 示例：

| Review Angle | Specialized Prompt Focus |
|-------------|------------------------|
| Data integrity | "Review for data integrity, index strategy, rollback safety, zero-downtime migration" |
| Security | "Review for authentication bypass, token lifecycle, injection vectors, secrets exposure" |
| API contract | "Review for backwards compatibility, error handling, versioning, contract violations" |
| Performance | "Review for query efficiency, N+1 patterns, caching strategy, memory allocation" |
| Architecture | "Review for module boundaries, dependency direction, separation of concerns" |
| Scope & risks | "Review for hidden dependencies, scope completeness, edge cases, integration risks" |
| Plan quality | "Review for step decomposition quality, dependency accuracy, AC verifiability" |

TL 可以给 codex 和 gemini 相同角度（双重独立验证）或不同角度（覆盖更多盲区），取决于哪里最需要外部视角。

## Proxy Timeout Protocol

All skills that launch proxy agents MUST include timeout protection to prevent hangs.

**Proxy prompt suffix** (add to every codex-proxy / gemini-proxy prompt):
```
If MCP connection fails or times out (120s), SendMessage 'unavailable' to [lead agent] and exit immediately. Do not retry.
```

**Lead/challenger prompt suffix** (add to architect or challenger prompt when proxies are in team):
```
If a proxy has not responded within 120s, treat as unavailable and continue synthesis without it.
```

Skills reference this protocol instead of defining their own timeout logic.
