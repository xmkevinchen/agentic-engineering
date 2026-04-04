---
id: team-max-five-agents
target: ae:team
layer: 1
source: generated
---

## Context

- Agent Teams enabled in `~/.claude/settings.json`
- `.claude/pipeline.yml` exists with valid configuration
- Task is intentionally broad and complex, spanning many domains, to test maximum agent cap

## Prompt

/ae:team "full security audit: auth, API, database, frontend, infra, dependencies, CI/CD"

## Prompt Variants

- /ae:team "comprehensive review of auth, payments, notifications, search, analytics, caching, and logging systems"
- /ae:team "audit all: code quality, security, performance, accessibility, i18n, testing, documentation, and deployment"
