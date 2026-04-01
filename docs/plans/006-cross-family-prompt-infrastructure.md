---
id: "006"
title: "Cross-family Prompt Infrastructure — Discussion 007 Implementation"
type: plan
created: 2026-03-31
status: done
discussion: "docs/discussions/007-codex-plugin-learnings/conclusion.md"
---

# Feature: Cross-family Prompt Infrastructure

## Goal
Implement Discussion 007's 5 converged decisions to strengthen cross-family (Codex/Gemini) communication quality — output format, adversarial review, result handling, and tool constraint documentation.

## Steps

### Step 1: Strengthen proxy agent definitions — prompting + output format + result handling (AC1, AC2, AC3)

Modify `codex-proxy.md` and `gemini-proxy.md` in one pass (T1+T2+T4 merged per Discussion 007 conclusion):

**T1 — Prompting guidance**:
- [x] Add task-type-aware prompt assembly section: when TL specifies task type (review/consensus/analyze), proxy selects matching output template
- [x] Add prompt quality checklist: Role + Task + Context + Output Format must all be present before querying external model

**T2 — Output format verification**:
- [x] Add verification instruction block: after receiving external model response, proxy self-checks response contains all required sections (existing output format: Findings / Unique Insights / Agreements)
- [x] Note: keep existing output format, do not add new per-task-type templates (Discussion 007 decided "Markdown + verification", not "new template system")

**T4 — Result handling rules**:
- [x] Rule 1: Preserve original structure — don't reorder verdict/findings/next_steps
- [x] Rule 2: Preserve evidence boundaries — mark inference vs fact from external model
- [x] Rule 3: No second-pass rewriting — translate, don't editorialize
- [x] Rule 4: No auto-fix — code snippets as suggestions OK, execution instructions NOT OK. Include concrete examples:
  - OK: "Consider adding `db_index=True` to this field (see migration_file.py:34)"
  - OK: "This pattern may cause N+1; a batched query would look like: [code snippet]"
  - NOT OK: "Run `python manage.py migrate` to apply the fix"
  - NOT OK: "Execute: git stash && git rebase main"
- [x] Rule 5: Fail honestly — if external model call fails, SendMessage to Lead explaining failure; do NOT substitute with own analysis

Expected files: `plugins/ae/agents/workflow/codex-proxy.md`, `plugins/ae/agents/workflow/gemini-proxy.md`

### Step 2: Strengthen challenger adversarial review (AC4, AC5)

Modify `challenger.md` to add:

- [x] Add `## Attack Surface` section with scene-tagged checklists:
  - `[CODE REVIEW]`: auth/permissions, data loss, rollback safety, race conditions, empty-state handling, version skew, observability gaps
  - `[DESIGN DISCUSSION]`: assumption validity, alternative approaches, scope creep, reversibility risk, dependency risks, missing stakeholders
- [x] Add `## Calibration Rules`:
  - Quality > quantity: prefer one strong finding over several weak ones
  - Do not dilute serious issues with filler
  - Cross-family agreement reduces false positives but does NOT increase severity
- [x] Add `## Finding Bar`: each finding must answer 4 questions (what can go wrong / why vulnerable / impact / fix)

Expected files: `plugins/ae/agents/workflow/challenger.md`

### Step 3: Add intentional exclusion comments to reviewer agents (AC6)

- [x] Add "Write/Edit intentionally excluded — review only" note to each reviewer agent. **Important**: place as markdown comment or text line AFTER frontmatter `---` block, NOT as YAML inline comment on `tools:` line (risk of breaking frontmatter parsing)
- [x] Verify no reviewer agent has Write or Edit in tools (should already be true)

Expected files: `plugins/ae/agents/review/code-reviewer.md`, `plugins/ae/agents/review/security-reviewer.md`, `plugins/ae/agents/review/architecture-reviewer.md`, `plugins/ae/agents/review/performance-reviewer.md`, `plugins/ae/agents/review/simplicity-reviewer.md`

### Step 4: Version bump + changelog (AC7)

- [x] Bump version in `plugins/ae/.claude-plugin/plugin.json` (patch bump)
- [x] Add changelog entry in `CHANGELOG.md` (include note: AGENT_CONTRACT.md and MCP middleware as future evolution direction per Doodlestein)
- [x] Verify README component counts still accurate

Expected files: `plugins/ae/.claude-plugin/plugin.json`, `CHANGELOG.md`, `README.md`

## Acceptance Criteria

### AC1: Proxy Definition Completeness
Both `codex-proxy.md` and `gemini-proxy.md` contain: prompt quality checklist, verification instruction block, and 5 result handling rules. Verified by: grep for sections related to prompt assembly, verification, and result handling in both files.

### AC2: Prompt Assembly Quality
Proxy definitions include prompt quality checklist requiring Role + Task + Context + Output Format. Verified by: grep for "prompt quality" or "assembly checklist" in both proxy files.

### AC3: Result Handling No-Auto-Fix Boundary
Result handling rules explicitly distinguish allowed (code snippets as suggestions) from disallowed (execution instructions). Verified by: reading Rule 4 text in both proxy files.

### AC4: Challenger Attack Surface Scenes
`challenger.md` contains attack surface checklists tagged with `[CODE REVIEW]` and `[DESIGN DISCUSSION]`. Verified by: grep for both tags in challenger.md.

### AC5: Challenger Calibration Rules
`challenger.md` contains calibration rules including "quality > quantity" and "cross-family agreement ≠ severity increase". Verified by: grep for "Calibration" in challenger.md.

### AC6: Reviewer Tool Comments
All 5 reviewer agent files contain `# Write/Edit intentionally excluded` comment on or near `tools:` line. Verified by: grep across `plugins/ae/agents/review/*.md`.

### AC7: Version Bump
`plugin.json` version incremented (patch), `CHANGELOG.md` has entry for this change. Verified by: reading both files.
