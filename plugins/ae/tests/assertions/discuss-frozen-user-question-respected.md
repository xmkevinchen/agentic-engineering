---
id: discuss-frozen-user-question-respected
target: ae:discuss
layer: 1
source: regression
---

## Expected Behavior

### MUST

#### Frozen section structure (AC1)

- [text:contains] Appendix's framing.md template contains `## User Question (Frozen)` heading
- [structure:order] `## User Question (Frozen)` heading appears after `# Framing — [title]` and before `## Problem Statement` (within the framing.md template block in the Appendix)
- [text:contains] Frozen section description contains the words "sacred" AND "immutable"
- [text:contains] Frozen section description contains "do NOT rewrite, paraphrase, normalize, translate, narrow, broaden" or equivalent listing
- [text:contains] File contains `### 1.4. Writing the` sub-section heading (the §1.4 framing.md write constraint)
- [structure:order] `### 1.4.` heading appears before `### 1.5. Round 0 — Framing Review`
- [text:contains] §1.4 sub-section contains the word `verbatim`
- [text:contains] §1.4 sub-section contains at least 4 distinct MUST NOT items covering: summarize/condense, translate, normalize formatting, explanatory wrapping
- [text:contains] §1.4 sub-section contains "stops and asks the user" or equivalent (when invocation too long)

#### Frozen-field rule (AC1 spawn-time enforcement)

- [text:contains] §1.5.1 contains a `**Frozen-field rule**` block (heading or bold marker)
- [text:contains] Frozen-field rule defines `Sacred portion = exact contents of` `## User Question (Frozen)`
- [text:contains] Frozen-field rule defines `Mutable scope = TL-authored Problem Statement, Scope, Reference Material` (or lists these 3 sections)
- [text:contains] Frozen-field rule states wording-only changes are still invalid OR semantic equivalence is irrelevant
- [text:count==6] The phrase `Honor the Frozen-field rule defined in §1.5.1` appears exactly 6 times in the file (1 cross-reference in the rule definition + 5 reviewer spawn prompts each echoing it)

#### Detection mechanism (AC2)

- [text:contains] §1.5.3 verdict format contains `target: <Problem Statement | Scope | Reference Material>` (the 3 mutable section names listed as enum)
- [text:not_contains_in_block] verdict format's `target:` enum does NOT include `User Question (Frozen)` (sacred section is not a valid target)
- [text:contains] §1.5.3 contains `Frozen-section integrity check` heading (Rule 1.5 name)
- [structure:order] Rule 1.5 (Frozen-section integrity check) appears AFTER Rule 1 (Quorum check) AND BEFORE Rule 2 (Any REVISE → classify & route; F-038 split it into fast-path/contested branches)
- [text:contains] Rule 1.5 contains `byte-for-byte` or `byte-exact` (spec text — instructs TL to do mechanical comparison; not requiring fixture to execute byte comparison)
- [text:contains] Rule 1.5 contains `Do not judge semantic equivalence` or equivalent
- [text:contains] Rule 1.5 contains `wording-only changes are still invalid` or equivalent
- [text:contains] Rule 1.5 contains `Invalid verdicts are` `dropped entirely` (explicit no recovery path)
- [text:contains] Rule 2 (TL rewrites framing.md per feedback) contains `MUST NOT alter` `## User Question (Frozen)` section
- [text:contains] Rule 2 contains `byte-for-byte preserved across re-runs`
- [text:contains] Rationale for rule order paragraph contains explanation that Rule 1.5 fires before Rule 2 (mechanical guard before user-facing halt or equivalent)

### MUST_NOT

- [structure:order] Rule 1.5 does NOT appear before Rule 1 (order would invalidate the precondition chain)
- [text:not_contains] Rule 1.5 does NOT contain `MAY still be retained if TL can rephrase` (confirms strategic Doodlestein's recovery-path deletion landed)
- [text:not_contains] Rule 1.5 does NOT contain "rephrase / recovery" UNLESS preceded by negation (e.g., "no rephrase / recovery" — the negated form is the correct text; the affirmative form would indicate recovery path remains)

### SHOULD

- [text:format] §1.5.1 reviewer spawn prompts reference the Frozen-field rule by `defined in §1.5.1 above` rather than re-stating the full rule inline (DRY check — avoids prompt bloat across 5 spawns)
- [text:contains] §1.4 sub-section explains rationale ("compares against this section's text" or "false sense of security" — explains why verbatim copy matters for downstream byte-diff guard)
