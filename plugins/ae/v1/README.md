# AE v1 — V1 slice

The minimal Kernel and solo workflow, built against the Contract activated on
2026-08-26 (`F-086`, revision `candidate-17`).

## What this is

The part of AE that decides whether finished work is admissible. It is small on
purpose: a reduction, an identity check, an admissibility check, an authority
check, a record, and one writer.

```text
lib/codes.mjs          56 typed refusals — every Contract falsifier has a name
lib/gate.mjs           the reduction: select, then reduce, by a stated table
lib/identity.mjs       two identities per object; lineage relations
lib/admissibility.mjs  what makes an observation count as evidence
lib/authority.mjs      grants, and the trust root that ends the regress
lib/family.mjs         the requested identity, and the unavailable arm
lib/acceptance.mjs     completion: every obligation passed, and a bound sign-off
lib/formation.mjs      the provenance trace, including the landing check
lib/ledger.mjs         append-only record, closed at the append boundary
lib/writer.mjs         the sole completion write
lib/schema.mjs         closed-format validation, and validation of the schemas
schema/objects.mjs     the four durable objects
```

Run: `sh plugins/ae/tests/scripts/test-v1-kernel.sh`

## Why it lives here and not in `runtime/`

The Contract's Q-01 leaves the location open under one constraint: the
implementation must not assert an installed release exists by virtue of where it
lives. Under the frozen model a `runtime/` directory plus a release manifest *is*
the shape of an installed release, which is why the foundation freeze declined to
create one.

So: `v1/`, with no release manifest, no launcher, and no code that derives "which
release is active" from its own location. V1 has no release concept and reports
`unavailable` where the settled design would have required a qualified one.

Four modules are **copied** from `tests/foundation/lib/`, not moved:
`canonical-json`, `errors`, `fs-noreplace`, `freeze`. The frozen corpus keeps its
copies and keeps passing. Consolidating now would be the upfront horizontal build
the plan forbids; a later slice may do it once both have real consumers.

## Three things worth knowing before reading the code

**The reduction judges; selection does not.** Stage 1 reads the routing envelope —
lineage, obligation, attempt — and stops. Whether a record is valid, current, or
authorized is a *reduction verdict*. Two earlier drafts filtered in selection and
each time the record a status exists to report was discarded before the status
could be reached: a superseded revision surfaced as `pending`, and so did tampered
evidence.

**Two identities, not one.** A canonical digest cannot detect a lexical mutation —
reordered members, changed whitespace, a respelled escape all canonicalize to the
same bytes on purpose. A byte digest cannot compare two encodings of the same
content. Keeping one loses the other.

**The trust root is named once.** Three criteria each pushed authorization up a
level — the runner would vouch for the result, the Assignment for the runner's
producer, and nothing for the Assignment. The root is the host's interaction
surface and the Harness's own write path, and it buys exactly one thing: a
submission cannot author its own provenance. It does not resist a process that
owns the machine, and nothing here claims it does.

## What is not built yet

| | |
|---|---|
| **AC-9** — the real dogfood run | Needs the Human Owner to choose the change and judge its independent worth. Q-02. |
| **AC-1 end to end** | The pieces exist and are tested; the run that exercises them together is AC-9's. |
| **AC-12's freeze** | Deliberate. Formats freeze *after* the real run exercises them, with the identity of what enforces them pinned. Freezing now would repeat the mistake the plan exists to avoid. |

The suite covers every criterion that can be exercised without a human decision.
The ones that cannot are the ones the Contract reserves for the Human Owner, and
they are reserved on purpose.
