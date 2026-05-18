---
id: cast-block-emit
target: ae:agent-teams
layer: 1
source: manual
---

## Context

- F-019 ship (2026-05-17) introduced cast block syntax in `agent-teams/SKILL.md` § Cast Block Syntax
- 49 spawn sites across 13 spawning SKILL.md files were updated to embed cast blocks in their Agent() prompt: fields
- Cast block canonical form: `📋 Cast: <agent>` header line + 3 indented field lines (Role / Angle / Why)
- Selection Trace Emission extended with `[cast] <agent> — role=<role>, angle=<angle>, why=<one-line>` line per Agent() spawn

## Prompt

How is the cast block syntax defined and verified across AE Agent Teams skills per F-019 Phase 1?
