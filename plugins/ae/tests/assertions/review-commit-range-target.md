---
id: review-commit-range-target
target: ae:review
layer: 1
source: regression
---

## Expected Behavior

### MUST

#### Argument Inference 3-form ladder (AC1)

- [text:contains] `## Argument Inference` section exists
- [text:contains] `### Form 1 — Local file or directory path` heading present
- [text:contains] `### Form 2 — Commit reference / range` heading present
- [text:contains] `### Form 3 — Empty OR non-matching free-text` heading present
- [text:contains] Form 1 says `file-existence wins over pattern match` OR `Wins over Form 2 even if string also matches commit SHA pattern`
- [text:contains] Form 2 lists `\.\.` (double dot for range)
- [text:contains] Form 2 lists regex `^[a-f0-9]{7,40}$`
- [text:contains] Form 2 lists `^HEAD~?[0-9]*$`
- [text:contains] Form 3 mentions both `Empty` and `Non-matching free-text`
- [text:contains] Form 3 non-matching free-text path includes `Unrecognized argument format` refusal text

#### Form ambiguity resolution discipline (AC1)

- [text:contains] `### Form ambiguity resolution` subsection exists
- [text:contains] Resolution states TL `MUST first run` `test -f` AND `test -d` via Bash
- [text:contains] Observability trace line `[AE-REVIEW] Argument inference:` present in spec
- [text:contains] Trace fields include `target=` AND `file_check=` AND `form=`

#### Pre-checks router (AC2)

- [text:contains] `Target-mode router` subsection exists
- [structure:order] `Target-mode router` appears BEFORE `Check 1: Agent Teams`
- [text:contains] Router specifies ad-hoc mode skips `Check 2` AND `Check 3` AND `Check 4` AND `Check 5`
- [text:contains] Router specifies `Check 1 (Agent Teams) still applies` in ad-hoc mode

#### --reviewer flag override semantics (AC3)

- [text:contains] `### \`--reviewer <name>\` flag` subsection exists
- [text:contains] Flag is `repeatable` OR `one or more` `--reviewer` flags allowed
- [text:contains] Override is described as `NOT additive` OR `skip the default Agent Selection Reference table entirely`
- [text:contains] WRONG/CORRECT example present (additive interpretation labeled WRONG)
- [text:contains] Unknown reviewer name → `hard fail` (no silent skip)
- [text:contains] Flag is orthogonal to `<target>` argument
- [text:contains] Forward-reference: `--add-reviewer` deferred to `v0.11.x` OR explicit "deferred" language

#### Output write target rule 3-case (AC4)

- [text:contains] Write target rule lists case `(a) Feature-dir plan`
- [text:contains] case `(b) Legacy plan`
- [text:contains] case `(c) Ad-hoc target OR re-review OR \`--reviewer\` flag`
- [text:contains] case (c) writes to `output.reviews/adhoc/<id>-<ISO8601>` (or equivalent path with `adhoc/` subdir + ISO8601 timestamp)
- [text:contains] Cross-skill contract note: `non-recursive glob` `naturally excludes adhoc/`
- [text:contains] dashboard/next/plugin-stats/retrospect do NOT scan adhoc/ subdir (or equivalent contract statement)

#### Frontmatter required-fields-by-mode (AC4)

- [text:contains] Pipeline mode frontmatter shows `verdict: pass` OR `verdict: fail`
- [text:contains] Pipeline mode states verdict is `required`
- [text:contains] Ad-hoc mode frontmatter shows `mode: adhoc` field
- [text:contains] Ad-hoc mode frontmatter shows `reviewers:` list field
- [text:contains] Ad-hoc mode states verdict `MUST be omitted` OR `omitted in ad-hoc mode`

### MUST_NOT

- [text:not_contains] Old single-rule Argument Inference text "scan for the most recent plan with all steps completed" appears as the SOLE inference logic (must be inside Form 3 only)
- [text:not_contains] Output section lists `review-2.md` OR `review-3.md` OR `sequential numbering` (deprecated by C3 — unified adhoc/ path replaces it)

### SHOULD

- [text:contains] Scale anchor present: explanation that default selection table = `4-5` reviewers (so user understands `--reviewer challenger` is scope reduction, not addition)
- [text:contains] `--reviewer` flag NOT applicable to ae:code-review (4-track structure is multi-reviewer by design)
