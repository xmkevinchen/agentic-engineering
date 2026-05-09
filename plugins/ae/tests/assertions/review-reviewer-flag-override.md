---
id: review-reviewer-flag-override
target: ae:review
layer: 1
source: regression
---

## Expected Behavior

### MUST

#### Override semantics (AC3)

- [text:contains] `Override semantics (NOT additive)` OR equivalent (override; not-additive)
- [text:contains] When flag present, spec says `skip the default Agent Selection Reference table entirely`
- [text:contains] WRONG example: `--reviewer security-reviewer --reviewer challenger` → described as running plus default (incorrect interpretation)
- [text:contains] CORRECT example: same flag combo → runs ONLY security + challenger; default selection table SKIPPED entirely
- [text:contains] Multi-flag is additive AMONG flags (so `--reviewer X --reviewer Y` spawns both)
- [text:contains] Multi-flag collectively override (default table still skipped regardless of flag count)

#### Scale anchor (AC3 user-trust)

- [text:contains] Default selection table typically spawns `4-5` reviewers
- [text:contains] Concrete dropped-reviewer list when `--reviewer challenger` alone (e.g., architecture-reviewer / security-reviewer / codex-proxy / gemini-proxy)
- [text:contains] Phrase characterizing flag use as `deliberate scope reduction` OR `not an addition`

#### Forward-reference (AC3 regret-hedge)

- [text:contains] `--add-reviewer` mentioned as future additive variant
- [text:contains] Deferred to `v0.11.x` (explicit version target)
- [text:contains] Reasoning that v0.11.x might add this if `--reviewer` override proves insufficient

#### Hard-fail on invalid reviewer (AC3)

- [text:contains] Invalid reviewer name → `hard fail` AND/OR full list of valid names emitted
- [text:contains] Spec explicitly forbids silent skip (`Do NOT silently skip unknown names`)
- [text:contains] Reason: silent skip would `silently shrink review coverage` OR equivalent

#### Combined with target (AC3)

- [text:contains] `--reviewer` flag is `fully orthogonal to <target> argument`
- [text:contains] Combined-use example: `/ae:review src/foo.py --reviewer security-reviewer` OR equivalent

#### Scope: ae:review only (AC3)

- [text:contains] `--reviewer` flag is `ae:review only` OR `Not on ae:code-review`
- [text:contains] Reason: ae:code-review's `4-track structure is fundamentally multi-reviewer`

#### Output target when flag present (AC4)

- [text:contains] When `--reviewer` flag is present, write target falls in case (c): `output.reviews/adhoc/...`
- [text:contains] `--reviewer` flag with pipeline target derives id as `<feature-id>-rerun-<reviewer-name>` OR equivalent

### MUST_NOT

- [text:not_contains] Spec says `--reviewer` flag is `additive` (without preceding negation) — would contradict override semantic
- [text:not_contains] Spec implies unknown reviewer name silently dropped (no hard fail)

### SHOULD

- [text:contains] flag valid name examples include both built-in reviewer (`challenger`, `architecture-reviewer`) AND plugin-namespaced (`ae:engineering:minimal-change-engineer`)
