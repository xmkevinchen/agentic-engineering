// The four durable objects — S1, AC-3, AC-12.
//
// Draft. AC-12's ordering is deliberate: drafted, exercised by the real run, then
// frozen with the identity of what enforces them. Freezing now would be the
// upfront horizontal build the plan forbids, one level down.
//
// Every position is constrained, recursively. `lintSchema` is run over each of
// these in the test suite, so a `{}` slipping in later fails rather than quietly
// reopening the format.

const digest = { type: 'digest' };
const id = { type: 'string', minLength: 1 };
const text = { type: 'string', minLength: 1 };

const identity = {
  type: 'object', additional: false,
  required: ['byte_sha256', 'canonical_sha256', 'length'],
  properties: {
    byte_sha256: digest,
    canonical_sha256: digest,
    length: { type: 'integer', minimum: 0 },
  },
};

// A material input is named and carries the identity it had when observed. Both
// halves are needed: the name so completeness can be checked against what the run
// used, the identity so a later change is detectable.
// Named, and pointed at a file. Without the path an id was a label the producer
// chose, and the latest observation for that label won whatever it had read: the
// packaged input could change while a decoy under the same id was observed
// unchanged, and the run stayed `passed`.
const materialInput = {
  type: 'object', additional: false,
  required: ['id', 'path', 'identity'],
  properties: { id, path: text, identity: digest },
};

export const CONTRACT = {
  type: 'object', additional: false,
  required: [
    'lineage', 'revision', 'intent', 'scope', 'non_goals', 'obligations',
    'observations', 'required_evidence', 'independence', 'final_signer', 'provenance',
  ],
  properties: {
    lineage: id,
    revision: id,
    // Genesis carries no predecessor; a revision carries the prior revision's byte
    // identity. Two shapes rather than one optional field, because a closed schema
    // that refuses empty values cannot express "absent" as a value.
    predecessor: digest,
    intent: text,
    scope: { type: 'array', minItems: 1, items: text },
    non_goals: { type: 'array', minItems: 1, items: text },
    obligations: { type: 'array', minItems: 1, items: id },
    // Which observation answers which obligation. AC-2's first clause reads this:
    // a result for something else is not evidence for this.
    //
    // A list, not an obligation-keyed object. A dynamic key set cannot be closed
    // — `properties: {}` admits anything, which the linter caught here — so the
    // shape is fixed and the *relation* (every obligation named exactly once) is
    // checked in code, where data relations belong.
    observations: {
      type: 'array', minItems: 1,
      items: {
        type: 'object', additional: false,
        // The Contract names what is run, what it is run against, and what it
        // reads. All three used to be arguments: the producer chose which
        // artifact its passing command vouched for, and which inputs counted as
        // material — so it could declare none and nothing was stale, ever.
        required: ['obligation', 'observation', 'artifact', 'material_inputs'],
        properties: {
          obligation: id,
          observation: text,
          artifact: text,
          material_inputs: { type: 'array', minItems: 0, items: text },
        },
      },
    },
    required_evidence: { type: 'array', minItems: 1, items: text },
    independence: {
      type: 'object', additional: false,
      required: ['required', 'assurance'],
      properties: {
        required: { type: 'enum', values: ['none', 'cross_family_required'] },
        // The Contract is the sole authoritative source of the requested family.
        // The Assignment has no such field, by construction below.
        requested_family: { type: 'array', minItems: 1, items: id },
        assurance: { type: 'enum', values: ['workflow_attested'] },
      },
    },
    final_signer: text,
    provenance: {
      type: 'object', additional: false,
      required: ['verifiable', 'transcribed', 'proposals', 'unknowns'],
      properties: {
        verifiable: {
          type: 'array', minItems: 1,
          items: {
            type: 'object', additional: false,
            // `quote` is the passage the citation rests on, and approval checks
            // the source contains it. A digest establishes that a file has not
            // changed, not that it says what the citing statement claims — which
            // is AC-6's falsifier "citing a source that does not contain the
            // cited content", and nothing checked it.
            required: ['id', 'source', 'sha256', 'quote'],
            properties: { id, source: text, sha256: digest, quote: text },
          },
        },
        transcribed: {
          type: 'array', minItems: 1,
          items: {
            type: 'object', additional: false,
            required: ['id', 'statement', 'disposition'],
            properties: { id, statement: text, disposition: text },
          },
        },
        proposals: {
          type: 'array', minItems: 0,
          items: {
            type: 'object', additional: false,
            required: ['id', 'proposal', 'affects'],
            properties: { id, proposal: text, affects: text },
          },
        },
        unknowns: {
          type: 'array', minItems: 0,
          items: {
            type: 'object', additional: false,
            required: ['id', 'unknown', 'status'],
            properties: { id, unknown: text, status: text },
          },
        },
      },
    },
  },
};

