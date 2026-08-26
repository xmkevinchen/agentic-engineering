// Schema-valid fixtures, built once and shared.
//
// Round 2 found a fixture the schema would have refused: the tests used an
// object-shaped `observations` while the schema required a list, so a real
// mismatch between the schema and the implementation stayed hidden behind a
// fixture neither would accept. Everything here is validated against its own
// schema at import time, so that cannot happen quietly again.

import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { identify } from '../lib/identity.mjs';
import { fileDigest } from '../lib/formation.mjs';
import { validate } from '../lib/schema.mjs';
import { CONTRACT, ASSIGNMENT, EVIDENCE_PACKAGE } from '../schema/objects.mjs';
import { digestBytes } from '../lib/canonical-json.mjs';

export const sha = (s) => digestBytes(Buffer.from(s, 'utf8'));

// A real command, run for real. The subject count is a line the command prints,
// so nothing about the outcome is supplied by the party being judged.
export const COMMAND = "echo GREEN; echo 'AE-SUBJECTS: 69'";
export const FAILING = "echo 'AE-SUBJECTS: 69'; exit 1";
export const VACUOUS = "echo 'AE-SUBJECTS: 0'";
export const UNCOUNTABLE = 'echo GREEN';

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
    attempt: 0,
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
    package: pkgOver = {}, command = COMMAND, inputNow,
    observeBeforePackaging = false,
    obligations = ['O'],
  } = over;

  // Real files, because the Harness digests what is there rather than being told
  // what to record. A run whose artifact and inputs are strings the caller chose
  // is a run whose deliverable and staleness the caller chose.
  const world = mkdtempSync(join(tmpdir(), 'v1w-'));
  const artifactPath = join(world, 'artifact.txt');
  const inputPath = join(world, 'in1.txt');
  writeFileSync(artifactPath, 'the artifact\n');
  writeFileSync(inputPath, 'in1\n');

  // The Contract names the command that will actually be run. Leaving it at the
  // default made the failing, vacuous and uncountable cases pass for the wrong
  // reason — the observation answered a command the Contract had not named, so
  // the outcome was never consulted at all.
  const contract = asObject(contractDoc({
    observations: obligations.map((o) => ({ obligation: o, observation: command })),
    obligations,
    ...contractOver,
  }));
  k.approve({
    lineage, revision: 'r1', bytes: contract.bytes, identity: contract.identity,
    actor, rendered: RENDERED(contract.bytes),
  });

  const assignment = asObject(assignmentDoc(assignmentOver));
  k.issueAssignment({
    lineage, run, bytes: assignment.bytes, identity: assignment.identity, actor,
  });

  const attempt = k.openAttempt({ lineage, run, producer, obligations, submitter: producer });

  const artifact = k.recordArtifact({
    id: 'art1', lineage, run, artifactKind: 'file', path: artifactPath,
  });
  k.runObservation({
    id: 'cr1', lineage, run, attempt: attempt.attempt, command,
    artifact: 'art1', inputsUsed: ['in1'],
  });

  if (observeBeforePackaging) k.observeInput({ lineage, id: 'in1', path: inputPath });

  const pkg = asObject(packageDoc({
    attempt: attempt.attempt,
    material_inputs: [{ id: 'in1', identity: digestBytes(readFileSync(inputPath)) }],
    ...pkgOver,
  }));
  k.recordPackage({
    lineage, run, bytes: pkg.bytes, identity: pkg.identity, submitter: producer,
  });

  if (inputNow) writeFileSync(inputPath, inputNow);
  if (!observeBeforePackaging) k.observeInput({ lineage, id: 'in1', path: inputPath });

  for (const obligation of obligations) {
    k.submitObservation({
      lineage, run, obligation, observation: command, attempt: attempt.attempt,
      producer, artifact: 'art1', pkg: pkg.value.id, commandResult: 'cr1',
      submitter: producer,
    });
  }
  return {
    k, lineage, run, actor, producer, attempt, contract, assignment, pkg,
    world, artifactPath, inputPath, artifact,
  };
}
