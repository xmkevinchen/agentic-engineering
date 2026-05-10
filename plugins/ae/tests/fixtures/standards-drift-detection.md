---
fixture_id: "standards-drift-detection"
feature: "F-015"
purpose: "Detect byte/semantic drift between canonical output-standards.md and inline blocks in ae:work, ae:review, ae:plan, ae:discuss"
created: 2026-05-10
---

# Standards Drift Detection Fixture

## Golden Standard Sections (from plugins/ae/output-standards.md)

### Section 1: Four Standards Table

Expected content in `plugins/ae/output-standards.md`:

```
| Dimension | Standard |
|---|---|
| Session process output | First line = core point, clear at a glance |
| Session phase summary | `---` separator + obvious title, self-contained to 90%+ |
| Documentation | Clear hierarchy: pyramid tip ≤ 5 lines, lower layers archived |
| Closed loop | User can understand and judge 90%+ without opening documents |
```

**Assertion**: All 4 rows present with exact wording (case-insensitive match acceptable for markdown formatting).

### Section 2: Inline Block Golden (ae:work + ae:review)

Expected content in both `skills/work/SKILL.md` and `skills/review/SKILL.md`:

```
<!-- ae-output-standards-v1 -->
**AE Output Standards (Summary)**:
- First line = core point (clear at a glance)
- Phase summary segmented by `---`, self-contained 90%+
- Docs: pyramid tip ≤ 5 lines, details archived
- Closed loop: user can judge 90%+ without opening docs

See [AE Output Standards](../../output-standards.md) for full reference.
<!-- /ae-output-standards-v1 -->
```

**Assertion 1**: Comment headers `<!-- ae-output-standards-v1 -->` and `<!-- /ae-output-standards-v1 -->` present in both files (markers for sync points).

**Assertion 2**: 4-point list (with `-` bullets) present in both files, matching golden wording.

**Assertion 3**: Link to `../../output-standards.md` resolvable from `skills/work/` and `skills/review/` (2 levels up to plugin root).

### Section 3: Pointer Golden (ae:plan + ae:discuss)

Expected content in both `skills/plan/SKILL.md` and `skills/discuss/SKILL.md`:

```
<!-- ae-output-standards-pointer-v1 -->
Adhere to [AE Output Standards](../../output-standards.md) in ...
<!-- /ae-output-standards-pointer-v1 -->
```

**Assertion 1**: Comment headers `<!-- ae-output-standards-pointer-v1 -->` and `<!-- /ae-output-standards-pointer-v1 -->` present in both files.

**Assertion 2**: Link to `../../output-standards.md` present and resolvable (2 levels up).

## Test Execution

### Manual Verification Steps

1. **Check canonical doc exists**:
   ```bash
   [ -f plugins/ae/output-standards.md ] && echo "PASS: canonical doc exists" || echo "FAIL: missing canonical doc"
   ```

2. **Check inline blocks in ae:work + ae:review**:
   ```bash
   for file in plugins/ae/skills/work/SKILL.md plugins/ae/skills/review/SKILL.md; do
     grep -q "ae-output-standards-v1" "$file" && echo "PASS: $file has marker" || echo "FAIL: $file missing marker"
   done
   ```

3. **Check pointers in ae:plan + ae:discuss**:
   ```bash
   for file in plugins/ae/skills/plan/SKILL.md plugins/ae/skills/discuss/SKILL.md; do
     grep -q "ae-output-standards-pointer-v1" "$file" && echo "PASS: $file has pointer marker" || echo "FAIL: $file missing pointer marker"
   done
   ```

4. **Check path resolution** (layer count):
   ```bash
   # From skills/work/SKILL.md: ../../ goes up to plugins/ae/
   # Verify relative path has correct depth
   grep "../../output-standards.md" plugins/ae/skills/work/SKILL.md && echo "PASS: work path correct" || echo "FAIL: work path incorrect"
   grep "../../output-standards.md" plugins/ae/skills/review/SKILL.md && echo "PASS: review path correct" || echo "FAIL: review path incorrect"
   ```

5. **Line count delta check**:
   ```bash
   CANONICAL_LINES=$(wc -l < plugins/ae/output-standards.md)
   WORK_LINES=$(grep -A 5 "ae-output-standards-v1" plugins/ae/skills/work/SKILL.md | head -7 | wc -l)
   REVIEW_LINES=$(grep -A 5 "ae-output-standards-v1" plugins/ae/skills/review/SKILL.md | head -7 | wc -l)
   echo "Canonical: $CANONICAL_LINES lines, Work inline: $WORK_LINES lines, Review inline: $REVIEW_LINES lines"
   # Inline blocks should be ~7-8 lines (comment + title + 4 bullets + link + comment close)
   ```

## Fixture Status

- **Created**: 2026-05-10
- **Last Verified**: (to be filled after Step 5 execution)
- **Result**: PASS / FAIL (to be filled)

## Notes

This fixture is committed BEFORE inline block commits (Step 4 before Steps 2-3 in original plan, but actually written and committed after inline edits here). If drift is detected, rerun fixture to identify mismatches:
- Canonical doc sections vs. inline block content
- Path depths (../../ vs. other depths)
- Comment header markers (exact match)

Fixture can be re-run after any standards updates to ensure consistency.
