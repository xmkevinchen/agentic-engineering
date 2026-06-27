# `verify_by` kinds — what a runnable check looks like

Non-normative reference for **harness-driven development** (HDD). Every acceptance criterion declares a `verify_by` kind; this says what a *runnable check* is for each — so `/ae:plan-review` can enforce "every deterministic AC declares one" and `/ae:review` knows how to verify. It is a reference for the LLM authoring a harness, **not** a hardcoded enum the kernel branches on.

**"Machines measure, LLM judges meaning" (F-065)**: for deterministic kinds, review does NOT trust a self-verdicting re-run. `collect-ac-evidence.py` runs the AC's `verify:` and emits a **facts-only evidence record** (`<milestone-dir>/evidence/<AC-id>.json`, `verdict: null`); it decides only *vacuity* (zero / below-`min_count` match → collector-integrity-failure). An **isolated, cross-family** judge then reads the evidence + the matched test **bodies** and decides coverage — and writes the verdict back.

| `verify_by` | Confidence | What a runnable check looks like | How review verifies |
|---|---|---|---|
| `unit` | **strong** (deterministic) | a unit test asserting the AC's input→output; declare `verify:` = the test command — e.g. `verify: pytest tests/test_x.py::test_case` (+ optional `expected_match: {min_count: N}`) | judge runs `collect-ac-evidence.py` → judges coverage from the evidence + test body |
| `integration` | **strong** | a test exercising ≥2 components, or a fixture + script; `verify:` = the command — e.g. `verify: sh tests/it-x.sh` | judge runs the collector → judges coverage from evidence + test body |
| `e2e` | **strong** | a full-flow test (UI driver / API call→assert); `verify:` = the e2e command | judge runs the collector → judges coverage (env permitting; else manual) |
| `contract` | **strong** | a jq-assertion spec over the feature's data output; `verify:` = `verify-contract.sh <spec.jq> <sample.json>` | `verify-contract.sh` runs; judge judges coverage from the result + evidence |
| `judge` | **partial** (artifact-judged) | NO shell check — a captured **artifact** (screenshot / log / metric / sample output) at `<milestone-dir>/artifacts/<AC-id>.<ext>` + a rubric question in the AC body; the judge **evaluates the artifact**, never the executor's self-report | independent judge **evaluates the artifact** against the rubric |
| `manual` | **manual** (human) | NO automatable check — a human confirms; surfaced at review, non-blocking for auto-pass | **human** confirms |

## Rules

- **Deterministic kinds (`unit`/`integration`/`e2e`/`contract`) MUST declare a `verify:` line.** `/ae:plan-review` runs `check-harness.sh` — a **completeness lint** (the line is *declared*), NOT a coverage check. A deterministic claim with nothing to run is vacuous.
- **The collector measures, the judge judges.** `collect-ac-evidence.py` never emits an AC pass/fail — only facts + a vacuity exit code. Coverage ("does this test actually cover the AC?") is the review judge's call, from the evidence + the test body. `expected_match: {min_count}` (default 1) lets an AC declare how many real tests must match (catches zero/under-match deterministically); a non-cargo/pytest runner with no match-count must declare `exit_code_only: true` or it reads as vacuous.
- **`judge` requires an artifact** to evaluate (not self-report) — see `/ae:review` Check 7. A `judge` AC with no artifact cannot pass.
- **`manual`** is the honest floor for the irreducibly-human. It never auto-passes.
- **Push each AC as far DOWN this table (toward `unit`) as it honestly goes** — only fall back to `judge`/`manual` for what genuinely can't be measured.
