# `verify_by` kinds — what a runnable check looks like

Non-normative reference for **harness-driven development** (HDD). Every acceptance criterion declares a `verify_by` kind; this says what a *runnable check* is for each — so `/ae:plan-review` can enforce "every deterministic AC has one" and `/ae:review` knows how to re-verify. It is a reference for the LLM authoring a harness, **not** a hardcoded enum the kernel branches on.

| `verify_by` | Confidence | What a runnable check looks like | How review re-verifies |
|---|---|---|---|
| `unit` | **strong** (deterministic) | a unit test asserting the AC's input→output; declare `verify:` = the test command — e.g. `verify: pytest tests/test_x.py::test_case` | judge **re-runs** the command |
| `integration` | **strong** | a test exercising ≥2 components, or a fixture + script; `verify:` = the command — e.g. `verify: sh tests/it-x.sh` | judge **re-runs** |
| `e2e` | **strong** | a full-flow test (UI driver / API call→assert); `verify:` = the e2e command — e.g. `verify: npx playwright test x.spec.ts` | judge **re-runs** (environment permitting; else falls to manual) |
| `contract` | **strong** | a jq-assertion spec over the feature's data output; `verify:` = `sh plugins/ae/scripts/verify-contract.sh <spec.jq> <sample.json>` | judge **re-runs** |
| `judge` | **partial** (artifact-judged) | NO shell check — a captured **artifact** (screenshot / log / metric / sample output) at `<milestone-dir>/artifacts/<AC-id>.<ext>` + a rubric question in the AC body; the judge **evaluates the artifact**, never the executor's self-report | independent judge **evaluates the artifact** against the rubric |
| `manual` | **manual** (human) | NO automatable check — a human confirms; surfaced at review, non-blocking for auto-pass | **human** confirms |

## Rules

- **Deterministic kinds (`unit`/`integration`/`e2e`/`contract`) MUST declare a runnable `verify:`** (or a covering `test.command` target). `/ae:plan-review` blocks a deterministic AC that has no runnable check — a deterministic claim with nothing to run is vacuous.
- **`judge` requires an artifact** to evaluate (not self-report) — see the capture convention in `/ae:review` Check 7. A `judge` AC with no artifact cannot pass.
- **`manual`** is the honest floor for the irreducibly-human (subjective polish, live-system smoke). It never auto-passes.
- **Push each AC as far DOWN this table (toward `unit`) as it honestly goes** — convert judge→deterministic where a real check exists; only fall back to `judge`/`manual` for what genuinely can't be re-run.
