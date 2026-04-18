---
id: omitclaudemd-governance-guard
target: all-agents
layer: 1
source: manual
---

## Expected Behavior

- MUST [text:contains] Agents referencing "TL Autonomy Boundary" are identified (currently: architect, challenger, qa, test-lead — 4 workflow agents; review agents reference "CLAUDE.md" generally but not "TL Autonomy Boundary" by name; list updated after simplicity-reviewer deletion)
- MUST_NOT [file:contains] No agent file that contains "TL Autonomy Boundary" in body text also contains "omitClaudeMd: true" in frontmatter
- MUST [text:contains] Agents with omitClaudeMd: true are listed (currently: codex-proxy, gemini-proxy, doodlestein-strategic, doodlestein-adversarial, doodlestein-regret)
