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
3. **Cross-family** (codex-proxy + gemini-proxy): add when task involves review, validation, or decision-making.
   - Give both proxies the **same** specialized prompt focused on the task context.
   - Do NOT give generic "review this" — specialize based on context (e.g., "review this migration for data integrity and rollback safety").
   - Cross-family value = independent perspectives on the same question, not different roles.
4. **Project agents**: discover all available agents (project `.claude/agents/`, plugins, global `~/.claude/agents/`). If a project agent matches the task better than a built-in one, prefer it.
5. **Show selected team** to user before launching. User can adjust.

## Cross-family Prompt Reference

Both codex-proxy and gemini-proxy receive the **same** specialized prompt. Examples by context:

| Context | Specialized Prompt Focus |
|---------|------------------------|
| DB / migration | "Review for data integrity, index strategy, rollback safety, zero-downtime migration" |
| Auth / security | "Review for authentication bypass, token lifecycle, injection vectors, secrets exposure" |
| API / contract | "Review for backwards compatibility, error handling, versioning, contract violations" |
| Performance | "Review for query efficiency, N+1 patterns, caching strategy, memory allocation" |
| Architecture | "Review for module boundaries, dependency direction, separation of concerns" |
| New feature | "Review for hidden dependencies, scope completeness, edge cases, integration risks" |
| Plan review | "Review for step decomposition quality, dependency accuracy, AC verifiability" |

**Do NOT** assign different roles to codex vs gemini (e.g., "codex does security, gemini does performance"). Cross-family value = same question, different perspectives.
