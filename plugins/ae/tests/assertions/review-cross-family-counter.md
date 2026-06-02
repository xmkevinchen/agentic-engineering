---
id: review-cross-family-counter
target: ae:review
layer: 1
source: regression
---

## Expected Behavior

### MUST
- [file:contains:plugins/ae/skills/review/SKILL.md] The Outcome Statistics block emits a cross-family participation line sourced from `plugins/ae/scripts/cross-family-counter.sh` (run the script, emit its output line verbatim).
- [file:contains:plugins/ae/skills/review/SKILL.md] The line is described as a raw **descriptive** counter (e.g. how many reviews ran ≥2 families full / `X/Y reviews`), explicitly NOT a quality metric.
- [file:contains:plugins/ae/skills/review/SKILL.md] A coverage disclosure (`known/total reviews have family-tracking data`, or equivalent) is present so reviews with no `families_invoked` data are not read as cross-family failures.
- [file:contains:plugins/ae/skills/review/SKILL.md] The principled quality (flip-rate) metric is deferred to BL-115.
- [file:contains:plugins/ae/skills/review/SKILL.md] Single emit point — instruction explicitly says do NOT add the counter to `/ae:retrospect` or `/ae:plugin-stats` in v1.

### MUST_NOT
- [file:not_contains:plugins/ae/skills/review/SKILL.md] Any framing of the cross-family counter as a quality rate, quality percentage, or flip-rate-as-quality measure (the vanity-metric trap rejected in the F-033 discussion).
- [file:not_contains:plugins/ae/skills/review/SKILL.md] Any rendering that counts no-data / missing-`families_invoked` reviews as cross-family failures (denominator must be `known`, not `total`).
