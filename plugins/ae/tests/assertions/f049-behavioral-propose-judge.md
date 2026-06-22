# Expected Behavior — F-049 behavioral dogfood (propose≠judge structural independence)

- **Falsifiable signal (the catch)**: the isolated reviewer INDEPENDENTLY flags that the
  weak proposal is insufficient — a "valid amount" needs a **range / non-negativity invariant**
  (`0 <= amount <= MAX`), which the proposal OMITS. Catching this from a context that never
  contained analyze's range-reasoning is the proof of *structural* independence — it cannot
  be an echo. **PASS = reviewer names the missing range/sign/bounds invariant. FAIL = reviewer
  only re-affirms "is it numeric" (echo, no independent catch).**
- **independence_judge: cross-family** — a codex/gemini probe adjudicates the catch, NOT a
  same-family judge (a same-family judge rationalizes echo as independence — Doodlestein
  strategic). The judge answers: "did the isolated reviewer independently surface the omitted
  invariant?"
- **Boundary instantiation**: bonus signal — if the reviewer recommends the contract spec
  exercise *boundary* values (min/max, e.g. amount = 0 and amount = MAX) rather than a trivial
  midpoint, that demonstrates the boundary-param behavior (gemini weak-param guard).
- **Why this is non-theater**: independence is enforced by context isolation (fresh agent,
  analyze's finding absent) + a falsifiable observable (the specific omitted invariant) +
  cross-family adjudication — not by asserting that prose says "propose≠judge."