export const ASSIGNMENT = {
  type: 'object', additional: false,
  required: ['id', 'lineage', 'contract_revision', 'owner', 'dependencies', 'boundary', 'grants'],
  properties: {
    id,
    lineage: id,
    contract_revision: id,
    owner: {
      type: 'object', additional: false,
      required: ['role', 'session'],
      properties: { role: text, session: id },
    },
    dependencies: { type: 'array', minItems: 0, items: id },
    boundary: { type: 'array', minItems: 1, items: text },
    grants: {
      type: 'object', additional: false,
      required: ['attempt_producer', 'mutation_producer', 'obligations'],
      properties: {
        attempt_producer: id,
        mutation_producer: id,
        obligations: { type: 'array', minItems: 1, items: id },
      },
    },
    // No family field. Not omitted by oversight — `additional: false` makes
    // carrying one a validation failure, which is the point: two sources for one
    // fact is how the fact gets quietly changed.
  },
};

export const EVIDENCE_PACKAGE = {
  type: 'object', additional: false,
  required: [
    'id', 'lineage', 'contract_revision', 'assignment', 'attempt', 'producer',
    'artifact', 'command_result', 'changed_paths', 'material_inputs',
    'deviations', 'known_risks',
  ],
  properties: {
    id,
    lineage: id,
    contract_revision: id,
    assignment: id,
    // The position of the record that opened the attempt, not a minted name.
    attempt: { type: 'integer', minimum: 0 },
    producer: id,
    // Both are references to records, never restatements of them. The package
    // names the artifact the Harness recorded and the result the Harness wrote;
    // it carries neither's content, which is how it can carry the fields D-01 §9
    // requires without its author being able to write what they say. Restating
    // the artifact's identity here made the package a second source for it, and
    // the two were never compared.
    artifact: id,
    command_result: id,
    changed_paths: { type: 'array', minItems: 0, items: text },
    material_inputs: { type: 'array', minItems: 0, items: materialInput },
    deviations: { type: 'array', minItems: 0, items: text },
    known_risks: { type: 'array', minItems: 0, items: text },
  },
};

export const ACCEPTANCE = {
  type: 'object', additional: false,
  required: ['lineage', 'contract_revision', 'contract_identity', 'deliverable', 'decision', 'review'],
  properties: {
    lineage: id,
    contract_revision: id,
    contract_identity: identity,
    deliverable: {
      type: 'object', additional: false,
      required: ['kind', 'identity'],
      properties: {
        kind: { type: 'enum', values: ['commit', 'diff', 'file'] },
        identity: digest,
      },
    },
    decision: {
      type: 'object', additional: false,
      required: ['outcome', 'origin', 'run', 'seq'],
      properties: {
        outcome: { type: 'enum', values: ['accepted'] },
        origin: { type: 'enum', values: ['host'] },
        run: id,
        seq: { type: 'integer', minimum: 0 },
      },
    },
    // Where no independence was required this states that, and the Gate checks
    // the statement against the Contract. A stated absence, never an empty slot.
    review: {
      type: 'object', additional: false,
      required: ['required'],
      properties: {
        required: { type: 'boolean' },
        statement: text,
        accepted_review: digest,
      },
    },
  },
};

export const OBJECTS = Object.freeze({
  Contract: CONTRACT,
  Assignment: ASSIGNMENT,
  EvidencePackage: EVIDENCE_PACKAGE,
  Acceptance: ACCEPTANCE,
});

// Relations a schema cannot state, because they are about the data rather than
// its shape. Kept beside the schemas so the pair is read together.
export function checkContractRelations(contract) {
  const problems = [];
  const named = contract.observations.map((o) => o.obligation);
  const seen = new Set();
  for (const o of named) {
    if (seen.has(o)) problems.push({ code: 'format_open', why: `obligation named twice: ${o}` });
    seen.add(o);
  }
  for (const o of contract.obligations) {
    if (!seen.has(o)) problems.push({ code: 'format_open', why: `obligation with no named observation: ${o}` });
  }
  for (const o of named) {
    if (!contract.obligations.includes(o)) {
      problems.push({ code: 'format_open', why: `observation for an obligation not in the list: ${o}` });
    }
  }
  // Cross-family requires a requested family; declaring none and naming one, or
  // requiring it and naming none, are both incoherent.
  const ind = contract.independence;
  if (ind.required === 'cross_family_required' && !ind.requested_family) {
    problems.push({ code: 'format_open', why: 'cross_family_required without a requested family' });
  }
  if (ind.required === 'none' && ind.requested_family) {
    problems.push({ code: 'format_open', why: 'a requested family with no independence requirement' });
  }
  return problems;
}
