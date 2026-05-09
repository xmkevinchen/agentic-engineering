---
id: code-review-target-aware-diff
target: ae:code-review
layer: 1
source: regression
---

## Expected Behavior

### MUST

#### Argument Inference 3-form ladder (AC1)

- [text:contains] `## Argument Inference` section exists
- [structure:order] `## Argument Inference` heading appears BEFORE `# /ae:code-review` main title
- [text:contains] `### Form 1 — Local file or directory path` heading present
- [text:contains] `### Form 2 — Commit reference / range` heading present
- [text:contains] `### Form 3 — Empty (existing pre-commit behavior)` OR `### Form 3 — Empty` heading present
- [text:contains] Form 1 includes file-existence-wins language: `Wins over Form 2 even if string also matches commit SHA pattern` OR `file-existence wins`
- [text:contains] Form 2 lists `\.\.` range pattern
- [text:contains] Form 2 single SHA resolution: `<sha>~1..<sha>` (single commit → range)
- [text:contains] Form 2 lists `^[a-f0-9]{7,40}$` regex
- [text:contains] Form 3 default = `git diff` AND `git diff --cached`

#### Substitution markers (AC1)

- [text:contains] Marker `{{ TARGET_DIFF_CMD }}` defined
- [text:contains] Marker `{{ TARGET_DIFF_OUTPUT }}` defined
- [text:contains] Substitution table contains rows for Form 1, Form 2 range, Form 2 single SHA, Form 3
- [text:contains] Form 1 substitution: `git diff -- <P>; git diff --cached -- <P>` (both staged AND unstaged)
- [text:contains] Form 2 range substitution: `git diff <R>` (no `--cached`)
- [text:contains] Form 2 single SHA substitution: `git diff <S>~1..<S>`
- [text:contains] Form 3 substitution: `git diff` AND `git diff --cached`

#### Substitution discipline (AC1 enforcement)

- [text:contains] `### TL execution discipline (substitution marker)` heading OR equivalent strict-substitute discipline subsection
- [text:contains] TL `MUST replace these markers` OR `MUST replace tokens` OR `MUST not leave raw` `{{ TARGET_DIFF_CMD }}` token
- [text:contains] Reason for substitute discipline: agents reading literal token would `treat it as quoted string and fail silently`
- [text:contains] Observability trace line `[AE-CODE-REVIEW] Argument inference:` present
- [text:contains] Trace fields include `target=` AND `form=` AND `diff_cmd=`

#### Track 1 + Track 4 wiring (AC2)

- [text:contains] Track 1 review source described as `{{ TARGET_DIFF_CMD }}` (not hardcoded)
- [text:contains] Track 1 default note: Form 3 = `git diff` AND `git diff --cached`
- [text:contains] Track 4 spawn prompt contains `{{ TARGET_DIFF_OUTPUT }}` placeholder
- [text:not_contains] Track 4 spawn prompt body contains the raw text `<current diff>` (replaced by marker)
- [text:contains] Track 4 surrounding text restates substitution discipline (e.g., "Substitution discipline" heading repeated near Track 4)
- [text:contains] Track 4 scope binding still includes "MUST NOT independently query `git diff main...HEAD`" (preserved from existing spec)

#### --reviewer flag scope exclusion (AC3)

- [text:contains] ae:code-review explicitly DOES NOT add `--reviewer` flag (or equivalent statement that --reviewer routes through ae:review)
- [text:contains] Reason: `4-track structure is already multi-reviewer` OR `4-track structure is multi-reviewer by design`

### MUST_NOT

- [text:not_contains] Track 1 body contains the OLD literal `Review \`git diff\` + \`git diff --cached\`.` as the sole hardcoded source (must be replaced by marker)
- [text:not_contains] Track 4 spawn prompt body contains the raw substring `<current diff>` (must be replaced by `{{ TARGET_DIFF_OUTPUT }}`)
- [text:not_contains] argument-hint frontmatter still says ONLY `[files or directory]` (must be updated to reflect target syntax — e.g., `[<target> | files or directory]`)

### SHOULD

- [text:contains] Note that argument-hint was declared 8 months ago but never wired (historical context for why this is "first wire")
- [text:contains] Form 1 file-existence rule mentions `hex-filename collision` avoidance OR equivalent rationale
