// AC-1, AC-6 — completion through the channel, and the formation trace.
//
// Every case here walks the whole path: approve, issue, open, run, record,
// submit, reduce, complete. That is deliberate. The previous version of this file
// called a standalone `emitAcceptance` with a bare observation and asserted
// `accepted`, which is exactly the bypass the review found — a positive test that
// codified the defect. There is no standalone entry point any more, so a test
// cannot take one by accident.

import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { Kernel } from '../lib/kernel.mjs';
import { identify } from '../lib/identity.mjs';
import { commitCompletion } from '../lib/writer.mjs';
import {
  checkDispositions, checkCitations, checkPresentedView, statementsFrom,
} from '../lib/formation.mjs';
import { group, ok, eq, refuses } from './harness.mjs';

const sha = (s) => `sha256:${createHash('sha256').update(s).digest('hex')}`;
const CONTRACT = join(
  dirname(fileURLToPath(import.meta.url)),
  '..', '..', '..', '..', '.ae', 'features', 'active',
  'F-086-v1-minimal-kernel', 'contract.md',
);

const contractDoc = {
  lineage: 'L',
  obligations: ['O'],
  observations: [{ obligation: 'O', observation: 'sh run-tests.sh' }],
  independence: { required: 'none', assurance: 'workflow_attested' },
};
const bytes = JSON.stringify(contractDoc);
const identity = identify(bytes);
const contract = { ...contractDoc, identity };
const view = { renders_sha256: identity.byte_sha256, rendering_sha256: sha('rendered') };
const deliverable = { kind: 'commit', identity: sha('deliverable') };

// The whole path, once. Each case below perturbs one step of it, so a failure
// says which step was load-bearing rather than that something threw.
function walk(over = {}) {
  const k = new Kernel(join(mkdtempSync(join(tmpdir(), 'ac1-')), 'log.ndjson'));
  const run = 'run1';

  k.approve({ lineage: 'L', revision: 'r1', bytes, identity, view, actor: 'Owner' });
  k.issueAssignment({
    lineage: 'L', run, id: 'A1', contractRevision: 'r1',
    actor: 'Owner', beneficiary: 'P',
    boundary: ['docs/v1'],
    grants: { attempt_producer: 'P', mutation_producer: 'P', obligations: ['O'] },
  });
  const assignment = {
    id: 'A1', lineage: 'L', contract_revision: 'r1', boundary: ['docs/v1'],
    grants: { attempt_producer: 'P', mutation_producer: 'P', obligations: ['O'] },
  };
  // The Assignment is resolved from the log inside `openAttempt`; passing one in
  // is no longer possible, which is what stops a caller choosing its own grants.
  const attempt = k.openAttempt({
    lineage: 'L', run, producer: 'P', obligations: ['O'], submitter: 'P',
  });

  k.recordCommandResult({
    id: 'cr1', lineage: 'L', run, attempt: attempt.attempt,
    command: 'sh run-tests.sh',
    exit: over.exit ?? 0,
    raw: 'ALL GREEN',
    subjects: over.subjects ?? 69,
    inputsUsed: ['in1'],
  });
  k.recordArtifact({
    id: 'art1', lineage: 'L', run, artifactKind: 'commit', identity: sha('artifact'),
  });
  k.recordPackage({
    id: 'pkg1', lineage: 'L', run, contract_revision: 'r1', assignment: 'A1',
    attempt: attempt.attempt, producer: 'P', artifact: 'art1', command_result: 'cr1',
    changed_paths: ['docs/v1/a.md'],
    material_inputs: [{ id: 'in1', identity: sha('in1') }],
    deviations: [], known_risks: [],
  });
  k.submitObservation({
    lineage: 'L', run, obligation: 'O', observation: 'sh run-tests.sh',
    attempt: attempt.attempt, contractRevision: 'r1', assignment: 'A1',
    producer: 'P', artifact: 'art1', pkg: 'pkg1', commandResult: 'cr1', submitter: 'P',
  });

  const inputsNow = over.inputsNow || (() => sha('in1'));
  return { k, run, assignment, inputsNow, attempt };
}

const complete = (w, over = {}) => w.k.complete({
  contract, lineage: 'L', run: w.run, assignment: w.assignment,
  deliverable, actor: 'Owner', inputsNow: w.inputsNow, ...over,
});

