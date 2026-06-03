---
id: discuss-fasttrack-uag-preserved
target: ae:discuss
layer: 1
source: regression
---

## Expected Behavior

### MUST

#### Pacing softened (AC2)

- [text:contains] The "Discussion before user" Principle contains `high-reversibility fast-track`
- [text:contains] It allows a simple/high-reversibility topic to converge in `1 round`
- [text:contains] It distinguishes complex topics ("genuinely contested AND consequential") that run the full research → explore

#### UAG hole closed (AC2 — the load-bearing guard)

- [text:contains] The softened Principle states a 1-round fast-track topic MUST still run the Unanimous Agreement Gate (`MUST still run the Unanimous Agreement Gate` or equivalent)
- [text:contains] Only purely informational / non-decision topics skip the explore round
- [text:contains] The §3 UAG bullet contains a cross-reference that the fast-track `does NOT waive UAG`
- [text:contains] The §3 UAG cross-reference names the groupthink rationale ("all agents agree on Round 1 is exactly the groupthink case")

### MUST_NOT

- [text:not_contains] The file does NOT contain unconditional `Team runs minimum 2 rounds` (the bare pre-F-036 rule must be gone)
- [text:not_contains] No text permits a fast-track topic to SKIP UAG (no "fast-track skips UAG" / "1-round topics need no UAG" loophole)

### SHOULD

- [text:contains] The UAG definition itself remains (structured falsification question + search for counterexamples + "Passed UAG = genuine convergence") — softening pacing did not weaken the gate
