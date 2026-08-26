// Record shapes — AC-12 applied to the log, not only to the four objects.
//
// The Ledger validated that a kind was known and accepted anything beside it.
// Closure over names is not closure: a record could carry missing, null or
// additional fields and still append. Every kind has a shape here, and `append`
// refuses anything that does not match it.

const id = { type: 'string', minLength: 1 };
const text = { type: 'string', minLength: 1 };
const seq = { type: 'integer', minimum: 0 };
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
  lineage: id, revision: id, identity, bytes, decision: count, seq,
  kind: { type: 'string', minLength: 1 },
};

export const RECORDS = Object.freeze({
  // Genesis and revision are separate shapes: a genesis has no predecessor, and a
  // closed schema that refuses empty values cannot express "absent" as a value.
  contract_approved_genesis: {
    type: 'object', additional: false,
    required: ['kind', 'lineage', 'revision', 'identity', 'bytes', 'decision', 'seq'],
    properties: { ...approvalBase },
  },
  contract_approved_revision: {
    type: 'object', additional: false,
    required: ['kind', 'lineage', 'revision', 'identity', 'bytes', 'predecessor', 'decision', 'seq'],
    properties: { ...approvalBase, predecessor: digest },
  },
  // The Assignment's own bytes, not a copy of its fields. Restating boundary and
  // grants here would be two sources for one fact, and the object would have no
  // identity of its own — which AC-3 requires of all four.
  assignment_issued: {
    type: 'object', additional: false,
    required: ['kind', 'lineage', 'run', 'id', 'contract_revision', 'actor', 'bytes', 'identity', 'origin', 'seq'],
    properties: {
      kind: text, lineage: id, run: id, id, contract_revision: id, actor: id,
      bytes, identity,
      origin: { type: 'const', value: 'host' }, seq,
    },
  },
  attempt_opened: {
    type: 'object', additional: false,
    required: ['kind', 'lineage', 'run', 'assignment', 'producer', 'obligations', 'seq'],
    properties: {
      kind: text, lineage: id, run: id, assignment: id, producer: id,
      obligations: { type: 'array', minItems: 1, items: id }, seq,
    },
  },
  command_result: {
    type: 'object', additional: false,
    required: [
      'kind', 'id', 'lineage', 'run', 'attempt', 'command', 'artifact',
      'exit', 'raw', 'inputs_used', 'origin', 'seq',
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
      origin: { type: 'const', value: 'harness' }, seq,
    },
  },
  observation: {
    type: 'object', additional: false,
    required: [
      'kind', 'lineage', 'run', 'obligation', 'observation', 'attempt', 'contract_revision',
      'assignment', 'producer', 'artifact', 'package', 'command_result', 'seq',
    ],
    properties: {
      kind: text, lineage: id, run: id, obligation: id, observation: text, attempt,
      contract_revision: id, assignment: id, producer: id, artifact: id,
      package: id, command_result: id, seq,
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
    required: ['kind', 'lineage', 'run', 'contract_revision', 'obligation', 'status', 'seq'],
    properties: {
      kind: text, lineage: id, run: id, contract_revision: id, obligation: id,
      status: {
        type: 'enum',
        values: ['pending', 'passed', 'failed', 'invalid', 'unavailable', 'stale'],
      },
      code: text,
      attempt,
      selected: digest,
      seq,
    },
  },
  // The package is a record, not an object a caller hands the Gate. An earlier
  // version resolved it through a caller-supplied index, which let the party
  // being judged supply the evidence universe. Its fields live in its bytes, for
  // the same reason the Assignment's do.
  evidence_package: {
    type: 'object', additional: false,
    required: ['kind', 'id', 'lineage', 'run', 'bytes', 'identity', 'seq'],
    properties: { kind: text, id, lineage: id, run: id, bytes, identity, seq },
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
    required: ['kind', 'lineage', 'id', 'identity', 'origin', 'seq'],
    properties: {
      kind: text, lineage: id, id, identity: digest,
      origin: { type: 'const', value: 'harness' }, seq,
    },
  },
  input_gone: {
    type: 'object', additional: false,
    required: ['kind', 'lineage', 'id', 'origin', 'seq'],
    properties: {
      kind: text, lineage: id, id,
      origin: { type: 'const', value: 'harness' }, seq,
    },
  },
  artifact_recorded: {
    type: 'object', additional: false,
    required: ['kind', 'id', 'lineage', 'run', 'artifact_kind', 'identity', 'origin', 'seq'],
    properties: {
      kind: text, id, lineage: id, run: id,
      artifact_kind: { type: 'enum', values: ['commit', 'diff', 'file'] },
      identity: digest,
      origin: { type: 'const', value: 'harness' }, seq,
    },
  },
  capability_unavailable: {
    type: 'object', additional: false,
    required: ['kind', 'lineage', 'run', 'obligation', 'attempt', 'requested', 'origin', 'seq'],
    properties: {
      kind: text, lineage: id, run: id, obligation: id, attempt,
      requested: { type: 'array', minItems: 1, items: id },
      origin: { type: 'const', value: 'harness' }, seq,
    },
  },
  dispatch_attempt: {
    type: 'object', additional: false,
    required: ['kind', 'lineage', 'run', 'attempt', 'obligation', 'requested', 'seq'],
    properties: {
      kind: text, lineage: id, run: id, attempt, obligation: id,
      requested: { type: 'array', minItems: 1, items: id },
      // Present only when a seat actually answered. Absent is not empty: AC-8's
      // check is that nothing claims an answer nobody gave.
      substituted_family: id,
      answered_family: id,
      seq,
    },
  },
  // An independent review, as the Harness received it. A digest a caller hands to
  // completion is a claim about a review nobody else saw; this is the record it
  // has to resolve against.
  review_recorded: {
    type: 'object', additional: false,
    required: ['kind', 'lineage', 'run', 'identity', 'family', 'origin', 'seq'],
    properties: {
      kind: text, lineage: id, run: id, identity: digest, family: id,
      origin: { type: 'const', value: 'harness' }, seq,
    },
  },
  // One shape per operation, not one shape with every operation's fields optional.
  // The single shape admitted an `unavailable_decision` carrying no choice and an
  // `activation` carrying one — combinations no consumer can use, which is what
  // AC-12 means by a format being open.
  human_decision_activation: {
    type: 'object', additional: false,
    required: ['kind', 'operation', 'actor', 'lineage', 'revision', 'view', 'origin', 'seq'],
    properties: {
      kind: text, operation: { type: 'const', value: 'activation' },
      actor: id, lineage: id, revision: id, view,
      origin: { type: 'const', value: 'host' }, seq,
    },
  },
  human_decision_choice: {
    type: 'object', additional: false,
    required: ['kind', 'operation', 'actor', 'lineage', 'choice', 'origin', 'seq'],
    properties: {
      kind: text,
      operation: {
        type: 'enum',
        // No `signoff`: signing off is its own kind, `human_signoff`, and an
        // operation two shapes could carry is a fact with two spellings.
        values: ['assignment_issuance', 'unavailable_decision',
          'retreat_decision', 'worth_decision'],
      },
      actor: id, lineage: id,
      choice: { type: 'enum', values: ['wait', 'stop', 'amend', 'issue', 'yes', 'no'] },
      origin: { type: 'const', value: 'host' }, seq,
    },
  },
  human_signoff: {
    type: 'object', additional: false,
    required: ['kind', 'lineage', 'run', 'contract_revision', 'deliverable', 'actor', 'origin', 'seq'],
    properties: {
      kind: text, lineage: id, run: id, contract_revision: id, deliverable: digest,
      actor: id, origin: { type: 'const', value: 'host' },
      accepted_review: digest, seq,
    },
  },
  completion_committed: {
    type: 'object', additional: false,
    required: ['kind', 'lineage', 'run', 'identity', 'path', 'seq'],
    properties: { kind: text, lineage: id, run: id, identity, path: text, seq },
  },
  run_record: {
    type: 'object', additional: false,
    required: ['kind', 'lineage', 'run', 'formation_elapsed', 'change_elapsed', 'trace_outcome', 'went_wrong', 'seq'],
    properties: {
      kind: text, lineage: id, run: id,
      formation_elapsed: count,
      change_elapsed: count,
      trace_outcome: { type: 'enum', values: ['caught_something', 'caught_nothing'] },
      went_wrong: { type: 'string', minLength: 0 },
      seq,
    },
  },
});
