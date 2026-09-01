# The Phase 1 Kernel

> **Status: archived, not live.** This Kernel was built, proven, and never put on
> the workflow path: no skill, agent, template or hook reaches it, and the work to
> give it an entry point was abandoned partway. **Its own suite still runs** —
> `test-v1-kernel.sh` is part of the standard test pass — so the code is exercised
> even though nothing consults it to decide anything. Do not delete this directory
> without first accounting for that suite. It is preserved at tag `v1-kernel-archive`
> and kept in the tree, to be reopened only on a named observed event. Everything
> below is accurate about what was built — it is not a description of what runs
> today. See [`../../../docs/rebuild.md`](../../../docs/rebuild.md) §1.4.

**On the two things called v1.** This directory is `plugins/ae/v1/`, and the Contract
that governs it calls this slice V1 with later slices V2 through V5. The AE plugin also
has a v1 release, which is a different thing on a different clock. Everything here says
**Phase 1…5** for the slices, and reserves **v1** for the release. The Contract itself
still reads V1–V5: its bytes are signed and are not edited in place, so it is quoted as
written and read with this note beside it.

The minimal Kernel and solo workflow, built against the Contract activated on
2026-08-26 (`F-086`, revision `candidate-17`).

## What this is

The part of AE that decides whether finished work is admissible. It is small on
purpose: a reduction, an identity check, an admissibility check, a record, and
one writer — reached through one object.

```text
lib/kernel.mjs         the channel: every operation, the log itself, and the only way to either
lib/codes.mjs          typed refusals — every Contract falsifier has a name
lib/gate.mjs           the reduction: select, then reduce, by a stated table
lib/identity.mjs       two identities per object
lib/admissibility.mjs  what makes an observation count as evidence
lib/family.mjs         the requested identity, and the unavailable arm
lib/formation.mjs      the provenance trace, including the landing check
lib/ledger.mjs         the closed set of record kinds, and the audit that keeps it so
lib/write-path.mjs     where a completion write may land
lib/source-audit.mjs   properties only the source can answer: staging, origin
lib/schema.mjs         closed-format validation, and validation of the schemas
schema/objects.mjs     the four durable objects
schema/records.mjs     the closed shape of every record kind

canonical-json.mjs, errors.mjs, freeze.mjs and fs-noreplace.mjs are copies of the
frozen foundation corpus, kept byte-identical on purpose — see Q-01. Some of what
they export has no Phase 1 consumer, and pruning it would fork the copy.
```

Run: `sh plugins/ae/tests/scripts/test-v1-kernel.sh`

Two checks are the other half, and neither is part of that suite — both copy the
slice into a scratch tree and never write to the repository:

- `sh plugins/ae/v1/test/mutation-check.sh` plants one deliberate defect at a time
  and **fails when one survives**. The defects are ones someone thought of.
- `sh plugins/ae/v1/test/deletion-sweep.sh` deletes **every** refusal in turn — each
  `fail(...)` and each returned refusal code — and reports the ones the suite does
  not notice. Nobody has to think of them.

A guard the suite cannot notice the absence of is not a guard. Twenty rounds of
review found one on almost every pass by hand; the sweep's first run found twelve
in one file that ninety-four hand-written defects had missed.

Some refusals the sweep reports are not gaps but dead code — a check the caller
cannot reach, because an earlier one already refuses or the value is built inside
the Kernel. Those are deleted rather than tested, and where the property still
matters it moves to a boundary where it can be held. The closed set of record kinds
is the example worth reading: checking a kind on the way *in* refuses nothing, since
every kind the program writes is a literal in its own source. Checking every line on
the way *out* refuses a line that is actually there — and the log is a file, so lines
can arrive from a second Kernel or from anything else that can write to it.

## Why it lives here and not in `runtime/`

