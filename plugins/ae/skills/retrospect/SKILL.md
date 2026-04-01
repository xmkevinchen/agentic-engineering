---
name: ae:retrospect
description: Analyze pipeline execution history — read Outcome Statistics, generate trends and actionable insights
user_invocable: true
---

# /ae:retrospect — Pipeline Retrospective

Analyze historical Outcome Statistics from `/ae:review` output to identify trends and generate actionable insights.

## Input

- `$ARGUMENTS`: optional filter — feature name, time range, or "all"
- Default: analyze all available data in `docs/reviews/`

## Pre-check

1. Read `pipeline.yml` → `output.reviews` (default: `docs/reviews/`)
2. Scan for review files containing Outcome Statistics
3. If no data found → output: "数据不足：尚无 Outcome Statistics。请先完成至少一次 `/ae:review` 以产出数据。"

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

Write report to `pipeline.yml` → `output.analyses` (default: `docs/analyses/`) as `NNN-retrospect-slug.md`:

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

**You MUST call the Write tool to save the output file. Displaying results in conversation is not sufficient.**

Show summary to user.

## Next Steps

Based on retrospect output, suggest:
- If insights are actionable → "Consider `/ae:discuss` to decide on pipeline improvements, or `/ae:plan` to implement directly"
- If data is insufficient → "Continue running pipeline (`/ae:work` → `/ae:review`) to accumulate more data points"
- If all metrics healthy → "Pipeline is performing well. No immediate action needed"
