---
name: ae:plugin-stats
description: AE plugin self-development outcome stats (separate from project-level GTD retrospect). Reads `.ae/reviews/*` Outcome Statistics, surfaces trends, and supports comparison reports.
user-invocable: true
---

# /ae:plugin-stats — AE Plugin Self-Development Outcome Stats

Analyze historical Outcome Statistics from `/ae:review` output to identify trends and generate actionable insights about the **AE plugin's own development pipeline** — rework rate, P1 escape rate, drift events, fix-loop triggers, auto-pass rate.

This skill is **independent of project-level GTD retrospect** (`/ae:retrospect`). The split mirrors industry practice: OpenAI evals + Google DORA/Four Keys both separate **delivery metrics** (this skill) from **product retrospective** (`/ae:retrospect`). The skill name is `ae:plugin-stats` to make the scope explicit — it is about the AE plugin self-bootstrapping pipeline's outcome data, not about features the project ships.

## Input

- `$ARGUMENTS`: optional filter — feature name, time range, or "all"
- `--compare ID1 ID2`: comparison mode — compare two existing reports by their `id` field (e.g., `/ae:plugin-stats --compare 001 003`).
- Default (no flags): analyze all available review data and generate a snapshot report. Reviews are read from BOTH `output.reviews/*.md` (legacy `type: review`) AND `.ae/features/{active,done}/F-*/review.md` (Plan 051+ feature-dir reviews) — union scan, no surface-index pointer files.

## Pre-check

1. Read `pipeline.yml` → `output.reviews` (default: `docs/reviews/`) and `output.analyses` (default: `docs/analyses/`).
2. If `--compare ID1 ID2`:
   - Scan `output.analyses` for reports matching both IDs (files with `type: plugin-stats` OR legacy `type: retrospect` in frontmatter — exclude `type: retrospect-comparison` and `type: plugin-stats-comparison`).
   - If ID1 == ID2 → output: "Compare failed: both IDs are the same. Specify two different report IDs."
   - If either ID matches a comparison-type file → output: "Compare failed: comparing a comparison report is not supported. Specify reports with type: plugin-stats (or legacy type: retrospect)."
   - If either ID not found → output: "Compare failed: no plugin-stats report with ID [ID] found. Confirm the ID exists in `docs/analyses/`."
   - If both found → skip to Step 5 (Comparison Mode).
3. Scan for review files containing Outcome Statistics. **Skip files with `type: test-report` in frontmatter** — only process `type: review` documents.
4. If no data found → output: "Insufficient data: no Outcome Statistics found. Complete at least one `/ae:review` to generate data."

### 0.5. Prior Context (from Mengdie)

Run this step after Pre-check and before Step 1. Skip in `--compare` mode.

1. Call `memory_search` MCP tool with "plugin pipeline outcome trends" or `$ARGUMENTS` filter as query.
2. If `memory_search` is not available, fails, or returns no results — emit `Prior context: unavailable (tool not registered / no relevant results)` and continue to Step 1.
3. If results returned with `degraded` field non-null — annotate as "(partial — [degraded reason])".
4. Present results under `## Prior Art from Project Knowledge Base` with provenance (`title`, `source_file`, `knowledge_type`, `valid_from`, `snippet`).
5. Compare prior conclusions with current data in Step 2 — note whether prior insights are confirmed or invalidated.

## Step 1: Collect Outcome Statistics

Read all review files across BOTH locations (union scan — Plan 051+):
- **Legacy reviews**: `output.reviews/*.md` with `type: review` in frontmatter (the 23 historical AE-self-development reviews).
- **Feature-dir reviews**: `.ae/features/{active,done}/F-*/review.md` (Plan 051+ post-migration reviews).

Extract these 5 metrics from each:

| Metric | Source | What it measures |
|---|---|---|
| Steps completed | `Steps completed: N/M` | Plan execution completeness |
| Rework rate | `Rework rate: X steps needed fixup commits` | Implementation quality |
| P1 escape rate | `P1 escape rate: Z P1 findings discovered` | Pre-commit check effectiveness |
| Drift events | `Drift events: D contract violations` | Plan adherence |
| Auto-pass rate | `Auto-pass rate: P steps auto-continued / N total` | Automation effectiveness |

Parse each metric into structured data. Handle missing fields gracefully (some reviews predate certain metrics — the 23 historical reviews in `.ae/reviews/` should remain fully readable).

## Step 2: Analyze Trends

Multiple data points exist:
- **Trend direction**: improving / stable / degrading per metric.
- **Outliers**: features with unusually high rework or P1 escape rates.
- **Correlations**: e.g., high drift events correlating with high rework rate.

Single data point:
- Baseline establishment — record as first data point; note that trends require 2+ reviews.

## Step 3: Generate Actionable Insights

For each metric showing a pattern:

- **Rework rate high** → "Gate conditions may be too loose — consider strengthening pre-commit checks for [specific area]."
- **P1 escape rate > 0** → "Pre-commit review missed critical issues — review checklist coverage for [pattern]."
- **Drift events frequent** → "Plan step granularity may be insufficient — consider more detailed Expected files in plans."
- **Auto-pass rate low** → "Many steps require manual intervention — review gate conditions for false positives."
- **Steps completion < 100%** → "Plans may be over-scoped — consider smaller step decomposition."

## Step 4: Output

