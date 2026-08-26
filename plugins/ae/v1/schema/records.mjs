// Record shapes — AC-12 applied to the log, not only to the four objects.
//
// The Ledger validated that a kind was known and accepted anything beside it.
// Closure over names is not closure: a record could carry missing, null or
// additional fields and still append. Every kind has a shape here, and `append`
// refuses anything that does not match it.

const id = { type: 'string', minLength: 1 };
const text = { type: 'string', minLength: 1 };
const seq = { type: 'integer' };
const digest = { type: 'digest' };

const identity = {
  type: 'object', additional: false,
  required: ['byte_sha256', 'canonical_sha256', 'length'],
  properties: { byte_sha256: digest, canonical_sha256: digest, length: { type: 'integer' } },
};

const view = {
  type: 'object', additional: false,
  required: ['renders_sha256', 'rendering_sha256'],
  properties: { renders_sha256: digest, rendering_sha256: digest },
};

const approvalBase = {
  lineage: id, revision: id, identity, decision: seq, seq,
  kind: { type: 'string', minLength: 1 },
};

export const RECORDS = Object.freeze({
  // Genesis and revision are separate shapes: a genesis has no predecessor, and a
  // closed schema that refuses empty values cannot express "absent" as a value.
  contract_approved_genesis: {
    type: 'object', additional: false,
    required: ['kind', 'lineage', 'revision', 'identity', 'decision', 'seq'],
    properties: { ...approvalBase },
  },
  contract_approved_revision: {
    type: 'object', additional: false,
    required: ['kind', 'lineage', 'revision', 'identity', 'predecessor', 'decision', 'seq'],
    properties: { ...approvalBase, predecessor: digest },
  },
  assignment_issued: {
    type: 'object', additional: false,
    required: ['kind', 'lineage', 'id', 'contract_revision', 'actor', 'beneficiary', 'origin', 'seq'],
    properties: {
      kind: text, lineage: id, id, contract_revision: id, actor: id, beneficiary: id,
      origin: { type: 'const', value: 'host' }, seq,
    },
  },
  attempt_opened: {
    type: 'object', additional: false,
    required: ['kind', 'lineage', 'assignment', 'attempt', 'producer', 'obligations', 'seq'],
    properties: {
      kind: text, lineage: id, assignment: id, attempt: id, producer: id,
      obligations: { type: 'array', minItems: 1, items: id }, seq,
    },
  },
  command_result: {
    type: 'object', additional: false,
    required: ['kind', 'lineage', 'run', 'attempt', 'command', 'raw', 'subjects', 'inputs_used', 'origin', 'seq'],
    properties: {
      kind: text, lineage: id, run: id, attempt: id, command: text,
      raw: { type: 'string', minLength: 0 },
      subjects: { type: 'integer' },
      inputs_used: { type: 'array', minItems: 0, items: id },
      origin: { type: 'const', value: 'harness' }, seq,
    },
  },
  observation: {
    type: 'object', additional: false,
    required: [
      'kind', 'lineage', 'obligation', 'observation', 'attempt', 'contract_revision',
      'assignment', 'producer', 'artifact', 'package', 'command_result', 'satisfied', 'seq',
    ],
    properties: {
      kind: text, lineage: id, obligation: id, observation: text, attempt: id,
      contract_revision: id, assignment: id, producer: id, artifact: id,
      package: id, command_result: id, satisfied: { type: 'boolean' }, seq,
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
      attempt: id,
      selected: digest,
      seq,
    },
  },
  capability_unavailable: {
    type: 'object', additional: false,
    required: ['kind', 'lineage', 'obligation', 'attempt', 'requested', 'origin', 'seq'],
    properties: {
      kind: text, lineage: id, obligation: id, attempt: id,
      requested: { type: 'array', minItems: 1, items: id },
      origin: { type: 'const', value: 'harness' }, seq,
    },
  },
  dispatch_attempt: {
    type: 'object', additional: false,
    required: ['kind', 'lineage', 'run', 'attempt', 'obligation', 'requested', 'seq'],
    properties: {
      kind: text, lineage: id, run: id, attempt: id, obligation: id,
      requested: { type: 'array', minItems: 1, items: id }, seq,
    },
  },
  delivery: {
    type: 'object', additional: false,
    required: ['kind', 'lineage', 'to', 'carried', 'provenance', 'origin', 'seq'],
    properties: {
      kind: text, lineage: id, to: id, carried: text, provenance: digest,
      origin: { type: 'const', value: 'harness' }, seq,
    },
  },
  human_decision: {
    type: 'object', additional: false,
    required: ['kind', 'operation', 'actor', 'lineage', 'origin', 'seq'],
    properties: {
      kind: text,
      operation: {
        type: 'enum',
        values: ['activation', 'assignment_issuance', 'signoff', 'unavailable_decision',
          'retreat_decision', 'worth_decision'],
      },
      actor: id, lineage: id,
      origin: { type: 'const', value: 'host' },
      choice: { type: 'enum', values: ['wait', 'stop', 'amend'] },
      revision: id,
      view,
      seq,
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
    required: ['kind', 'lineage', 'run', 'acceptance', 'path', 'seq'],
    properties: { kind: text, lineage: id, run: id, acceptance: digest, path: text, seq },
  },
  run_record: {
    type: 'object', additional: false,
    required: ['kind', 'lineage', 'run', 'formation_elapsed', 'change_elapsed', 'trace_outcome', 'went_wrong', 'seq'],
    properties: {
      kind: text, lineage: id, run: id,
      formation_elapsed: { type: 'integer' },
      change_elapsed: { type: 'integer' },
      trace_outcome: { type: 'enum', values: ['caught_something', 'caught_nothing'] },
      went_wrong: { type: 'string', minLength: 0 },
      seq,
    },
  },
});
