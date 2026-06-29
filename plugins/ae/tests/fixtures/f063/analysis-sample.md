# Analysis: sample feature (F-063 AC3 behavioral fixture)

> Fixture for F-063 AC3. The review-stage judge reads (i) the EDITED plan/SKILL.md
> consume-instruction + conventions and (ii) THIS table, then judges whether a planner
> following the instruction against this analysis would necessarily account for EVERY
> dimension (mapped to an AC's verify_by, OR `# dimension dropped`, with downgrades
> carrying `# verify_by override`). No hand-authored "passing" plan — the judge tests
> whether the instruction is behaviorally SUFFICIENT, not self-fulfilling.

## TL;DR
- **Question**: ship a CSV importer that validates rows and emits a summary report.
- **Current judgment**: feasible; three acceptance dimensions below.
- **Next step**: /ae:plan

## Supporting detail

### Verification considerations (REQUIRED — per acceptance dimension)

| dimension | verify_by | runnable-check sketch / rubric |
|---|---|---|
| row-schema parsing (known-good + known-bad CSV → correct accept/reject) | `unit` | `sh tests/parse.sh` over fixture CSVs |
| imported-total invariant (sum of imported rows == sum of valid input rows, boundary: empty file, all-invalid file) | `contract` | jq spec asserting the invariant at min/max boundaries |
| summary-report readability (the human-facing report is clear + correctly highlights rejected rows) | `judge` | rubric: does the report state total/accepted/rejected counts + list each rejection reason? |
