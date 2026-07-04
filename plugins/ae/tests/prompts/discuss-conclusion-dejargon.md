---
id: discuss-conclusion-dejargon
target: ae:discuss
layer: 1
source: regression
---

## Context

F-036 de-jargons the §8 conclusion template in `plugins/ae/skills/discuss/SKILL.md` to align with F-015 AE Output Standards: the Team Composition table is deleted (no downstream reader), the Process Metadata block is slimmed to only its two `/ae:plan` dual-sentinel fields (`Autonomous decisions:` + `User escalations:`) with a KEEP comment, the Doodlestein Review section moves below Next Steps (audit-trail), and a prose-alignment pointer to AE Output Standards is added. CRITICAL: the `## Process Metadata` header AND the two fields must survive because plan/SKILL.md reads them as dual sentinels (header ~:106, body ~:110). This test verifies the deletions landed AND both sentinels are preserved.

## Prompt

Read `plugins/ae/skills/discuss/SKILL.md` §8 conclusion template and answer:

1. Has the `## Team Composition` table been removed from the §8 conclusion template?
2. Is the `## Process Metadata` header still present?
3. Are the two sentinel fields `Autonomous decisions:` and `User escalations:` still present in the Process Metadata block?
4. Have the 4 lower-signal count lines (`Discussion rounds:`, `Topics ... total`, `Doodlestein challenges:`, `Deferred resolved in Sweep`) been removed?
5. Is there a KEEP comment explaining the Process Metadata header + 2 fields are /ae:plan dual-sentinel dependencies?
6. Does the `## Doodlestein Review` section now appear AFTER `## Next Steps` (audit-trail, below the fold)?
7. Is there a prose-alignment pointer to AE Output Standards for conclusion prose (decision-first, risks explicit, rejected-alts in audit trail)?
8. Is the `entities:` frontmatter field + Entity extraction instruction still present (untouched — consumed by ae:next's "Has discussion" heuristic)?
