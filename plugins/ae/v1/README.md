# AE v1 — V1 slice

The minimal Kernel and solo workflow, built against the Contract activated on
2026-08-26 (`F-086`, revision `candidate-17`).

## What this is

The part of AE that decides whether finished work is admissible. It is small on
purpose: a reduction, an identity check, an admissibility check, a record, and
one writer — reached through one object.

```text
lib/kernel.mjs         the channel: every operation, and the only way to any of them
lib/codes.mjs          typed refusals — every Contract falsifier has a name
lib/gate.mjs           the reduction: select, then reduce, by a stated table
lib/identity.mjs       two identities per object
lib/admissibility.mjs  what makes an observation count as evidence
lib/family.mjs         the requested identity, and the unavailable arm
lib/formation.mjs      the provenance trace, including the landing check
lib/ledger.mjs         append-only record, closed at the append boundary — not exported
lib/write-path.mjs     where a completion write may land
lib/source-audit.mjs   properties only the source can answer: staging, origin
lib/schema.mjs         closed-format validation, and validation of the schemas
schema/objects.mjs     the four durable objects
schema/records.mjs     the closed shape of every record kind
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

## Four things worth knowing before reading the code

**Nothing that decides an outcome comes from a caller.** The Contract, the
Assignment, the Evidence Package and the current identity of every material input
are read out of the log, not passed in. Each durable object enters as its own
bytes with its own identity, and the only way to obtain the object is through a
resolver that verifies that identity first — so acting on an object whose bytes do
not check out is not something a consumer can do by forgetting to check.

Three rounds of review found the same defect in three different places: a
parameter through which the party being judged supplied the standard it would be
judged against. There is no longer such a parameter, and that is the property to
check first when reading `lib/kernel.mjs`.

**Nothing is named by a number that was predicted.** An attempt is identified by
the position of the record that opened it, and a record's position is assigned
when the log is read, never stored. Both of those replaced a prediction: a
sequence number read just before appending, and an attempt id built from the
position the log was *about* to reach. Two writers can predict the same number;
two lines cannot occupy one position.

That class of defect is invisible from a single process, so `test/concurrent.test.mjs`
starts real ones and has them collide.

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

**A check that a caller may skip is not a check.** Every property lives on the
one path a party can take. Standalone helpers — `checkAssignment`, `checkGrant`,
`requireHumanInput`, `unavailableArm`, `checkPresentedView` — were deleted rather
than kept beside it: each was correct, tested, and called by nothing, which made
the suite green about functions instead of about the program.

**The trust root is named once, and it is narrow.** Three criteria each pushed
authorization up a level — the runner would vouch for the result, the Assignment
for the runner's producer, and nothing for the Assignment. The root is the host's
interaction surface and the Harness's own write path, and it buys exactly one
thing: **a submission cannot author its own provenance.** The observation is a
separate append from the runner's record, the Assignment from the attempt that
uses it, the approval from the evidence judged under it.

**A required cross-family review cannot be obtained, and V1 says so.** There was
a `recordReview` that took a digest and a family and stamped them
`origin: harness`, so the party being judged wrote its own judge into being and
got an Acceptance carrying a digest of nothing. V1 has no successful cross-family
path — that is V3 — so a Contract requiring independent review now refuses to
complete, which is where AC-7 already sends it.

The three facts that decide a run are **produced, not accepted**. The Kernel runs
the command and reads its exit status; it digests the artifact file; it digests
each material input to see whether it has changed. Each of those used to be an
argument stamped `origin: harness`, which meant the party being judged wrote the
fact that decided whether it had passed — and §4 concedes editing the records
directly, not an API that writes them on request.

The subject count comes from the command's own output, on a line it prints
(`AE-SUBJECTS: <n>`). A command that prints none leaves the count absent, which is
read as unestablishable rather than as zero.

**One criterion is not fully met, and this is where it is said.** AC-5 asks that
identity come "from the record of who acted, not from a field the actor wrote
about itself". In-process there is no such record: `actor`, `producer` and
`submitter` are strings the caller passes, and comparing two of them establishes
nothing about who acted.

What *is* settled: the Human Owner is configured when the Kernel is built,
outside any Contract, and approval refuses a Contract naming a different signer.
So the earlier hole — write a Contract naming yourself, approve it with the
matching string, then hold every authority it grants — is closed: the root sits
outside what it authorises. What remains is that the configured name is still
only a name.

Closing that needs a principal the Kernel does not mint: a host adapter that
authenticates the human and is the only thing that may append a host record. That
is the same boundary N7 draws for the repository mutation path, and it is not this
slice.

**This is a gap in a normative criterion, not a caveat.** A README cannot waive an
acceptance criterion, and this one does not try to: V1 does not satisfy AC-5 in
full, and whether that is answered by extending the slice or by amending the
Contract is the Human Owner's call, not the implementer's.

What did close: the Harness runs the command and digests the files, so the
outcome, the deliverable and staleness are no longer things a caller states. The
command string comes from the Contract and the paths from the caller, so a caller
can still point the Harness at the wrong place — but it cannot skip the looking.

## What is not built yet

| | |
|---|---|
| **AC-9** — the real dogfood run | Needs the Human Owner to choose the change and judge its independent worth. Q-02. |
| **AC-1 end to end** | The pieces exist and are tested; the run that exercises them together is AC-9's. |
| **AC-12's freeze** | Deliberate. Formats freeze *after* the real run exercises them, with the identity of what enforces them pinned. Freezing now would repeat the mistake the plan exists to avoid. |

The suite covers every criterion that can be exercised without a human decision.
The ones that cannot are the ones the Contract reserves for the Human Owner, and
they are reserved on purpose.
