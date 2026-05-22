---
title: "L-feature gate policy"
type: policy
created: 2026-05-21
followup_bl: "BL-092-l-gate-mechanical (v0.11.x mechanical /ae:roadmap enforcement)"
---

# L-feature gate policy

## Rationale

AE's measured historical revert rate is approximately 2% (1 revert across 50 recent commits). L-size features are the highest-risk class because they touch many files and ship many commits; a concurrent-L-feature concentration multiplies the surface for cross-feature defects to interact. The gate enforces an empirical dog-food window between consecutive L-size feature adoptions to bound concurrent-L risk while still letting the project ship.

## Window calibration note

The 2-week dog-food window is a **conservative heuristic**, not a derivation from the 2% revert rate. Revert-rate measures defect *density*; the 2-week window measures defect-discovery *latency*. The two are related (more defects → longer time-to-discover at constant attention) but distinct. Until per-L-feature revert-latency data exists, 2 weeks errs on the side of caution — long enough for routine dog-fooding to surface most issues; short enough not to stall the roadmap. A v0.11.x candidate (see `followup_bl:` frontmatter) replaces this heuristic with a data-driven window derived from historical L-feature revert-latency distribution.

## Rule

After any L-size feature ships (`size: L` in the feature `index.md` frontmatter), the project MUST wait **2 calendar weeks** of dog-fooding before approving the next L-size feature into the active sprint. The gate satisfies two conditions:

1. The previous L feature's `/ae:review` verdict was `pass`.
2. ≥ 2 calendar weeks have elapsed since the previous L feature's `done:` date in its `index.md`.
3. No observed regression attributable to the previous L feature during the window.

If all three hold, an L-size candidate may proceed into the active sprint. Otherwise, the L candidate is deferred to a later sprint with a documented reason in the roadmap file.

## Trigger

`/ae:roadmap` Clarify-phase consults this gate when scanning the backlog for promotion candidates. If the gate fails (a recent L feature exists within the 2-week window or has unresolved regression), L-size candidates are deferred and the deferral reason is recorded in the roadmap file's section for the upcoming sprint.

## Reset condition

The clock starts at the L feature's `done:` date (recorded in its `index.md` frontmatter when archive completes). The window resets if the same L feature is later abandoned (`status: abandoned`) or its work is materially rolled back; in that case the L slot becomes available again immediately because the underlying defect surface has been removed.

## Scope

This gate applies to **AE-self-development** (AE-on-AE workflows). External projects adopting AE may use this as a reference policy but it is not enforced for project work — that is operator discretion.

## Enforcement

Currently **human-discipline reinforced** by `/ae:roadmap` reviewer attention. The `followup_bl:` frontmatter field references **BL-092-l-gate-mechanical**, a v0.11.x candidate to convert this policy into a mechanical check in `/ae:roadmap` Clarify (the check would scan `.ae/features/done/F-*/index.md` for size=L features with `done:` dates within the past 2 weeks and emit a blocking warning if a new L candidate is being considered).

If you notice the gate has been bypassed without a documented reason, raise the concern at the next `/ae:roadmap` invocation rather than retroactively.

## Open questions (deferred to BL-092 / future review)

- Should the window length be parameterized per project size or shipping cadence?
- Should partial-rollback (a single fix commit on top of the L feature) reset the clock or be treated as continuation?
- Is "L-size" measured by the size frontmatter field, by commit-count, by lines-changed, or by some hybrid? Current rule uses the frontmatter field; a hybrid mechanical definition is a v0.11.x candidate.
