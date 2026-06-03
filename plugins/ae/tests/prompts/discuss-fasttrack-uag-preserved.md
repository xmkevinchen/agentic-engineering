---
id: discuss-fasttrack-uag-preserved
target: ae:discuss
layer: 1
source: regression
---

## Context

F-036 softens the "Discussion before user" Principle in `plugins/ae/skills/discuss/SKILL.md`: simple / high-reversibility topics may converge in 1 round (invoking the existing high-reversibility fast-track) instead of an unconditional minimum of 2 rounds. The critical guard (from plan-stage Doodlestein-adversarial): a 1-round fast-track topic MUST still run the Unanimous Agreement Gate (UAG) — only purely informational topics skip the explore round. A cross-reference is added in the §3 UAG bullet so the gate cannot be bypassed by groupthink. This test verifies the softening AND the guard are both present, and that no "fast-track skips UAG" loophole text exists.

## Prompt

Read `plugins/ae/skills/discuss/SKILL.md` and answer:

1. Does the "Discussion before user" Principle still say "Team runs minimum 2 rounds" unconditionally, or has it been softened to allow 1-round convergence for simple/high-reversibility topics?
2. Does the softened text invoke the existing "high-reversibility fast-track"?
3. Does the softened text state that a 1-round fast-track topic MUST still run the Unanimous Agreement Gate (UAG)?
4. Is there a constraint that only purely informational (non-decision) topics skip the explore round?
5. Does the §3 UAG bullet contain a cross-reference clarifying the fast-track does NOT waive UAG (the "all agree on Round 1 = groupthink case UAG catches" rationale)?
6. Is the UAG definition itself (structured falsification question, search for counterexamples) unchanged?
