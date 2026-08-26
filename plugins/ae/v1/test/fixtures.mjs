// Schema-valid fixtures, built once and shared.
//
// Round 2 found a fixture the schema would have refused: the tests used an
// object-shaped `observations` while the schema required a list, so a real
// mismatch between the schema and the implementation stayed hidden behind a
// fixture neither would accept. Everything here is validated against its own
// schema at import time, so that cannot happen quietly again.

import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { identify } from '../lib/identity.mjs';
import { fileDigest } from '../lib/formation.mjs';
import { validate } from '../lib/schema.mjs';
import { CONTRACT, ASSIGNMENT, EVIDENCE_PACKAGE } from '../schema/objects.mjs';
import { digestBytes } from '../lib/canonical-json.mjs';

export const sha = (s) => digestBytes(Buffer.from(s, 'utf8'));

export const COMMAND = 'sh plugins/ae/scripts/ae-run-tests.sh';

// A real cited file, because approval checks the recorded digest against the
// file. A fixture citing a digest nothing produces would be refused — which is
// the behaviour under test rather than an inconvenience to work around.
export const SOURCE_ROOT = mkdtempSync(join(tmpdir(), 'v1src-'));
mkdirSync(join(SOURCE_ROOT, 'docs', 'v1'), { recursive: true });
writeFileSync(join(SOURCE_ROOT, 'docs', 'v1', 'design.md'),
  '# design\n\nEvidence is externally produced.\n');
export const DESIGN_SHA = fileDigest(join(SOURCE_ROOT, 'docs', 'v1', 'design.md'));

// Cited sources. The Contract's statements cite these ids, and approval checks
// that they do.
const provenance = {
  verifiable: [{
    id: 'D-01',
    source: 'docs/v1/design.md',
    sha256: DESIGN_SHA,
    quote: 'Evidence is externally produced.',
  }],
  transcribed: [
    { id: 'D-02', statement: 'evidence is externally produced', disposition: 'carried' },
    { id: 'D-03', statement: 'releases are qualified', disposition: 'deferred to V2' },
  ],
  proposals: [],
  unknowns: [],
};

export function contractDoc(over = {}) {
  return {
    lineage: 'L',
    revision: 'r1',
    intent: 'exercise the Kernel end to end',
    scope: ['S1 the completion path (D-01)'],
    non_goals: ['N1 no release concept (D-01)'],
    obligations: ['O'],
    observations: [{ obligation: 'O', observation: COMMAND }],
    required_evidence: ['E1 a command result the Harness wrote (D-02)'],
    independence: { required: 'none', assurance: 'workflow_attested' },
    final_signer: 'Human Owner',
    provenance,
    ...over,
  };
}

export function assignmentDoc(over = {}) {
  return {
    id: 'A1',
    lineage: 'L',
    contract_revision: 'r1',
    owner: { role: 'Human Owner', session: 'session-1' },
    dependencies: [],
    boundary: ['docs/v1'],
    grants: { attempt_producer: 'P', mutation_producer: 'P', obligations: ['O'] },
    ...over,
  };
}

export function packageDoc(over = {}) {
  return {
    id: 'pkg1',
    lineage: 'L',
    contract_revision: 'r1',
    assignment: 'A1',
    attempt: 'A1#0',
    producer: 'P',
    artifact: 'art1',
    command_result: 'cr1',
    changed_paths: ['docs/v1/a.md'],
    material_inputs: [{ id: 'in1', identity: sha('in1') }],
    deviations: [],
    known_risks: [],
    ...over,
  };
}

// Bytes and identity together, because that is how every durable object enters
// the Kernel and there is no other way to obtain one.
export function asObject(value) {
  const bytes = JSON.stringify(value);
  return { bytes, identity: identify(bytes), value };
}

export const RENDERED = (bytes) => `--- rendered ---\n${bytes}\n`;

// Refuse to export a fixture the schema would not accept.
for (const [name, schema, value] of [
  ['Contract', CONTRACT, contractDoc()],
  ['Assignment', ASSIGNMENT, assignmentDoc()],
  ['EvidencePackage', EVIDENCE_PACKAGE, packageDoc()],
]) {
  const problems = validate(schema, value);
  if (problems.length > 0) {
    throw new Error(`fixture ${name} is not schema-valid: ${JSON.stringify(problems)}`);
  }
}

// One complete run, through the operations a real party would use. Every test
// that needs a populated log builds it this way rather than planting records:
// a fixture that reaches the log by a route no party can take proves nothing
// about the route parties actually take.
export function walk(k, over = {}) {
  const {
    lineage = 'L', run = 'run1', actor = 'Human Owner', producer = 'P',
    contract: contractOver = {}, assignment: assignmentOver = {},
    package: pkgOver = {}, exit = 0, subjects = 69, inputNow,
    obligations = ['O'],
  } = over;

  const contract = asObject(contractDoc(contractOver));
  k.approve({
    lineage, revision: 'r1', bytes: contract.bytes, identity: contract.identity,
    actor, rendered: RENDERED(contract.bytes),
  });

  const assignment = asObject(assignmentDoc(assignmentOver));
  k.issueAssignment({
    lineage, run, bytes: assignment.bytes, identity: assignment.identity, actor,
  });

  const attempt = k.openAttempt({ lineage, run, producer, obligations, submitter: producer });

  k.recordArtifact({
    id: 'art1', lineage, run, artifactKind: 'commit', identity: sha('artifact'),
  });
  k.recordCommandResult({
    id: 'cr1', lineage, run, attempt: attempt.attempt, command: COMMAND,
    artifact: 'art1', exit, raw: 'GREEN', subjects, inputsUsed: ['in1'],
  });

  const pkg = asObject(packageDoc({ attempt: attempt.attempt, ...pkgOver }));
  k.recordPackage({
    lineage, run, bytes: pkg.bytes, identity: pkg.identity, submitter: producer,
  });

  k.observeInput({ lineage, id: 'in1', identity: inputNow || sha('in1') });

  for (const obligation of obligations) {
    k.submitObservation({
      lineage, run, obligation, observation: COMMAND, attempt: attempt.attempt,
      producer, artifact: 'art1', pkg: pkg.value.id, commandResult: 'cr1',
      submitter: producer,
    });
  }
  return { k, lineage, run, actor, producer, attempt, contract, assignment, pkg };
}
