---
name: ae:agent-selection
description: "Reference: agent selection reference — context-based team composition and cross-family role assignment. Used by skills that create Agent Teams."
user-invocable: true
---

# Agent Selection Reference

所有需要组建 Agent Team 的 skill 引用此表。

## Selection Table

| Context Signal | Core Agents | Typical Lead |
|---------------|-------------|--------------|
| DB / SQL / migration / schema | performance-reviewer, architect | architect |
| Auth / token / session / secrets | security-reviewer, architecture-reviewer | security-reviewer |
| UI / CSS / layout / frontend | code-reviewer, architect | code-reviewer |
| API / endpoint / contract / protocol | architecture-reviewer, standards-expert | architecture-reviewer |
| New feature (cross-module) | architect, dependency-analyst, code-reviewer | architect |
| Refactor / delete / simplify | archaeologist, code-reviewer | archaeologist |
| Performance / latency / scaling | performance-reviewer, architect, dependency-analyst | performance-reviewer |
| Bug / debug / trace | archaeologist, dependency-analyst, qa | archaeologist |
| Design / architecture decision | architect, challenger | architect |
| Research / analysis | archaeologist, standards-expert, dependency-analyst | archaeologist |
| Plan review | architect, dependency-analyst | architect |

## Rules

1. **Pick 2-4 core agents** from the table. Multiple rows can match — combine.
2. **Always add challenger** to any team with 3+ agents.
3. **Cross-family** (codex-proxy / gemini-proxy): external experts brought in for specific review angles.
   - Read `cross_family` from pipeline.yml to determine which proxies are enabled (none, codex only, gemini only, or both).
   - TL picks **angles first**, then assigns to available proxies. Angles are about coverage, not about which proxy does it.
   - Give a **specialized prompt with clear focus** — not generic "review this".
   - **One proxy enabled** → assign one angle. **Both enabled** → prefer different angles; same-angle only when there is genuinely no second valuable blind spot.
   - Example: if Claude has security-reviewer and architecture-reviewer, cross-family angles could be performance + data integrity. If only one proxy is enabled, it gets performance.
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

Default to different angles for each proxy. Same-angle is acceptable only when there is genuinely no second valuable blind spot to cover.

## Proxy Timeout Protocol

All skills that launch proxy agents MUST include timeout protection and fallback to prevent hangs and preserve cross-family signal.

### Proxy prompt suffix (add to every codex-proxy / gemini-proxy prompt)
```
If MCP connection fails, times out (120s), is rate-limited, or quota is exhausted:
SendMessage to team-lead: "unavailable: [reason]" (reason = timeout | connection | rate_limit | quota_exhausted).
Then exit immediately. Do not retry.
```

### TL fallback logic (TL executes this, not subagent leads)
```
On proxy "unavailable" message:
1. Identify the failed proxy's review angle.
2. Is that angle already covered by another active agent (proxy or Claude)?
   → Drop the failed proxy. No replacement needed.
3. Angle NOT covered → try other proxy family first:
   a. Other family enabled and not also failed?
      → Spawn replacement proxy from other family with that angle.
   b. Other family also failed or not enabled?
      → Spawn a Claude agent (model by task complexity: opus/sonnet/haiku) with that angle.
4. All proxies failed?
   → Spawn Claude agent(s) for uncovered angles, or mark cross_family_degraded if
     all angles are already covered by Claude agents.
TL must actually spawn and prompt the replacement, not just announce it.
TL tracks proxy availability within the current Agent Team — do not re-spawn
a proxy that already reported unavailable in this team.
```

### Lead/challenger prompt suffix (when proxies are in team)
```
If a proxy has not responded within 120s, notify TL that proxy is unresponsive. TL handles fallback.
```

Skills reference this protocol instead of defining their own timeout or fallback logic.