Write report to `pipeline.yml` → `output.analyses` (default: `docs/analyses/`) as `NNN-plugin-stats-slug.md` (NNN = next available sequence number):

```markdown
---
id: "NNN"
title: "Plugin Stats: [scope]"
type: plugin-stats
created: YYYY-MM-DD
data_sources: N review files
---

# AE Plugin Stats: [scope]

## Data Summary

| Feature | Steps | Rework | P1 Escape | Drift | Auto-pass |
|---|---|---|---|---|---|
| [feature] | N/M | X% | Z | D | P% |

## Trends
[Trend analysis per metric]

## Actionable Insights
[Specific recommendations with evidence]

## Recommendations
[Prioritized list of pipeline improvements]
```

**Comparison report** (when `--compare` is used): write to same directory as `NNN-plugin-stats-comparison-ID1-vs-ID2.md`:

```markdown
---
id: "NNN"
title: "Comparison: [report A title] vs [report B title]"
type: plugin-stats-comparison
created: YYYY-MM-DD
compared: ["ID1", "ID2"]
---

# Plugin Stats Comparison: [report A] vs [report B]

## Delta Summary

| Metric | [Report A] | [Report B] | Change |
|---|---|---|---|
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

**You MUST call the Write tool to save the output file.** Displaying results in conversation is not sufficient for this skill — historical persistence is the entire point.

Show summary to user.

### Backward compatibility — legacy `type: retrospect` data

The 23 existing `output.analyses/*` reports written by the old `ae:retrospect` skill use `type: retrospect` in frontmatter. This skill MUST read them as plugin-stats data (the schema is the same; only the type label changed). New reports written by this skill use `type: plugin-stats`. Both types are valid input; only `type: plugin-stats` is written going forward.

### 4.5. Knowledge Capture (to Mengdie)

Run after report write, before Next Steps. Skip in `--compare` mode (comparisons don't generate new insights, only deltas).

Follow the [Knowledge Capture Protocol](../../docs/knowledge-capture-protocol.md).

**Skill-specific extraction**:
- One item per actionable trend conclusion from Actionable Insights.
- Skip raw statistics and data summaries.
- `source_type`: `plugin-stats`
- `knowledge_type`: `experiential`
- `entities`: derive from each specific insight (compound tags like `challenger-highest-value-reviewer`, `per-commit-review-misses-cross-cutting`). Avoid single broad tags.
- `source_file`: path to the generated report.

**Closing output**:
- `Knowledge capture: [N] items ingested, no conflicts`
- Or: `Knowledge capture: [N] items ingested, conflicts detected with: [titles]`

## Step 5: Comparison Mode

Triggered when `--compare ID1 ID2` is provided. Pre-check validates both IDs exist.

### 5.1 Read Reports
Read both reports from `output.analyses`. Parse `## Data Summary` from each.

### 5.2 Extract Metrics
For each report, extract the 5 metrics from the Data Summary table. Missing metrics → `N/A` in comparison.

### 5.3 Calculate Delta

| Metric | Improving direction | Arrow meaning |
|---|---|---|
| Steps completed | ↑ higher = better | ↑ = improving, ↓ = degrading |
| Rework rate | ↓ lower = better | ↓ = improving, ↑ = degrading |
| P1 escape rate | ↓ lower = better | ↓ = improving, ↑ = degrading |
| Drift events | ↓ lower = better | ↓ = improving, ↑ = degrading |
| Auto-pass rate | ↑ higher = better | ↑ = improving, ↓ = degrading |

Delta format: arrow + absolute value (e.g., `↓ -2`, `↑ +15pp`). `pp` = percentage points. Zero delta → `— 0` (no arrow).

### 5.4 Generate Analysis
- Which metrics improved + potential causes.
- Which metrics degraded + recommended actions.
- All metrics stable → note pipeline consistency.

### 5.5 Write Output
Write comparison report using the comparison template from Step 4.

### Edge Cases

- **Report format mismatch**: one report missing some metrics → compare only shared metrics, note: `Metric [name] missing in report [ID], skipped.`
- **Same ID twice**: → "Compare failed: both IDs are the same."
- **Only one report exists**: → "Compare failed: only 1 plugin-stats report found; at least 2 are required."

## Next Steps

Based on output, suggest:
- Insights are actionable → `Consider /ae:discuss to decide on pipeline improvements, or /ae:plan to implement directly.`
- Data insufficient → `Continue running pipeline (/ae:work → /ae:review) to accumulate more data points.`
- All metrics healthy → `Pipeline is performing well. No immediate action needed.`
- Comparison shows degradation → `Consider /ae:analyze to investigate root cause.`
- 2+ reports exist and snapshot mode was used → `Use /ae:plugin-stats --compare ID1 ID2 to compare trends.`

## Distinction from `/ae:retrospect`

`/ae:retrospect` = **project-level long-cycle Reflect** (GTD Weekly Review style). Reads `.ae/features/done/`, surfaces what shipped + lessons learned + estimate-vs-actual + next promote candidates. Conversational output, no file write.

`/ae:plugin-stats` = **AE plugin self-development outcome stats** (this skill). Reads `.ae/reviews/`, surfaces delivery metrics across the AE plugin's own development pipeline. Persistent file output for trend tracking.

Both can coexist on the same project. Use `ae:retrospect` to reflect on shipped product features; use `ae:plugin-stats` to reflect on the meta-process that produced them (when this project IS the AE plugin, or any project that uses AE for self-bootstrapping).
