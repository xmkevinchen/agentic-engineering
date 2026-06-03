---
id: discuss-round0-convergent-revise-fastpath
target: ae:discuss
layer: 1
source: regression
---

## Context

F-038 split `/ae:discuss` §1.5.3 Rule 2 into a classify-and-route: convergent REVISEs integrate without a mandatory Round 0 rerun (with a mechanical structural diff gate + structured audit record + user announcement + auto-revert), while conflicting/user-owned/structural REVISEs keep the existing halt (Revise/Override/Cancel). Evidence: F-036/F-028 rerun burn + F-037's same-day two-run contrast.

## Prompt

Static analysis of `plugins/ae/skills/discuss/SKILL.md` §1.5.3: verify the fast path exists with its guards AND the contested path + rerun limit + Frozen protections survive intact.