export function completionTests() {
  group('AC-1 · the whole path completes', () => {
    const w = walk();
    const { acceptance, verdicts } = complete(w);
    eq('accepted', acceptance.decision.outcome, 'accepted');
    eq('with a recorded verdict beside it',
      verdicts.find((v) => v.obligation === 'O').status, 'passed');
    ok('and a stated absence of review', acceptance.review.required === false);
  });

  group('AC-2 · the verdict comes from the runner, not the submission', () => {
    // The defect this closes: `satisfied` used to be a field the submitter wrote
    // and the Gate copied, which left "done" asserted rather than computed.
    const failing = walk({ exit: 1 });
    refuses('a non-zero exit does not complete', 'not_all_passed', () => complete(failing));

    const vacuous = walk({ subjects: 0 });
    refuses('zero subjects does not complete', 'not_all_passed', () => complete(vacuous));

    // And there is no field to claim otherwise: the observation schema refuses one.
    const w = walk();
    refuses('an observation carrying an outcome', 'format_open',
      () => w.k.ledger.append({
        kind: 'observation', lineage: 'L', run: w.run, obligation: 'O',
        observation: 'sh run-tests.sh', attempt: w.attempt.attempt, contract_revision: 'r1',
        assignment: 'A1', producer: 'P', artifact: 'art1', package: 'pkg1',
        command_result: 'cr1', satisfied: true,
      }));
  });

  group('AC-2 · a changed material input goes stale', () => {
    const w = walk({ inputsNow: () => sha('moved') });
    refuses('completion stops', 'not_all_passed', () => complete(w));
  });

  group('AC-1 · review is stated, never left empty', () => {
    const crossFamily = {
      ...contract,
      independence: {
        required: 'cross_family_required', requested_family: ['openai'],
        assurance: 'workflow_attested',
      },
    };
    const w = walk();
    refuses('a required review that is absent', 'review_required_absent',
      () => complete(w, { contract: crossFamily }));
  });

  group('AC-11 · the write resolves its verdicts from the record', () => {
    const w = walk();
    const { acceptance, verdicts } = complete(w);
    const root = mkdtempSync(join(tmpdir(), 'w-'));

    // A caller map used to be enough, so `{invented: 'passed'}` reached the write.
    refuses('an obligation with no recorded verdict', 'record_not_appended',
      () => commitCompletion({
        root, path: join(root, 'a.json'), acceptance,
        recordedVerdicts: verdicts, obligations: ['O', 'NEVER-RUN'],
        run: w.run, revision: 'r1',
      }));
    refuses('an Acceptance that is not the shape', 'format_open',
      () => commitCompletion({
        root, path: join(root, 'b.json'), acceptance: { not: 'an acceptance' },
        recordedVerdicts: verdicts, obligations: ['O'], run: w.run, revision: 'r1',
      }));
    refuses('a Contract that promised nothing', 'not_all_passed',
      () => commitCompletion({
        root, path: join(root, 'c.json'), acceptance,
        recordedVerdicts: verdicts, obligations: [], run: w.run, revision: 'r1',
      }));
    eq('a real one writes',
      commitCompletion({
        root, path: join(root, 'd.json'), acceptance,
        recordedVerdicts: verdicts, obligations: ['O'], run: w.run, revision: 'r1',
      }).outcome, 'created');
  });

  group('AC-6 · the disposition table checks itself', () => {
    const carriedBy = (criterion, obligation) => criterion === 'AC-4' && obligation === 'determinism';
    eq('a true landing', checkDispositions(
      [{ obligation: 'determinism', disposition: 'carried', lands_in: ['AC-4'] }], carriedBy,
    ).length, 0);
    eq('a false landing is caught', checkDispositions(
      [{ obligation: 'determinism', disposition: 'carried', lands_in: ['AC-9'] }], carriedBy,
    )[0].why, 'AC-9 does not contain this obligation');
    ok('carried but naming no landing', checkDispositions(
      [{ obligation: 'determinism', disposition: 'carried' }], carriedBy,
    ).length > 0);
  });

  group('AC-6 · citations must be specific', () => {
    const prov = {
      verifiable: [{ id: 'D-01' }],
      transcribed: [{ id: 'U-01', broad: true }],
      proposals: [{ id: 'P-01' }],
    };
    eq('a specific citation', checkCitations([{ id: 's', cites: ['D-01'] }], prov).length, 0);
    eq('citing nothing', checkCitations([{ id: 's', cites: [] }], prov)[0].why, 'cites nothing');
    eq('citing only a broad entry',
      checkCitations([{ id: 's', cites: ['U-01'] }], prov)[0].why, 'cites only a broad entry');
  });

  group('AC-6 · statements are read from the Contract, not supplied', () => {
    const statements = statementsFrom(readFileSync(CONTRACT));
    ok('the activated Contract yields statements', statements.length > 10);
    const uncited = statements.filter((s) => s.cites.length === 0);
    eq('none is uncited', uncited.map((s) => s.id).join(','), '');
  });

  group('AC-6 · the presented view is derived from the approved bytes', () => {
    const b = Buffer.from('{"a":1}');
    const render = (x) => Buffer.from(`VIEW:${x.toString()}`);
    const good = {
      renders_sha256: sha(b.toString()),
      rendering_sha256: sha(render(b).toString()),
    };
    ok('a derived view', checkPresentedView({ approvedBytes: b, view: good, render }));
    refuses('a view of different bytes', 'identity_mismatch',
      () => checkPresentedView({
        approvedBytes: b, view: { ...good, rendering_sha256: sha('VIEW:{"a":2}') }, render,
      }));
  });
}
