---
name: ae:retrospect
description: Analyze pipeline execution history — read Outcome Statistics, generate trends and actionable insights
user_invocable: true
---

# /ae:retrospect — Pipeline Retrospective

Analyze historical Outcome Statistics from `/ae:review` output to identify trends and generate actionable insights.

## Input

- `$ARGUMENTS`: optional filter — feature name, time range, or "all"
- `--compare ID1 ID2`: comparison mode — compare two existing retrospect reports by their ID (e.g., `/ae:retrospect --compare 001 003`). IDs correspond to the `id` field in retrospect report frontmatter.
- Default (no flags): analyze all available data in `docs/reviews/` and generate a snapshot report

## Pre-check

1. Read `pipeline.yml` → `output.reviews` (default: `docs/reviews/`) and `output.analyses` (default: `docs/analyses/`)
2. If `--compare ID1 ID2`:
   - Scan `output.analyses` for retrospect reports matching both IDs (files with `type: retrospect` in frontmatter — exclude `type: retrospect-comparison`)
   - If either ID matches a `type: retrospect-comparison` file → output: "比较失败：不支持对比较报告再次比较，请指定 type 为 retrospect 的报告 ID。"
   - If either ID not found → output: "比较失败：未找到 ID 为 [ID] 的 retrospect 报告。请确认报告 ID 存在于 `docs/analyses/` 中。"
   - If both found → skip to Step 5 (Comparison Mode)
3. Scan for review files containing Outcome Statistics
4. If no data found → output: "数据不足：尚无 Outcome Statistics。请先完成至少一次 `/ae:review` 以产出数据。"

## Step 1: Collect Outcome Statistics

Read all review files in `output.reviews` directory. Extract these 5 metrics from each:

| Metric | Source | What it measures |
|--------|--------|-----------------|
| Steps completed | `Steps completed: N/M` | Plan execution completeness |
| Rework rate | `Rework rate: X steps needed fixup commits` | Implementation quality |
| P1 escape rate | `P1 escape rate: Z P1 findings discovered` | Pre-commit check effectiveness |
| Drift events | `Drift events: D contract violations` | Plan adherence |
| Auto-pass rate | `Auto-pass rate: P steps auto-continued / N total` | Automation effectiveness |

Parse each metric into structured data. Handle missing fields gracefully (some reviews may predate certain metrics).

## Step 2: Analyze Trends

If multiple data points exist:
- **Trend direction**: improving / stable / degrading for each metric
- **Outliers**: features with unusually high rework or P1 escape rates
- **Correlations**: e.g., high drift events correlating with high rework rate

If single data point:
- **Baseline establishment**: record as first data point, note that trends require 2+ reviews

## Step 3: Generate Actionable Insights

For each metric that shows a pattern:

- **Rework rate high** → "Gate conditions may be too loose — consider strengthening pre-commit checks for [specific area]"
- **P1 escape rate > 0** → "Pre-commit review missed critical issues — review checklist coverage for [pattern]"
- **Drift events frequent** → "Plan step granularity may be insufficient — consider more detailed Expected files in plans"
- **Auto-pass rate low** → "Many steps require manual intervention — review gate conditions for false positives"
- **Steps completion < 100%** → "Plans may be over-scoped — consider smaller step decomposition"

## Step 4: Output

Write report to `pipeline.yml` → `output.analyses` (default: `docs/analyses/`) as `NNN-retrospect-slug.md` (NNN = next available sequence number in `output.analyses` directory):

```markdown
---
id: "NNN"
title: "Retrospect: [scope]"
type: retrospect
created: YYYY-MM-DD
data_sources: N review files
---

# Pipeline Retrospect: [scope]

## Data Summary

| Feature | Steps | Rework | P1 Escape | Drift | Auto-pass |
|---------|-------|--------|-----------|-------|-----------|
| [feature] | N/M | X% | Z | D | P% |

## Trends
[Trend analysis per metric]

## Actionable Insights
[Specific recommendations with evidence]

## Recommendations
[Prioritized list of pipeline improvements]
```

**Comparison report** (when `--compare` is used): write to same directory as `NNN-comparison-ID1-vs-ID2.md` (NNN = next available sequence number):

```markdown
---
id: "NNN"
title: "Comparison: [report A title] vs [report B title]"
type: retrospect-comparison
created: YYYY-MM-DD
compared: ["ID1", "ID2"]
---

# Pipeline Comparison: [report A] vs [report B]

## Delta Summary

| Metric | [Report A] | [Report B] | Change |
|--------|------------|------------|--------|
| Steps completed | N1/M1 | N2/M2 | ↑ +X |
| Rework rate | X1% | X2% | ↓ -Ypp |
| P1 escape rate | Z1 | Z2 | ↓ -N |
| Drift events | D1 | D2 | ↑ +N |
| Auto-pass rate | P1% | P2% | ↑ +Xpp |

## Analysis
[Which metrics improved, which degraded, potential causes]

## Recommendations
[Based on delta patterns]
```

**You MUST call the Write tool to save the output file. Displaying results in conversation is not sufficient.**

Show summary to user.

## Step 5: Comparison Mode

Triggered when `--compare ID1 ID2` is provided (Pre-check validates both IDs exist).

### 5.1 Read Reports
Read both retrospect reports from `output.analyses`. Parse the `## Data Summary` table from each.

### 5.2 Extract Metrics
For each report, extract the 5 metrics from the Data Summary table row(s). If a metric is missing in one report, mark as `N/A` in comparison.

### 5.3 Calculate Delta

Compute delta for each metric and assign direction arrow based on improvement direction:

| Metric | Improving direction | Arrow meaning |
|--------|-------------------|---------------|
| Steps completed | ↑ higher = better | ↑ = improving, ↓ = degrading |
| Rework rate | ↓ lower = better | ↓ = improving, ↑ = degrading |
| P1 escape rate | ↓ lower = better | ↓ = improving, ↑ = degrading |
| Drift events | ↓ lower = better | ↓ = improving, ↑ = degrading |
| Auto-pass rate | ↑ higher = better | ↑ = improving, ↓ = degrading |

Delta format: arrow + absolute value (e.g., `↓ -2`, `↑ +15pp`). No raw percentages; `pp` (percentage points) is used for rate metrics to express absolute difference between two rates.

If delta is zero → `— 0` (no arrow).

### 5.4 Generate Analysis
Based on delta patterns, generate brief analysis:
- Which metrics improved and potential causes
- Which metrics degraded and recommended actions
- If all metrics stable → note pipeline consistency

### 5.5 Write Output
Write comparison report using the comparison template from Step 4.

### Edge Cases
- **Report format mismatch**: If one report uses an older format without all 5 metrics → compare only shared metrics, note: "指标 [name] 在报告 [ID] 中缺失，已跳过。"
- **Same ID twice**: → "比较失败：两个 ID 相同，请指定不同的报告 ID。"
- **Only one retrospect report exists**: → "比较失败：仅找到 1 份 retrospect 报告，至少需要 2 份。"

## Next Steps

Based on retrospect output, suggest:
- If insights are actionable → "Consider `/ae:discuss` to decide on pipeline improvements, or `/ae:plan` to implement directly"
- If data is insufficient → "Continue running pipeline (`/ae:work` → `/ae:review`) to accumulate more data points"
- If all metrics healthy → "Pipeline is performing well. No immediate action needed"
- If comparison shows degradation → "Consider `/ae:analyze` to investigate root cause of degraded metrics"
- If 2+ retrospect reports exist and user ran snapshot mode → "Use `/ae:retrospect --compare ID1 ID2` to compare trends"
