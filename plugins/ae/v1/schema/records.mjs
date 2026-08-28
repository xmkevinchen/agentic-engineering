// Record shapes — AC-12 applied to the log, not only to the four objects.
//
// The Ledger validated that a kind was known and accepted anything beside it.
// Closure over names is not closure: a record could carry missing, null or
// additional fields and still append. Every kind has a shape here, and `append`
// refuses anything that does not match it.

const id = { type: 'string', minLength: 1 };
const text = { type: 'string', minLength: 1 };
const seq = { type: 'integer', minimum: 0 };
// When the record landed, observed by the writer. Every kind carries it, like
// every kind carries its position: both are facts about the record rather than
// about its content, and both are read only where a question needs them. AC-12's
// producer-and-consumer rule is about kinds, not about every field of one.
const at = { type: 'integer', minimum: 0 };
const digest = { type: 'digest' };

const identity = {
  type: 'object', additional: false,
  required: ['byte_sha256', 'canonical_sha256', 'length'],
  properties: { byte_sha256: digest, canonical_sha256: digest, length: { type: 'integer', minimum: 0 } },
};

const view = {
  type: 'object', additional: false,
  required: ['renders_sha256', 'rendering_sha256'],
  properties: { renders_sha256: digest, rendering_sha256: digest },
};

// A non-negative count. `seq`, lengths and elapsed durations are all of this
// shape: a negative one is not a smaller value, it is an unusable one, and a
// schema position that admits it is open in AC-12's sense.
const count = { type: 'integer', minimum: 0 };

// The exact stored bytes of a durable object, carried by the record that makes
// it durable. AC-3 asks each of the four objects for two verifiable identities
// over its own bytes; the only way to have that is for the bytes to be what is
// stored. Consumers get the object by parsing these after `verify` — never as
// something a caller handed in.
const bytes = { type: 'string', minLength: 1 };

// An attempt is named by the position of the record that opened it. Minting a
// name — an Assignment id joined to the position the log was *about* to reach —
// predicted a number two writers could both predict, and two runs then shared an
// attempt: the Gate selected one run's observation for the other's newest attempt
// and reported `passed` where nothing had been submitted.
const attempt = { type: 'integer', minimum: 0 };

const approvalBase = {
  lineage: id, revision: id, identity, bytes, decision: count, seq, at,
  kind: { type: 'string', minLength: 1 },
};

