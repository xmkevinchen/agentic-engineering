# Expected Behavior — F-049 AC7: propose≠judge L1 static guard

L1 static-content fixture (the deterministic complement to Step 6's live behavioral dogfood).
Asserts the harness's self-grading guard is documented in `plugins/ae/skills/plan/SKILL.md`:

- `[text]` "propose ≠ judge" — the separation is named: the stage that proposes/instantiates a
  spec is never the stage that judges satisfaction.
- `[text]` "self-grading guard" — the shape-authored-not-generated guard is stated.
- `[text]` "boundary values, not" — the boundary-param instantiation instruction (gemini
  weak-param guard) is present in the contract sub-schema.
- `[text]` "verify_by: contract" — the contract deterministic kind is documented.

Runnable form: `plugins/ae/tests/scripts/test-f049-propose-not-judge.sh` (deterministic grep,
exit 0/non-0). This is the `unit` enforcement; Step 6 is the `judge`/behavioral proof.
