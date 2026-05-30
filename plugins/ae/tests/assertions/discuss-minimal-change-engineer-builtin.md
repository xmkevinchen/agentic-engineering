---
id: discuss-minimal-change-engineer-builtin
target: ae:discuss
layer: 1
source: regression
---

## Expected Behavior

### MUST

#### Vendored agent file exists with correct provenance metadata

- [file:exists] `plugins/ae/agents/engineering/minimal-change-engineer.md`
- [file:contains] Vendored agent file frontmatter contains `name: minimal-change-engineer`
- [file:contains] Vendored agent file contains maintainer note comment block including: `Maintainer note (not part of agent prompt)` AND `Vendored from agency-agents` (or equivalent) AND `Source SHA:` AND `Vendor date:` AND `Vendor policy: BODY VERBATIM`
- [file:contains] Maintainer note Source SHA is `fd35c99ecc4b881d92bb9a3bf0be2d70eb06c2df`
- [file:contains] Maintainer note Source SHA line includes the qualifier `snapshot at vendor date` or equivalent (regret Doodlestein hedge — not a live sync anchor)

#### NOTICE.md exists with MIT attribution

- [file:exists] `plugins/ae/NOTICE.md`
- [file:contains] NOTICE.md contains `MIT License` (full standard text or header)
- [file:contains] NOTICE.md references `agency-agents`
- [file:contains] NOTICE.md contains the same Source SHA `fd35c99ecc4b881d92bb9a3bf0be2d70eb06c2df` matching the agent file maintainer note
- [file:contains] NOTICE.md references the bundled file path `plugins/ae/agents/engineering/minimal-change-engineer.md`

#### discuss/SKILL.md §1.5.1 uses ae:engineering: prefix

- [text:contains] `plugins/ae/skills/discuss/SKILL.md` contains `subagent_type: "ae:engineering:minimal-change-engineer"`
- [text:contains] §1.5.1 preflight discovery list references `plugins/ae/agents/engineering/minimal-change-engineer.md`
- [text:contains] §1.5.1 preflight NOT-FOUND handling uses time-invariant wording (e.g. `not found in any location` / `NOT FOUND` — generic presence-check phrasing) rather than a historical-time-anchored phrase (pairs with the MUST_NOT below; strategic Doodlestein: time-invariant warning)

### MUST_NOT

- [text:not_contains] `plugins/ae/skills/discuss/SKILL.md` MUST NOT contain `subagent_type: "engineering-minimal-change-engineer"` (the bare-name format without `ae:engineering:` prefix — old format must be fully replaced)
- [text:not_contains] §1.5.1 preflight warning MUST NOT contain `post-F-011` or any other historical-time-anchored phrasing (long-term confusion guard per strategic Doodlestein)

### SHOULD

- [file:contains] Maintainer note in vendored agent file uses HTML comment syntax (`<!--` / `-->`) so CC agent loader can parse without disrupting the agent prompt body
- [text:contains] §1.5.1 spawn template `Honor the Frozen-field rule defined in §1.5.1 above.` line still present immediately under `framing_context:` for the minimal-change-engineer agent (F-010 invariant survives F-011 edits)