export const RECORDS = Object.freeze({
  // Genesis and revision are separate shapes: a genesis has no predecessor, and a
  // closed schema that refuses empty values cannot express "absent" as a value.
  contract_approved_genesis: {
    type: 'object', additional: false,
    required: ['kind', 'lineage', 'revision', 'identity', 'bytes', 'decision', 'seq', 'at'],
    properties: { ...approvalBase },
  },
  contract_approved_revision: {
    type: 'object', additional: false,
    required: ['kind', 'lineage', 'revision', 'identity', 'bytes', 'predecessor', 'decision', 'seq', 'at'],
    properties: { ...approvalBase, predecessor: digest },
  },
  // The Assignment's own bytes, not a copy of its fields. Restating boundary and
  // grants here would be two sources for one fact, and the object would have no
  // identity of its own — which AC-3 requires of all four.
  assignment_issued: {
    type: 'object', additional: false,
    required: ['kind', 'lineage', 'run', 'id', 'contract_revision', 'actor', 'bytes', 'identity', 'origin', 'seq', 'at'],
    properties: {
      kind: text, lineage: id, run: id, id, contract_revision: id, actor: id,
      bytes, identity,
      origin: { type: 'const', value: 'host' }, seq, at,
    },
  },
  attempt_opened: {
    type: 'object', additional: false,
    required: ['kind', 'lineage', 'run', 'assignment', 'producer', 'obligations', 'seq', 'at'],
    properties: {
      kind: text, lineage: id, run: id, assignment: id, producer: id,
      obligations: { type: 'array', minItems: 1, items: id }, seq, at,
    },
  },
  command_result: {
    type: 'object', additional: false,
    required: [
      'kind', 'id', 'lineage', 'run', 'attempt', 'command', 'artifact',
      'exit', 'raw', 'inputs_used', 'origin', 'seq', 'at',
    ],
    properties: {
      kind: text, id, lineage: id, run: id, attempt, command: text,
      // What the command ran against. Without it the result says a command
      // exited zero and nothing about which artifact it exercised — so a
      // producer could pair a real green run with any artifact it liked, and
      // that artifact became the deliverable.
      artifact: id,
      // The outcome the runner observed. The Gate computes `passed` from this
      // and the subject count; nothing a submission says about the result is
      // consulted, because that would be its self-report.
      exit: { type: 'integer' },
      raw: { type: 'string', minLength: 0 },
      // Absent when the command printed no count. That is different from zero:
      // one says nothing could be established, the other says nothing was
      // exercised, and admissibility refuses both for different reasons.
      subjects: count,
      inputs_used: { type: 'array', minItems: 0, items: id },
      origin: { type: 'const', value: 'harness' }, seq, at,
    },
  },
  observation: {
    type: 'object', additional: false,
    required: [
      'kind', 'lineage', 'run', 'obligation', 'observation', 'attempt', 'contract_revision',
      'assignment', 'producer', 'artifact', 'package', 'command_result', 'seq', 'at',
    ],
    properties: {
      kind: text, lineage: id, run: id, obligation: id, observation: text, attempt,
      contract_revision: id, assignment: id, producer: id, artifact: id,
      package: id, command_result: id, seq, at,
      // No `satisfied`. An observation points at the evidence; it does not say
      // what the evidence means. `additional: false` makes carrying one a
      // validation failure rather than a persuasive extra field.
    },
  },
  // The Gate's own verdict. AC-13 says everything the Gate or the Human Owner
  // relies on is recorded, and completion relies on this — an earlier draft had
  // no record of it at all, so replay could not reconstruct why an Acceptance was
  // permitted.
  gate_result: {
    type: 'object', additional: false,
    required: ['kind', 'lineage', 'run', 'contract_revision', 'obligation', 'status', 'seq', 'at'],
    properties: {
      kind: text, lineage: id, run: id, contract_revision: id, obligation: id,
      status: {
        type: 'enum',
        values: ['pending', 'passed', 'failed', 'invalid', 'unavailable', 'stale'],
      },
      code: text,
      attempt,
      // Where the record this verdict rests on is, so a consumer can name that
      // event rather than search for one like it.
      selected: { type: 'integer', minimum: 0 },
      seq, at,
    },
  },
  // One reduction finished. The Gate writes a verdict per obligation, so no single
  // one of those marks the end of an evaluation — taking the first excluded every
  // later obligation's verdict from the interval, and taking the last moved with
  // every repetition. An operation needs its own event.
  gate_completed: {
    type: 'object', additional: false,
    // What was reduced is in the verdicts this event follows; restating the
    // revision and the obligation list here gave two of them no reader and a
    // second place to disagree.
    required: ['kind', 'lineage', 'run', 'seq', 'at'],
    properties: { kind: text, lineage: id, run: id, seq, at },
  },
  // The package is a record, not an object a caller hands the Gate. An earlier
  // version resolved it through a caller-supplied index, which let the party
  // being judged supply the evidence universe. Its fields live in its bytes, for
  // the same reason the Assignment's do.
  evidence_package: {
    type: 'object', additional: false,
    required: ['kind', 'id', 'lineage', 'run', 'bytes', 'identity', 'seq', 'at'],
    properties: { kind: text, id, lineage: id, run: id, bytes, identity, seq, at },
  },
  // What a material input's identity is *now*. Staleness compares this against
  // what the package recorded, and "now" is a fact about the world that the
  // Harness observes — an earlier version took it as a callback the caller
  // supplied, so the party being judged decided whether its evidence was current.
  //
  // Two shapes, because a closed schema that refuses empty values cannot spell
  // "gone" as a value.
  input_observed: {
    type: 'object', additional: false,
    required: ['kind', 'lineage', 'id', 'path', 'identity', 'origin', 'seq', 'at'],
    properties: {
      kind: text, lineage: id, id, path: text, identity: digest,
      origin: { type: 'const', value: 'harness' }, seq, at,
    },
  },
  input_gone: {
    type: 'object', additional: false,
    required: ['kind', 'lineage', 'id', 'path', 'origin', 'seq', 'at'],
    properties: {
      kind: text, lineage: id, id, path: text,
      origin: { type: 'const', value: 'harness' }, seq, at,
    },
  },
  artifact_recorded: {
    type: 'object', additional: false,
    required: ['kind', 'id', 'lineage', 'run', 'artifact_kind', 'path', 'identity', 'origin', 'seq', 'at'],
    properties: {
      kind: text, id, lineage: id, run: id, path: text,
      artifact_kind: { type: 'enum', values: ['commit', 'diff', 'file'] },
      identity: digest,
      origin: { type: 'const', value: 'harness' }, seq, at,
    },
  },
  capability_unavailable: {
    type: 'object', additional: false,
    required: ['kind', 'lineage', 'run', 'obligation', 'attempt', 'requested', 'origin', 'seq', 'at'],
    properties: {
      kind: text, lineage: id, run: id, obligation: id, attempt,
      requested: { type: 'array', minItems: 1, items: id },
      origin: { type: 'const', value: 'harness' }, seq, at,
    },
  },
  dispatch_attempt: {
    type: 'object', additional: false,
    required: ['kind', 'lineage', 'run', 'attempt', 'obligation', 'requested', 'seq', 'at'],
    properties: {
      kind: text, lineage: id, run: id, attempt, obligation: id,
      requested: { type: 'array', minItems: 1, items: id },
      // Present only when a seat actually answered. Absent is not empty: AC-8's
      // check is that nothing claims an answer nobody gave.
      substituted_family: id,
      answered_family: id,
      seq, at,
    },
  },
  // One shape per operation, not one shape with every operation's fields optional.
  // The single shape admitted an `unavailable_decision` carrying no choice and an
  // `activation` carrying one — combinations no consumer can use, which is what
  // AC-12 means by a format being open.
  human_decision_activation: {
    type: 'object', additional: false,
    required: ['kind', 'operation', 'actor', 'lineage', 'revision', 'view', 'origin', 'seq', 'at'],
    properties: {
      kind: text, operation: { type: 'const', value: 'activation' },
      actor: id, lineage: id, revision: id, view,
      origin: { type: 'const', value: 'host' }, seq, at,
    },
  },
  human_decision_choice: {
    type: 'object', additional: false,
    required: ['kind', 'operation', 'actor', 'lineage', 'run', 'choice', 'origin', 'seq', 'at'],
    properties: {
      kind: text,
      operation: {
        type: 'enum',
        // No `signoff`: signing off is its own kind, `human_signoff`, and an
        // operation two shapes could carry is a fact with two spellings.
        values: ['assignment_issuance'],
      },
      actor: id, lineage: id, run: id,
      choice: { type: 'enum', values: ['issue'] },
      origin: { type: 'const', value: 'host' }, seq, at,
    },
  },
  // AC-9's judgements, each naming the run facts it answers. They shared the
  // generic choice shape, which carried no reference to what was being judged —
  // so a `yes` could not be tied to the arithmetic it agreed with.
  human_decision_judgement: {
    type: 'object', additional: false,
    required: ['kind', 'operation', 'actor', 'lineage', 'run', 'answers', 'choice', 'origin', 'seq', 'at'],
    properties: {
      kind: text,
      operation: { type: 'enum', values: ['retreat_decision', 'worth_decision'] },
      actor: id, lineage: id, run: id,
      answers: { type: 'integer', minimum: 0 },
      choice: { type: 'enum', values: ['yes', 'no'] },
      origin: { type: 'const', value: 'host' }, seq, at,
    },
  },
  // Its own kind, carrying the run and the record it answers. It was a
  // `human_decision_choice` with neither: a decision for one run was reconstructed
  // into every run of the lineage, two unavailable runs collapsed to whichever
  // choice landed last, and replay could not say which event was decided about.
  human_decision_unavailable: {
    type: 'object', additional: false,
    required: [
      'kind', 'operation', 'actor', 'lineage', 'run', 'obligation',
      'answers', 'choice', 'origin', 'seq', 'at',
    ],
    properties: {
      kind: text,
      operation: { type: 'const', value: 'unavailable_decision' },
      actor: id, lineage: id, run: id, obligation: id,
      answers: { type: 'integer', minimum: 0 },
      choice: { type: 'enum', values: ['wait', 'stop', 'amend'] },
      origin: { type: 'const', value: 'host' }, seq, at,
    },
  },
  human_signoff: {
    type: 'object', additional: false,
    required: ['kind', 'lineage', 'run', 'contract_revision', 'deliverable', 'actor', 'origin', 'seq', 'at'],
    properties: {
      kind: text, lineage: id, run: id, contract_revision: id, deliverable: digest,
      actor: id, origin: { type: 'const', value: 'host' },
      accepted_review: digest, seq, at,
    },
  },
  completion_committed: {
    type: 'object', additional: false,
    required: ['kind', 'lineage', 'run', 'identity', 'path', 'seq', 'at'],
    properties: { kind: text, lineage: id, run: id, identity, path: text, seq, at },
  },
  // Formation's first act. Nothing recorded it, so the boundary AC-9 asks
  // formation to be measured from did not exist — the earliest record of a
  // lineage is the activation decision, written inside `approve`, which measures
  // one append rather than the work of forming the Contract.
  // A review the Kernel obtained, not one a party handed in. `family` is the
  // registry key the Kernel resolved before running anything, so it is a fact
  // about which command ran rather than a claim the reviewed party made — the
  // same reason `origin` is stamped and never passed.
  //
  // `raw` is required. Without the reviewer's own words a review is a boolean,
  // and nobody reading the log afterwards can tell a judgement from a canned
  // string. What this does NOT establish is that a real model answered: a
  // registry entry pointing a family at `echo` produces a passing review with
  // the family stamped. That is §4's `workflow_attested` boundary, and `raw` is
  // what lets a person see it.
  review: {
    type: 'object', additional: false,
    required: [
      'kind', 'id', 'lineage', 'run', 'reviewer', 'family', 'deliverable',
      'command', 'exit', 'raw', 'findings', 'origin', 'seq', 'at',
    ],
    properties: {
      kind: text, id, lineage: id, run: id,
      // Who answered, as the reviewing side names itself. Not the producer —
      // completion refuses that, because a review the reviewed party wrote is
      // the same defect as an Assignment its beneficiary issued.
      reviewer: id,
      family: id,
      // What was reviewed, by identity. A review floating free of a deliverable
      // reviews whatever anyone later says it did.
      deliverable: digest,
      command: text,
      exit: { type: 'integer' },
      raw: { type: 'string', minLength: 1 },
      // Each finding carries its own id, because a disposition has to name one.
      findings: {
        type: 'array', minItems: 0,
        items: {
          type: 'object', additional: false,
          required: ['id', 'statement'],
          properties: { id, statement: text },
        },
      },
      origin: { type: 'const', value: 'harness' }, seq, at,
    },
  },
  // What was done about a finding. Separate from the review because the review is
  // the reviewer's and the disposition is the producer's; one record written by
  // two parties would be a record neither of them owns.
  //
  // The Kernel has no opinion about whether a disposition is adequate — that is a
  // judgement, and it has none. What it requires is that one exists, because a
  // finding nobody answered is a finding passed over in silence.
  finding_disposed: {
    type: 'object', additional: false,
    required: ['kind', 'lineage', 'run', 'review', 'finding', 'disposition', 'actor', 'origin', 'seq', 'at'],
    properties: {
      kind: text, lineage: id, run: id, review: id, finding: id,
      disposition: text, actor: id,
      origin: { type: 'const', value: 'host' }, seq, at,
    },
  },
  formation_opened: {
    type: 'object', additional: false,
    required: ['kind', 'lineage', 'actor', 'origin', 'seq', 'at'],
    properties: {
      kind: text, lineage: id, actor: id,
      origin: { type: 'const', value: 'host' }, seq, at,
    },
  },
  // AC-9's four facts. The boundaries are records that exist for other reasons,
  // and each cost is the time between two of them — derived rather than supplied,
  // which is what stops "formation cost more than the change" being an opinion
  // wearing a number. Positions were tried first and measured protocol traffic.
  //
  // Two shapes, because `caught_something` means something only when the record
  // holds the discrepancy and what was done about it. One shape with optional
  // fields admitted a trace outcome nothing supports.
  run_record_clean: {
    type: 'object', additional: false,
    required: [
      'kind', 'lineage', 'run', 'formation_from', 'formation_to',
      'change_from', 'change_to', 'formation_elapsed', 'change_elapsed',
      'trace_outcome', 'went_wrong', 'seq', 'at',
    ],
    properties: {
      kind: text, lineage: id, run: id,
      formation_from: count, formation_to: count,
      change_from: count, change_to: count,
      formation_elapsed: count, change_elapsed: count,
      trace_outcome: { type: 'const', value: 'caught_nothing' },
      went_wrong: { type: 'string', minLength: 0 },
      seq, at,
    },
  },
  run_record_caught: {
    type: 'object', additional: false,
    required: [
      'kind', 'lineage', 'run', 'formation_from', 'formation_to',
      'change_from', 'change_to', 'formation_elapsed', 'change_elapsed',
      'trace_outcome', 'discrepancy', 'disposition', 'went_wrong', 'seq', 'at',
    ],
    properties: {
      kind: text, lineage: id, run: id,
      formation_from: count, formation_to: count,
      change_from: count, change_to: count,
      formation_elapsed: count, change_elapsed: count,
      trace_outcome: { type: 'const', value: 'caught_something' },
      discrepancy: text,
      disposition: text,
      went_wrong: { type: 'string', minLength: 0 },
      seq, at,
    },
  },
});
