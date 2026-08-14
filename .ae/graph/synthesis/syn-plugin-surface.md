---
id: syn-plugin-surface
title: "Plugin surface — marketplace shell, ae plugin core, host-supplied namespace"
created: 2026-07-30
written_by: batch
state: fresh
judge: {value: pass, rationale: "corrected under F-079 after CC 2.1.216 inverted the naming rule the prior version asserted as fact; re-grounded against the rewritten CLAUDE.md lines and the oracle that now enforces name == directory"}
anchors:
  - source: "plugins/ae/.claude-plugin/plugin.json:2"
    anchor_hash: "\"name\": \"ae\","
  - source: "CLAUDE.md:39"
    anchor_hash: "- SKILL.md `name` field is the bare skill segment (e.g. `name: plan`), matching its directory"
    commit: 9e33b5e
  - source: "CLAUDE.md:40"
    anchor_hash: "- Claude Code prepends the plugin namespace itself, so `name: plan` autocompletes as `/ae:plan`"
  - source: "plugins/ae/scripts/ae-test-plugin-regression-layer1.sh:55"
    anchor_hash: "[ \"$nm\" = \"$base\" ] \\"
---

The repository is two products nested: the root carries the marketplace manifest plus contributor-facing docs, while all product logic lives under the plugin named at plugins/ae/.claude-plugin/plugin.json:2. Judgment, unanchored: the separation exists so the repo can host future sibling plugins without moving the current one — the marketplace is a shell, never a home for logic.

A skill's name is the bare directory segment (CLAUDE.md:39); the plugin namespace is supplied by the host, not written into the file, and `name: plan` is precisely what makes `/ae:plan` appear (CLAUDE.md:40). This inverts the rule the page previously recorded. Until Claude Code 2.1.216 the frontmatter name replaced the whole command, so spelling the prefix out was what kept a skill on its namespace; 2.1.216 made the prefix unconditional and turned the same value into a doubled `/ae:ae:plan`.

Judgment, unanchored: what the convention encodes is therefore not "spell everything out" but "assert what the host derives". The L1 oracle compares each name against its own directory (plugins/ae/scripts/ae-test-plugin-regression-layer1.sh:55), which is why the field is kept rather than deleted — it is optional and defaults to the directory, so writing it makes an otherwise silent duplicate into a checkable invariant. The older instinct survives in a narrower form: the install cache still holds until a reinstall, so a fix in the working tree is not yet a fix in the user's session.
