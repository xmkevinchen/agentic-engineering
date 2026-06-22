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

## Prompt
Apply review Check 7 to this AC + proposal. Independently judge: does the proposed
verification actually prove the AC ("amount must be VALID")? If something is missing to
make the harness real, name it specifically.
