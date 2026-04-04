---
id: omitclaudemd-governance-guard
target: all-agents
layer: 1
source: manual
---

## Context

AE agents that reference "TL Autonomy Boundary in project CLAUDE.md" in their body text depend on receiving CLAUDE.md content at runtime. The `omitClaudeMd: true` frontmatter field prevents CLAUDE.md delivery. If a governance-dependent agent accidentally gets `omitClaudeMd: true`, it loses the 6 operational rules silently.

## Prompt

Structurally check all agent .md files under `plugins/ae/agents/`. For each agent whose body text contains "TL Autonomy Boundary", verify that its YAML frontmatter does NOT contain `omitClaudeMd: true`.
