---
id: review-cross-family-counter
target: ae:review
layer: 1
source: regression
---

## Context
F-033: `/ae:review` Outcome Statistics emits a raw DESCRIPTIVE cross-family participation counter (how many reviews ran ≥2 model families at full state, over reviews carrying family-tracking data) — NOT a quality metric. The F-033 discussion rejected any participation-rate-sold-as-quality (vanity metric) and deferred the principled flip-rate metric to BL-115. Reviews with no `families_invoked` data must NOT be read as cross-family failures, so the line discloses coverage (`known/total`).

## Prompt
Read `plugins/ae/skills/review/SKILL.md` `## Outcome Statistics` section. Confirm: (a) whether it emits a cross-family participation line sourced from `cross-family-counter.sh`; (b) whether that line is framed as a raw descriptive count or as a quality rate / percentage; (c) whether it discloses coverage so no-data reviews are not counted as failures; (d) whether it defers the quality metric to BL-115; (e) whether it adds the counter to `/ae:retrospect` or `/ae:plugin-stats` (it should NOT in v1).
