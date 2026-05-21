---
id: review-check-6-protocol-invariant
target: ae:review
layer: 1
source: manual
---

## Expected Behavior

### MUST (structurally-bounded — section-scope intent per Doodlestein-strategic R2)

- [file:contains:plugins/ae/skills/review/SKILL.md] `### Check 6: Protocol Invariant Check` — heading exact, regression-proofs the section identity
- [text:regex:plugins/ae/skills/review/SKILL.md] `### Check 6: Protocol Invariant Check[\s\S]{0,1000}--regression --layer1` — the `--regression --layer1` invocation form MUST appear within ~1000 chars of the Check 6 heading (verifies the invocation lives inside Check 6's section, not relocated)
- [text:regex:plugins/ae/skills/review/SKILL.md] `### Check 6: Protocol Invariant Check[\s\S]{0,1000}Layer 1 failure = P1` — the failure severity verbatim MUST appear within ~1000 chars of the Check 6 heading
- [text:regex:plugins/ae/skills/review/SKILL.md] `### Check 6: Protocol Invariant Check[\s\S]{0,1500}Mirrors` — the explicit cross-reference to /ae:work C.5 (the word "Mirrors") MUST appear within ~1500 chars of the Check 6 heading

### MUST (file-scoped content presence)

- [file:contains:plugins/ae/skills/review/SKILL.md] `~/.ae/traces/` — Check 6's trace emission path (T1 trace protocol) MUST be documented somewhere in the spec

### MUST_NOT

- [behavior] MUST NOT relocate Check 6 outside the Pre-checks section — the check is a verdict-blocking gate; moving it elsewhere weakens the safety contract. Soft contract; not currently automatable.

### Notes

- This fixture establishes forward Layer 1 coverage for the Check 6 prose. Doodlestein-adversarial R2 predicted "0 existing L1 cases target ae:review" — this was empirically corrected in plan 057 AC1.1 baseline classification (8 existing L1 cases were found, not 0). This new fixture adds 1 more (the first one specifically covering Check 6).
- Layer 2 dynamic exercise of Check 6 (running a feature with plugin changes through `/ae:review` and verifying the cumulative-diff Layer 1 invocation actually runs + blocks on failure) is part of `/ae:review`'s general Layer 2 test coverage, not a per-Check 6 fixture.

## Judge

mechanical — all MUST assertions are file-content greppable / regex-checkable; MUST_NOT [behavior] is soft contract.
