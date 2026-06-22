# Pre-merge integration review (convention)

> Contributor convention, not an enforced gate. Closes the gap where per-feature review
> passes each feature but their *combined* branch has cross-feature interaction bugs.
> Source: discussion 055 (integration-review gap).

## The gap (why this exists)

`/ae:review` reviews one feature's commits against its own base. When ≥2 features are stacked
(one `depends_on` another, merged together), defects can live in the **seam between** them —
in code, contracts, or prose spread across files that are never co-present in any single
feature's review scope. Per-feature review (even cross-family) cannot see these; they only
appear on the **integrated diff**.

Evidence: F-041 + F-048 + F-049 each passed per-feature review, but an independent review of
the combined branch found integration bugs across four rounds.

## The convention

**Before merging ≥2 stacked / `depends_on` features:**

1. **Run an independent review on the combined diff** — `/ae:review main...<tip>` (the ad-hoc
   range target), covering all the stacked features at once.
2. **Use a DIFFERENT model family than did the per-feature review.** Family diversity catches
   emergent/interaction properties that same-family consistency misses (the session evidence:
   per-feature cross-family review passed; the integrated diff still had P1s). This is a
   convention — **not enforced** by any gate.
3. **On any finding → review discovers, then lock it**: convert a discovered durable invariant
   into a deterministic check (a `verify_by` fixture / `test.command` assertion) so it can't
   regress. Review *discovers* the seam; a fixture *locks* it.

### Family-unavailability fallback (force-rank — never silent-skip)

If the preferred different family is unavailable at merge time:

1. **Preferred**: a different family than per-feature (e.g. per-feature was Codex → use Gemini, or vice versa).
2. **Else**: local oMLX (Google `gemma`) — keeps a non-implementing-family lens.
3. **Else**: **block the merge** until a reviewer is available.
4. **Last resort only**: same-family review **with an explicit written warning** in the review
   record that family diversity was lost. This is NEVER an automatic fallback — it is a
   conscious, recorded exception. **Never silent-skip the combined review.**

## Concrete cross-feature-seam examples

- **Contract drift across files** (the F-048×F-041 case): F-048's loop deferred a lifecycle
  step to F-041's `/ae:review` Completion Invariant; the SKIP/RUN rule was *restated* in both
  `work/SKILL.md` and `review/SKILL.md` and the two copies drifted — the loop could archive
  before its hedge. Neither feature's per-feature review saw both files together.
- **Enum propagation** (the F-049 case): a new `verify_by: contract` value was added to the
  plan template but a consumer skill still ignored it — a contract AC fell into neither the
  deterministic hard-block nor the judge path (silent gap), visible only across the consumers.
- **Shared-resource invariant**: feature A and feature B each independently pass, but together
  they exceed a shared limit (rate, quota, a global counter) — an invariant no single feature
  declares.

## What this is NOT

- NOT a CI/CD system, a merge hook, or a sign-off field — it's a habit + the existing
  `/ae:review` range target.
- NOT autonomous — the different-family review is human-triggered (the review tooling isn't
  guaranteed available headless/in-loop). The autonomous trigger is deferred (BL-144).
- NOT a deterministic test for the prose-seam class — that class is review-discovered by
  design; only the discovered invariants get locked as fixtures.
