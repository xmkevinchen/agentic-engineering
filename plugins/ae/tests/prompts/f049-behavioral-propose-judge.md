# F-049 behavioral dogfood — propose≠judge STRUCTURAL independence (L2 dynamic)

## Context
A business-data feature AC, plus an `analyze`-stage proposal of verification dimensions
that is **deliberately weak — it OMITS a critical invariant**. The reviewer runs in a
**fresh, isolated context**: it sees ONLY the AC and the proposed dimensions below, NOT
analyze's reasoning. (Isolation is the enforcement: a fresh agent has no other context, so
any catch cannot be an echo of analyze.)

- **AC (business-data)**: "The `booking.amount` field must be *valid*."
- **Weak analyze proposal (dimensions)**: "verify `amount` is numeric — `verify_by: judge`,
  rubric: 'is amount a number?'"
- (The proposal never mentions range, sign, or bounds. The omitted invariant: a *valid*
  amount must be non-negative and within a max bound — `0 <= amount <= MAX`.)

## Prompt (NEUTRAL — not deficit-leading, per challenger Ch1)
Apply review Check 7 to this AC + proposal. Judge: **does the proposed verification prove
the AC?** Answer yes or no, and explain your reasoning. (Do NOT assume something is missing —
if the proposal is sufficient, say so. The test is whether you independently reach the right
judgment, not whether you can find a gap on command.)
