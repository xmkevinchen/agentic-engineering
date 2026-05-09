---
id: discuss-minimal-change-engineer-builtin
target: ae:discuss
layer: 1
source: regression
---

## Context

F-011 vendored `engineering-minimal-change-engineer.md` from agency-agents (MIT) into AE plugin built-ins at `plugins/ae/agents/engineering/minimal-change-engineer.md`. ae:discuss §1.5.1 spawn template updated to use `ae:engineering:minimal-change-engineer` subagent_type. NOTICE.md added at plugin root for MIT attribution. This fixture is a **regression guard** ensuring the vendor structure + spawn template + attribution stay coherent across future SKILL.md edits.

## Prompt

Read these files and answer:

1. Does `plugins/ae/agents/engineering/minimal-change-engineer.md` exist? What does its frontmatter contain (`name:`, `description:`, `color:`, `emoji:`)?

2. Does the file contain a maintainer note comment block after the frontmatter? Does the comment block reference: (a) "Vendored from agency-agents", (b) a specific upstream Source SHA, (c) a Vendor date, (d) "Vendor policy is VERBATIM"?

3. Does `plugins/ae/NOTICE.md` exist? Does it contain: (a) "MIT License" header, (b) reference to "agency-agents" project, (c) the same Source SHA as the agent file's maintainer note, (d) the bundled file path?

4. Does `plugins/ae/skills/discuss/SKILL.md` §1.5.1 spawn template use `subagent_type: "ae:engineering:minimal-change-engineer"` (with `ae:engineering:` prefix)?

5. Does the SKILL.md no longer contain the bare `subagent_type: "engineering-minimal-change-engineer"` (without `ae:engineering:` prefix) anywhere?

6. Does §1.5.1 preflight discovery list mention `plugins/ae/agents/engineering/minimal-change-engineer.md` as the plugin built-in default location?
