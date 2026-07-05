---
id: syn-plugin-surface
title: "Plugin surface — marketplace shell, ae plugin core, explicit naming"
created: 2026-07-04
written_by: batch
state: fresh
anchors:
  - source: "plugins/ae/.claude-plugin/plugin.json:2"
    anchor_hash: "\"name\": \"ae\","
  - source: "CLAUDE.md:39"
    anchor_hash: "- SKILL.md `name` field MUST include `ae:` prefix (e.g. `name: ae:plan`)"
    commit: b4cc996
  - source: "CLAUDE.md:40"
    anchor_hash: "- This ensures `/ae:plan` shows in autocomplete, not just `/plan (ae)`"
---

The repository is two products nested: the root carries the marketplace manifest plus contributor-facing docs, while all product logic lives under the plugin named at plugins/ae/.claude-plugin/plugin.json:2. Judgment, unanchored: the separation exists so the repo can host future sibling plugins without moving the current one — the marketplace is a shell, never a home for logic.

Skill names carry an explicit prefix by rule (CLAUDE.md:39), and the reason is user-facing, not aesthetic: an unprefixed skill surfaces as /plan (ae) instead of /ae:plan — findable, but off the namespace users actually type (CLAUDE.md:40). Judgment, unanchored: the deeper convention this encodes is that nothing in the plugin trusts implicit host behavior — names, paths, and versions are always spelled out, because the install cache holds until a reinstall (a version bump is the conventional trigger) and stale implicit state has repeatedly masqueraded as a bug.
