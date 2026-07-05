---
id: syn-test-layer
title: "Test layer — runtime fixtures, sh-tap contract, blind protocol"
created: 2026-07-04
written_by: batch
state: fresh
anchors:
  - source: "plugins/ae/tests/scripts/test-graph-lint.sh:4"
    anchor_hash: "# sh-tap output (parser: sh-tap.v1). Fixture trees are built at runtime in a tmpdir"
  - source: "plugins/ae/skills/test-plugin/SKILL.md:40"
    anchor_hash: "This skill uses a blind execution model to prevent self-easy-test bias:"
    commit: 1069a4f
---

Deterministic tests here mostly build their fixture worlds at runtime in a tmpdir; a few schema-stable static fixture trees remain by exception (plugins/ae/tests/scripts/test-graph-lint.sh:4). Judgment, unanchored: the reason is drift — committed fixtures rot against evolving schemas, while a runtime-built fixture is immune to that class (hashes, git SHAs, and layouts are minted fresh every run; the author can still build a wrong fixture — construction kills drift, not error). Judgment, unanchored: the sh-tap output contract exists for the consumer side — a parser can count ok-lines, so a test that silently checks nothing is distinguishable from one that passed.

LLM-behavior testing runs on a different axis: the blind execution model keeps the executing session blind to the assertions it will be judged against — prompts and assertions are authored apart, though one test-lead still both generates cases and judges output, so the blindness sits between execution and assertions, not in a full author/judge split (plugins/ae/skills/test-plugin/SKILL.md:40). Judgment, unanchored: the layer's overall shape is two non-overlapping trust tools — runtime-built determinism for machine claims, structural blindness for judgment claims — and adding a third kind should be treated as a design smell until proven otherwise.
