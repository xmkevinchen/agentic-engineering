---
id: discuss-round0-convergent-revise-fastpath
target: ae:discuss
layer: 1
source: regression
---

## Expected Behavior

### MUST

#### Fast path present with all guards (AC1)
- [text:contains] Rule 2 opens with `**Any REVISE** (after Rule 1.5 filtering)` (label preserved) and routes to two branches
- [text:contains] `Convergent-REVISE fast path` branch exists with the three conditions: `方向收敛互不冲突`, `无需用户独有判断`, `不实质改动框架结构`
- [text:contains] Structural diff gate present: demotion on heading add/remove/rename OR `>30% in line count AND by more than 5 lines absolute`, logging `[FAST-PATH DEMOTED: diff exceeded structural bound]`
- [text:contains] `round_0: integrated_no_rerun` set on fast-path pass; framing template enum comment includes `integrated_no_rerun`
- [text:contains] Structured three-condition record in `round_0_notes` with labeled entries `convergent:`, `no_user_call:`, `not_structural:`
- [text:contains] Standard-2 three-line announcement template opening `## Round 0: convergent revisions integrated`, listing the integrated items, ending with the correction-window line (有异议现在说)
- [text:contains] `auto-revert` clause: ≥2 agents re-raising a framing objection on an integrated point in Round 1 → contested-path rerun + BL

#### Old machinery intact (over-delete guard)
- [text:contains] Contested path retains all three options: `Revise` (rewrites framing.md + re-runs Round 0), `Override` (skip Round 0 outcome), `Cancel` (abort discussion)
- [text:contains] `Rerun limit` paragraph still present (3 consecutive reruns → escalate)
- [text:contains] `byte-for-byte preserved across re-runs` still in the contested Revise option
- [text:contains] The fast path states Frozen is `byte-for-byte preserved` (the `as in every rewrite` clause)
- [text:contains] Rationale paragraph reads `dispositioned cleanly (fast-path integration or contested halt)`

### MUST_NOT
- [text:not_contains] The rationale no longer contains the stale `any REVISE halts cleanly`
- [structure] Rule 2 is no longer an unconditional `→ halt` (the classify-and-route prose replaced the old single-branch form)

### SHOULD
- [text:contains] The fast path cites its calibration evidence (F-036/F-037 rerun contrast) so future editors understand the boundary
