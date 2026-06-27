# AE Dogfood Feedback — <project> (AE v<X.Y.Z> @ <branch> <short-sha>)

> Source: a real `<skill / full cycle>` run while self-hosting AE on `<project>` (`<stack>`).
> Every item is backed by what actually happened in the run — **not speculation**.

## Run data (evidence base)

- **AE under test**: `v<X.Y.Z> @ <branch> <short-sha>` — pin the EXACT version + commit (version-collision is real; "which build did you test?" must never be ambiguous).
- **Exercised**: `<which skills / full pipeline / specific feature(s)>`
- **Scale**: `<N features · N ACs · N reviewers · N findings · N tests · N commits>`

## What worked (do NOT regress)

- `<validated-good behavior>` — `<the concrete evidence it earned its keep THIS run>`

(Force this section. AE must know what to preserve, not just what to change.)

## Findings (ranked by impact)

### F<N> — <one-line title>   [severity: P1 | P2 | P3 · type: substance | scale-fit]

- **What happened (evidence)**: `<run output / file:line / actual vs expected — reproducible>`
- **Fix**: `<concrete + actionable for the AE side>`
- **Why it matters**: `<a property of the mechanism, or a one-off?>`

> `type: substance` = AE is wrong and must change.
> `type: scale-fit` = AE is too heavy/light for this project's scale — **right-size** (let the LLM judge per-feature), don't necessarily rebuild.

## Meta (optional) — how the verdict was earned

`<which parts of a "pass" were deterministically reproduced vs trusted from a reviewer/agent report — so a verdict isn't over-read>`

## Suggested disposition (for AE triage)

- `<finding>` → folds into `<feature>` | spin off as BL | quick fix | already-known

---

### How to use

1. Copy this file; write the dogfood feedback to the **AE repo** (`docs/<project>-dogfood-feedback-v<X.Y>.md`).
2. Keep it evidence-first — if you can't cite what happened, it's not a finding yet.
3. Separate **substance** (AE is wrong) from **scale-fit** (AE is mis-sized for you) — they get different responses on the AE side.
