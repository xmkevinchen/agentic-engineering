---
id: discuss-steering-readout-required
target: ae:discuss
layer: 1
source: regression
---

## Expected Behavior

### MUST

#### Steering Readout block present + mandatory (AC1)

- [text:contains] §6 contains a `## Steering Readout` reference (the user-facing block heading, shown as inline code in the live-prose instruction)
- [text:contains] §6 marks the readout `REQUIRED` or `MANDATORY` in live prose (e.g. "TL MUST emit")
- [text:contains] §6 readout is described as `decision-first` (TL judgment leads)
- [text:contains] §6 states the redirect CTA is secondary / "does NOT replace the judgment" / not an "A/B/C options dump"

#### Triage instruction names the ranking dimension (AC1 — anti-token-mention)

- [text:contains] §6 names the ranking dimension `stakes × reversibility` (not just the word "triage")
- [text:contains] §3 (Discussion Rounds / TL moderator) contains a pointer tying triage by `stakes × reversibility` after exploration to the Step 6 Steering Readout

#### Enforcement properties (AC1)

- [text:contains] §6 contains a "No silence" rule (mandatory every round; explicit `no triage` line rather than omission)
- [text:contains] §6 contains `Detail scales with contention` (or equivalent scaling bound)
- [text:contains] §6 contains `open disagreement` AND `no boilerplate` (the substantive-entry requirement for contested topics)
- [structure:order] The `Triage` part appears BEFORE the `Redirect?` part within the Steering Readout spec (decision-first ordering)

### MUST_NOT

- [text:not_contains_in_block] The user-facing Steering Readout block does NOT instruct embedding internal bookkeeping terms (`§1.5.3`, `synthesis-gate`, `UAG`) in the user-facing readout — it explicitly excludes them
- [structure] `## Steering Readout` is NOT introduced solely as a sample line inside a ``` code fence with no live-prose requiredness statement (it must be a mandatory instruction, not just a template)

### SHOULD

- [text:format] The readout spec keeps the block in plain language (no jargon dump), consistent with F-036's anti-mechanical-output goal
- [text:contains] §6 requires the first post-exploration readout to carry a non-empty `parked:` list when noise was cut