The Contract's Q-01 leaves the location open under one constraint: the
implementation must not assert an installed release exists by virtue of where it
lives. Under the frozen model a `runtime/` directory plus a release manifest *is*
the shape of an installed release, which is why the foundation freeze declined to
create one.

So: `v1/`, with no release manifest, no launcher, and no code that derives "which
release is active" from its own location. Phase 1 has no release concept and reports
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

**A relation is named, never searched for.** Where one record refers to another,
it carries that record's position, and the reader resolves it there. Where a name
could answer to two records, the reader refuses rather than taking the first.

Fifteen rounds of review found the same defect in six different places before
anyone named the shape: a semantic relation reconstructed with a scan over an
incomplete key, with nothing forbidding a second match. A Gate verdict rested on
a digest of a record already in the log, so a consumer wanting *that event* had to
go looking, and found one like it. The rule now is that the log's own positions
are the identifiers.

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

**A required cross-family review cannot be obtained, and Phase 1 says so.** There was
a `recordReview` that took a digest and a family and stamped them
`origin: harness`, so the party being judged wrote its own judge into being and
got an Acceptance carrying a digest of nothing. Phase 1 has no successful cross-family
path — that is Phase 3 — so a Contract requiring independent review now refuses to
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
acceptance criterion. The Human Owner can, and has: the decision is recorded, and
it is that what a human decision records is enough for Phase 1 — the Kernel asks, the
Owner agrees, and the line carries who, when, what was shown, and what was chosen.
What it knowingly does not cover is that a record saying the Owner acted is not
distinguishable from a process writing that the Owner acted. That distinction
begins to matter when something other than the Owner can call the Kernel.

What did close: the Harness runs the command and digests the files, so the
outcome, the deliverable and staleness are no longer things a caller states. The
Contract names all three — the command, the artifact it runs against, and the
inputs it reads — so a producer cannot point the run at a decoy, and cannot
declare it read nothing and thereby make staleness unreachable.

The residue, stated once: **nothing establishes that the command actually read
the artifact and the inputs the Contract names.** Proving that needs execution
instrumentation — a tracing or hermetic adapter, platform-specific in practice —
which Phase 1 does not have. What is established is that the producer chose none of
them, that the artifact is digested by the run rather than before it, and that a
material input is its Contract-stated path with no label to reuse.

This is a shortfall against AC-2, not a footnote — and it is waived for Phase 1 by the
Human Owner, with the criterion to be rewritten against real experience rather
than in advance. What should drive that rewrite is a run where a command passes
the Gate without touching the artifact it was pointed at. If that never happens,
the criterion should narrow to what is observable: that the producer had no say in
the command, the artifact, or the inputs.

## Where Phase 1 stands

| | |
|---|---|
| **AC-9** — the real dogfood run | Done, twice. BL-214 (the bridge's single credential) and BL-200 (a validator that misdescribed its own scope). Both reached an Acceptance with all four facts and both judgements recorded. |
| **AC-1 end to end** | Done — those runs are it. |
| **AC-12's freeze** | Done. `schema/frozen.mjs` records the canonical identity of every persisted format and the byte identity of the files that decide what a schema means — the validator, the definitions, and the canonical encoder. Frozen after the run, not before. |
| **AC-2 and AC-5** | Not met in full. Both are decided by the Human Owner rather than left open — AC-2 waived for Phase 1 with the criterion to be rewritten against experience, AC-5 accepted as stated. See above. |

The suite covers every criterion that can be exercised without a human decision.
The ones that cannot are the ones the Contract reserves for the Human Owner, and
they are reserved on purpose.

One thing the two runs established that no criterion asked for: **of seventeen
backlog items, two could go through this Kernel at all.** The rest change prose
rules meant for a model to follow, or are design judgements, and no command can
establish that a model followed a rule. That is not a defect in Phase 1 — a Contract
naming a command whose result is the answer is the whole design — but it bounds
what Phase 1 can accept, and the bound was not visible until something real was run
through it.
