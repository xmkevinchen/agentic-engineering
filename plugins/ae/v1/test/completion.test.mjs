// AC-1, AC-6 — completion through the channel, and the formation trace.
//
// Every case here walks the whole path: approve, issue, open, run, record,
// submit, reduce, complete. That is deliberate. An earlier version of this file
// called a standalone `emitAcceptance` with a bare observation and asserted
// `accepted`, which is exactly the bypass the review found — a positive test that
// codified the defect. There is no standalone entry point any more, so a test
// cannot take one by accident.

import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { Kernel } from '../lib/kernel.mjs';
import { checkCitations, statementsFrom } from '../lib/formation.mjs';
import { group, ok, eq, refuses } from './harness.mjs';
import { validate } from '../lib/schema.mjs';
import { digestBytes } from '../lib/canonical-json.mjs';
import { RECORDS } from '../schema/records.mjs';
import { ACCEPTANCE } from '../schema/objects.mjs';
import {
  asObject, assignmentDoc, contractDoc, walk, sha, RENDERED, OWNER,
  COMMAND, FAILING, VACUOUS, UNCOUNTABLE, ARTIFACT, INPUT,
  SOURCE_ROOT, DESIGN_SHA,
} from './fixtures.mjs';

// The activated Contract, in the repository. `AE_REPO_ROOT` exists because the
// mutation check runs the suite from a copy of this slice, and a path relative to
// the module would resolve into the copy's parent — which is a temporary
// directory with no repository in it.
const REPO = process.env.AE_REPO_ROOT
  || join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');
const CONTRACT = join(
  REPO, '.ae', 'features', 'active', 'F-086-v1-minimal-kernel', 'contract.md',
);

// A Kernel that can complete: the destination belongs to it, not to whoever
// calls the write.
function fresh() {
  const dir = mkdtempSync(join(tmpdir(), 'ac1-'));
  return new Kernel(join(dir, 'log.ndjson'), { completionRoot: dir, sourceRoot: SOURCE_ROOT, render: RENDERED, owner: OWNER });
}

const run = (over = {}) => walk(fresh(), over);
const complete = (w, over = {}) => w.k.complete({
  lineage: w.lineage, run: w.run, actor: 'Human Owner', ...over,
});

export function completionTests() {
  group('AC-1 · the whole path completes', () => {
    const w = run();
    const { acceptance, written } = complete(w);
    eq('accepted', acceptance.decision.outcome, 'accepted');
    ok('and a stated absence of review', acceptance.review.required === false);
    eq('the file was created', written.outcome, 'created');
    const onDisk = JSON.parse(readFileSync(written.path, 'utf8'));
    eq('what was written is the Acceptance', onDisk.decision.run, w.run);
    // Against the schema, not against a field of it. The Kernel builds the
    // Acceptance from parts it has already checked, so the claim worth holding is
    // that what reached the disk is the closed shape — read back, not asserted at
    // the point of writing where nothing could contradict it.
    eq('and it is the closed shape', validate(ACCEPTANCE, onDisk).join(','), '');

    // The deliverable is the artifact the evidence exercised, resolved from the
    // record. It used to be an argument, so an Acceptance could name one thing
    // while the evidence had exercised another.
    // And that identity is the file's, digested by the Harness. It was an
    // argument, so the producer named what its own evidence would be taken to
    // have exercised.
    eq('the deliverable is the recorded artifact',
      acceptance.deliverable.identity, w.artifact.identity);
    eq('and the artifact is what is on disk',
      w.artifact.identity, digestBytes(readFileSync(w.artifactPath)));

    const verdicts = w.k.records().filter((r) => r.kind === 'gate_result');
    eq('with a recorded verdict beside it',
      verdicts.find((v) => v.obligation === 'O').status, 'passed');
  });

  group('AC-1 · completion is written once', () => {
    const w = run();
    complete(w);
    refuses('a second completion does not overwrite', 'write_would_clobber', () => complete(w));
  });

  group('AC-2 · the verdict comes from the runner, not the submission', () => {
    // The defect this closes: `satisfied` used to be a field the submitter wrote
    // and the Gate copied, which left "done" asserted rather than computed.
    refuses('a non-zero exit does not complete', 'not_all_passed',
      () => complete(run({ command: FAILING })));
    refuses('zero subjects does not complete', 'not_all_passed',
      () => complete(run({ command: VACUOUS })));
    // And a command that printed no count at all: the runner could not establish
    // one, which is not the same as establishing zero.
    refuses('an uncountable run does not complete', 'not_all_passed',
      () => complete(run({ command: UNCOUNTABLE })));

    // And there is no field to claim otherwise: the observation schema refuses
    // one, so no path — Kernel or tampered log — can put an outcome in a
    // submission and have it read as a record.
    const problems = validate(RECORDS.observation, {
      kind: 'observation', lineage: 'L', run: 'run1', obligation: 'O',
      observation: COMMAND, attempt: 'a1', contract_revision: 'r1',
      assignment: 'A1', producer: 'P', artifact: 'art1', package: 'pkg1',
      command_result: 'cr1', satisfied: true, seq: 0,
    });
    ok('an observation carrying an outcome is not a valid record', problems.length > 0);
  });

  group('AC-2 · a changed material input goes stale', () => {
    refuses('completion stops', 'not_all_passed',
      () => complete(run({ inputNow: 'the input moved\n' })));
  });

  group('AC-2 · an input observed before the evidence proves nothing', () => {
    // Staleness asks whether the input is current now, so an observation taken
    // before the package was written answers a different question — it says the
    // input was current at some earlier moment, which every stale input also was.
    const k = fresh();
    const w = walk(k);
    const before = fresh();
    const b = walk(before, { observeBeforePackaging: true });
    refuses('completion stops', 'not_all_passed',
      () => before.complete({ lineage: b.lineage, run: b.run, actor: 'Human Owner' }));
    ok('while observing after it does not', k.status({ lineage: 'L', run: w.run }).allPassed);
  });

  group('AC-2 · evidence from one run does not complete another', () => {
    // Everything below is real evidence, recorded by the granted producer, for
    // `run1`. Selection and every resolver used to span the lineage, so it
    // decided `run2` as well.
    const k = fresh();
    walk(k);
    refuses('a second run has no Assignment of its own', 'assignment_not_issued',
      () => k.complete({ lineage: 'L', run: 'run2', actor: 'Human Owner' }));

    // And issuing one for `run2` does not let `run1`'s evidence answer for it:
    // the second run has an Assignment and an attempt, and nothing submitted.
    const a2 = asObject(assignmentDoc({ id: 'A2' }));
    k.issueAssignment({
      lineage: 'L', run: 'run2', bytes: a2.bytes, identity: a2.identity, actor: 'Human Owner',
    });
    k.openAttempt({ lineage: 'L', run: 'run2', producer: 'P', obligations: ['O'], submitter: 'P' });
    eq('the second run is pending, not passed',
      k.status({ lineage: 'L', run: 'run2' }).byObligation.O.status, 'pending');
    // And the first run is not disturbed by the second's existence. Selection
    // took the latest attempt in the lineage, so opening `run2` turned `run1`
    // from passed into pending — a completed run undone by an unrelated retry.
    eq('and the first run still passes',
      k.status({ lineage: 'L', run: 'run1' }).byObligation.O.status, 'passed');
    refuses('and cannot complete', 'not_all_passed',
      () => k.complete({ lineage: 'L', run: 'run2', actor: 'Human Owner' }));
  });

  group('AC-1 · two Kernels on one log do not mint the same attempt', () => {
    // The path that showed the run comparison in admissibility was not a
    // duplicate of selection's attempt filter. Each Ledger used to cache its
    // sequence number at construction, so two Kernels opened on one log handed
    // out the same one — and an attempt id is built from an Assignment id and a
    // sequence number, with Assignment ids unique only within a run.
    const dir = mkdtempSync(join(tmpdir(), 'two-'));
    const logPath = join(dir, 'log.ndjson');
    const k1 = new Kernel(logPath, { completionRoot: dir, sourceRoot: SOURCE_ROOT, render: RENDERED, owner: OWNER });
    const k2 = new Kernel(logPath, { completionRoot: dir, sourceRoot: SOURCE_ROOT, render: RENDERED, owner: OWNER });

    const c = asObject(contractDoc());
    k1.approve({
      lineage: 'L', revision: 'r1', bytes: c.bytes, identity: c.identity,
      actor: 'Human Owner', rendered: RENDERED(c.bytes),
    });
    const a = asObject(assignmentDoc());
    k1.issueAssignment({
      lineage: 'L', run: 'run1', bytes: a.bytes, identity: a.identity, actor: 'Human Owner',
    });
    k2.issueAssignment({
      lineage: 'L', run: 'run2', bytes: a.bytes, identity: a.identity, actor: 'Human Owner',
    });
    const at1 = k1.openAttempt({
      lineage: 'L', run: 'run1', producer: 'P', obligations: ['O'], submitter: 'P',
    });
    const at2 = k2.openAttempt({
      lineage: 'L', run: 'run2', producer: 'P', obligations: ['O'], submitter: 'P',
    });
    ok('the two attempts are distinct', at1.attempt !== at2.attempt);

    // And even if they were not, the run comparison separates the submissions.
    const seqs = k1.records().map((r) => r.seq);
    eq('no sequence number is handed out twice', new Set(seqs).size, seqs.length);
  });

  group('AC-4 · the latest attempt decides at the moment the bytes land', () => {
    // Several Kernels may share a log, so between a reduction and the write that
    // rests on it another can open a newer attempt and reduce again. The write
    // re-derives rather than carrying the earlier answer; this exercises the
    // reader both use, on a log two Kernels advanced.
    const dir = mkdtempSync(join(tmpdir(), 'race-'));
    const logPath = join(dir, 'log.ndjson');
    const k1 = new Kernel(logPath, {
      completionRoot: dir, sourceRoot: SOURCE_ROOT, render: RENDERED, owner: OWNER,
    });
    const w = walk(k1);
    eq('the run passes', k1.status({ lineage: 'L', run: w.run }).byObligation.O.status, 'passed');

    const k2 = new Kernel(logPath, {
      completionRoot: dir, sourceRoot: SOURCE_ROOT, render: RENDERED, owner: OWNER,
    });
    // The second Kernel opens an attempt and does *not* reduce, so the newest
    // recorded verdict still says `passed` while the run is `pending`. Reading
    // that recorded answer was the defect: a stale answer read twice is one
    // answer. Completion reduces again.
    k2.openAttempt({ lineage: 'L', run: w.run, producer: 'P', obligations: ['O'], submitter: 'P' });
    eq('the recorded verdict is now stale',
      k1.records().filter((r) => r.kind === 'gate_result').pop().status, 'passed');
    eq('and reducing again says otherwise',
      k1.status({ lineage: 'L', run: w.run }).byObligation.O.status, 'pending');
    refuses('so completion does not land', 'not_all_passed',
      () => k1.complete({ lineage: 'L', run: w.run, actor: 'Human Owner' }));
  });

  group('AC-1 · a retry cannot change what the run delivers', () => {
    // The Contract names the artifact for each obligation, so a second attempt
    // answers for the same file the first did. It used to be an argument, and a
    // failed attempt naming one artifact followed by a passing retry naming
    // another left completion with two — an attempt the Gate had superseded still
    // deciding what could be accepted.
    const k = fresh();
    const w = walk(k, { command: FAILING });
    const retry = k.openAttempt({
      lineage: 'L', run: w.run, producer: 'P', obligations: ['O'], submitter: 'P',
    });
    k.runObservation({
      id: 'cr2', lineage: 'L', run: w.run, attempt: retry.attempt,
      obligation: 'O', artifact: 'art2',
    });
    const pkg2 = asObject({
      ...w.pkg.value, id: 'pkg2', attempt: retry.attempt, artifact: 'art2', command_result: 'cr2',
    });
    k.recordPackage({
      lineage: 'L', run: w.run, bytes: pkg2.bytes, identity: pkg2.identity, submitter: 'P',
    });
    k.observeInput({ lineage: 'L', path: INPUT });
    k.submitObservation({
      lineage: 'L', run: w.run, obligation: 'O', observation: FAILING,
      attempt: retry.attempt, producer: 'P', artifact: 'art2', pkg: 'pkg2',
      commandResult: 'cr2', submitter: 'P',
    });
    eq('the retry answers for the same file', k.deliverableFor({
      lineage: 'L', run: w.run, contract: k.contractFor('L').contract,
    }).identity, digestBytes(readFileSync(join(SOURCE_ROOT, ARTIFACT))));
  });

  group('AC-1 · a run that delivers two things delivers none', () => {
    // Two obligations, each naming its own artifact — a coherent Contract, and
    // one the Acceptance cannot answer: there is no single deliverable to name,
    // and picking one is not resolving.
    const second = 'work/artifact2.txt';
    writeFileSync(join(SOURCE_ROOT, second), 'another artifact\n');
    const k = fresh();
    const w = walk(k, {
      obligations: ['O', 'O2'],
      contract: {
        obligations: ['O', 'O2'],
        observations: [
          { obligation: 'O', observation: COMMAND, artifact: ARTIFACT, material_inputs: [INPUT] },
          { obligation: 'O2', observation: COMMAND, artifact: second, material_inputs: [INPUT] },
        ],
      },
      assignment: {
        grants: { attempt_producer: 'P', mutation_producer: 'P', obligations: ['O', 'O2'] },
      },
    });
    k.runObservation({
      id: 'cr2', lineage: 'L', run: w.run, attempt: w.attempt.attempt,
      obligation: 'O2', artifact: 'art2',
    });
    const pkg2 = asObject({
      ...w.pkg.value, id: 'pkg2', artifact: 'art2', command_result: 'cr2',
    });
    k.recordPackage({
      lineage: 'L', run: w.run, bytes: pkg2.bytes, identity: pkg2.identity, submitter: 'P',
    });
    k.observeInput({ lineage: 'L', path: INPUT });
    k.submitObservation({
      lineage: 'L', run: w.run, obligation: 'O2', observation: COMMAND,
      attempt: w.attempt.attempt, producer: 'P', artifact: 'art2', pkg: 'pkg2',
      commandResult: 'cr2', submitter: 'P',
    });
    eq('both obligations pass', k.status({ lineage: 'L', run: w.run }).allPassed, true);
    refuses('but the run names two artifacts', 'binding_cross_execution',
      () => k.complete({ lineage: 'L', run: w.run, actor: OWNER }));
  });

  group('AC-1 · a sign-off before the Gate reported is refused', () => {
    // AC-1 names this as a case that must be rejected, and it was not being
    // exercised: the check sat downstream of `complete`'s own sign-off, which is
    // always appended after the reduction, so nothing could reach it. It is
    // refused where a caller can actually attempt one.
    const k = fresh();
    const w = walk(k);
    refuses('nothing has been reduced yet', 'signoff_before_gate',
      () => k.signOff({ lineage: 'L', run: w.run, actor: 'Human Owner' }));
    k.status({ lineage: 'L', run: w.run });

    // It stamps `origin: host`, so what it signs for is resolved and only
    // *whether* to sign is the caller's. It took a caller-chosen actor, revision
    // and deliverable, and could mint a host record saying an unrelated party had
    // signed for a revision that did not exist.
    refuses('someone the Contract does not name', 'authority_not_granted',
      () => k.signOff({ lineage: 'L', run: w.run, actor: 'P' }));
    const signed = k.signOff({ lineage: 'L', run: w.run, actor: 'Human Owner' });
    eq('and what it signs for is resolved', signed.contract_revision, 'r1');
    eq('including the deliverable', signed.deliverable, w.artifact.identity);
    eq('externally produced', signed.origin, 'host');
  });

  group('AC-5 · the Contract may not nominate its own signer', () => {
    // The Kernel serves one Human Owner, configured outside any Contract, and a
    // Contract names who signs it. Approval is where the two are bound: reading
    // the signer out of the document under review is what let a caller write a
    // Contract naming itself and hold every authority it granted.
    const k = fresh();
    const other = asObject(contractDoc({ final_signer: 'Someone Else' }));
    refuses('a Contract naming another signer', 'authority_not_granted',
      () => k.approve({
        lineage: 'L', revision: 'r1', bytes: other.bytes, identity: other.identity,
        actor: OWNER, rendered: RENDERED(other.bytes),
      }));
  });

  group('AC-1 · there is nothing to sign for in a run that failed', () => {
    // It checked only that the Gate had reported *something*, so a failing run
    // produced a host sign-off record — a durable statement that the Human Owner
    // signed for work the Gate had refused.
    const k = fresh();
    const w = walk(k, { command: FAILING });
    k.status({ lineage: 'L', run: w.run });
    refuses('a sign-off for a failing run', 'not_all_passed',
      () => k.signOff({ lineage: 'L', run: w.run, actor: OWNER }));
  });

  group('AC-9 · facts recorded twice are facts recorded by nobody', () => {
    // Uniqueness is decided where the facts are read. The writer refuses a second
    // set, so the state can only be reached from outside — which is the case the
    // reader exists for.
    const dir = mkdtempSync(join(tmpdir(), 'twice-'));
    const logPath = join(dir, 'log.ndjson');
    const src = fresh();
    const w = walk(src);
    src.status({ lineage: 'L', run: w.run });
    src.recordRun({ lineage: 'L', run: w.run, traceOutcome: 'caught_nothing', wentWrong: '' });
    const lines = src.records().map(({ seq, ...r }) => r);
    const facts = lines.find((r) => r.kind === 'run_record_clean');
    writeFileSync(logPath, [...lines, facts].map((r) => JSON.stringify(r)).join('\n') + '\n');
    const doubled = new Kernel(logPath, {
      completionRoot: dir, sourceRoot: SOURCE_ROOT, render: RENDERED, owner: OWNER,
    });
    refuses('two sets of run facts', 'run_facts_incomplete',
      () => doubled.retreatCondition('L', w.run));
    refuses('and no judgement can answer them', 'run_facts_incomplete',
      () => doubled.decideWorth({ lineage: 'L', run: w.run, actor: OWNER, choice: 'yes' }));
  });

  group('AC-3 · a deliverable nothing recorded is no deliverable', () => {
    // Submitting an observation does not require its artifact to have been
    // recorded, so the id in the record is the producer's word. The reader that
    // turns it into the Acceptance's deliverable is where that word is checked.
    const dir = mkdtempSync(join(tmpdir(), 'ghost-'));
    const logPath = join(dir, 'log.ndjson');
    const src = fresh();
    const w = walk(src);
    const lines = src.records().map(({ seq, ...r }) => (
      r.kind === 'observation' ? { ...r, artifact: 'ghost' } : r
    ));
    writeFileSync(logPath, lines.map((r) => JSON.stringify(r)).join('\n') + '\n');
    const ghosted = new Kernel(logPath, {
      completionRoot: dir, sourceRoot: SOURCE_ROOT, render: RENDERED, owner: OWNER,
    });
    const { contract } = ghosted.contractForRun('L', w.run);
    refuses('an artifact the log never recorded', 'binding_unresolved',
      () => ghosted.deliverableFor({ lineage: 'L', run: w.run, contract }));
  });

  group('AC-1 · a lineage with two genesis approvals has no history', () => {
    // Two writers can each see a coherent history and together leave two roots.
    // The writer cannot see it — its check and its append are two operations — so
    // the reader is where a second genesis has to be refused.
    const dir = mkdtempSync(join(tmpdir(), 'twogen-'));
    const logPath = join(dir, 'log.ndjson');
    const src = fresh();
    walk(src);
    const lines = src.records().map(({ seq, ...r }) => r);
    const genesis = lines.find((r) => r.kind === 'contract_approved_genesis');
    writeFileSync(logPath, [...lines, genesis].map((r) => JSON.stringify(r)).join('\n') + '\n');
    const forked = new Kernel(logPath, {
      completionRoot: dir, sourceRoot: SOURCE_ROOT, render: RENDERED, owner: OWNER,
    });
    refuses('two genesis approvals', 'lineage_second_genesis', () => forked.approvalsFor('L'));
    refuses('and no current revision to bind', 'lineage_second_genesis',
      () => forked.currentRevision('L'));
  });

  group('AC-9 · formation opened twice is formation opened by nobody', () => {
    const dir = mkdtempSync(join(tmpdir(), 'twoform-'));
    const logPath = join(dir, 'log.ndjson');
    const src = fresh();
    const w = walk(src);
    const lines = src.records().map(({ seq, ...r }) => r);
    const opened = lines.find((r) => r.kind === 'formation_opened');
    writeFileSync(logPath, [opened, ...lines].map((r) => JSON.stringify(r)).join('\n') + '\n');
    const doubled = new Kernel(logPath, {
      completionRoot: dir, sourceRoot: SOURCE_ROOT, render: RENDERED, owner: OWNER,
    });
    refuses('two openings', 'run_facts_incomplete', () => doubled.formationFor('L'));
    refuses('and nothing to measure formation from', 'run_facts_incomplete',
      () => doubled.recordRun({
        lineage: 'L', run: w.run, traceOutcome: 'caught_nothing', wentWrong: '',
      }));
  });

  group('AC-12 · a record whose fields a caller supplied is still checked', () => {
    // The append boundary validates the payload, not just the name. These fields
    // arrive from the caller and reach the record, so this is the shape check
    // doing the only work a shape check can do — refusing what a caller can ask.
    const k = fresh();
    const w = walk(k);
    k.status({ lineage: 'L', run: w.run });
    refuses('a run fact of the wrong type', 'format_open', () => k.recordRun({
      lineage: 'L', run: w.run, traceOutcome: 'caught_nothing', wentWrong: 123,
    }));
    refuses('a trace outcome outside the two', 'format_open', () => k.recordRun({
      lineage: 'L', run: w.run, traceOutcome: 'caught_maybe', wentWrong: '',
    }));
  });

  group('AC-9 · run facts need the run', () => {
    const k = fresh();
    k.openFormation({ lineage: 'L', actor: OWNER });
    refuses('formation opened a second time', 'run_facts_incomplete',
      () => k.openFormation({ lineage: 'L', actor: OWNER }));
    refuses('formation opened by someone else', 'authority_not_granted',
      () => k.openFormation({ lineage: 'L2', actor: 'P' }));
    refuses('facts for a run with no Assignment', 'assignment_not_issued',
      () => k.recordRun({
        lineage: 'L', run: 'run1', traceOutcome: 'caught_nothing', wentWrong: '',
      }));
  });

  group('AC-9 · the two judgements have somewhere to be recorded', () => {
    // The record kinds existed and nothing produced them. Reserving a judgement
    // for the Human Owner is not the same as having nowhere to put it: without
    // these, the run AC-9 asks for could not record its own answers.
    const k = fresh();
    const w = walk(k);
    k.status({ lineage: 'L', run: w.run });
    refuses('a judgement about a run with no facts', 'run_facts_incomplete',
      () => k.decideWorth({ lineage: 'L', run: w.run, actor: OWNER, choice: 'yes' }));

    // Boundaries are derived, not chosen: formation from the record that opened it
    // to the approval, the change from the run's attempt to the Gate finishing.
    // Both are records that exist for other reasons.
    const seqOf = (kind) => k.records().find((r) => r.kind === kind).seq;
    // Each half on its own: as one predicate, a case omitting both turned it red
    // while saying nothing about either.
    refuses('caught_something with no discrepancy', 'trace_outcome_unsupported',
      () => k.recordRun({
        lineage: 'L', run: w.run, traceOutcome: 'caught_something',
        disposition: 'the Contract now names the inputs', wentWrong: '',
      }));
    refuses('caught_something with nothing done about it', 'trace_outcome_unsupported',
      () => k.recordRun({
        lineage: 'L', run: w.run, traceOutcome: 'caught_something',
        discrepancy: 'the package named an input the run never read', wentWrong: '',
      }));
    // A run with no Gate verdict has no boundary to measure the change to.
    const unjudged = fresh();
    const u = walk(unjudged);
    refuses('a run the Gate has not reported on', 'run_facts_incomplete',
      () => unjudged.recordRun({
        lineage: 'L', run: u.run, traceOutcome: 'caught_nothing', wentWrong: '',
      }));

    // Formation opened after the Contract was approved: the records exist, and
    // the interval they name runs the wrong way.
    const late = fresh();
    const l = walk(late, { skipFormation: true });
    late.openFormation({ lineage: 'L', actor: OWNER });
    late.status({ lineage: 'L', run: l.run });
    refuses('formation opening after the approval', 'cost_incomparable',
      () => late.recordRun({
        lineage: 'L', run: l.run, traceOutcome: 'caught_nothing', wentWrong: '',
      }));

    // A retry after the Gate has already reported. The endpoint was the first
    // evaluation in the run, so the interval ended before the retry began and the
    // cost excluded everything it did.
    const retried = fresh();
    const rr = walk(retried);
    retried.status({ lineage: 'L', run: rr.run });
    const firstEval = retried.records().find((r) => r.kind === 'gate_completed');
    const again = retried.openAttempt({
      lineage: 'L', run: rr.run, producer: 'P', obligations: ['O'], submitter: 'P',
    });
    retried.status({ lineage: 'L', run: rr.run });
    const retryFacts = retried.recordRun({
      lineage: 'L', run: rr.run, traceOutcome: 'caught_nothing', wentWrong: '',
    });
    ok('the interval does not end at the first evaluation',
      retryFacts.change_to !== firstEval.seq);
    ok('it ends after the retry was opened', retryFacts.change_to > again.seq);

    // Two records that landed in the same millisecond, in the wrong order. The
    // clock comparison passes — the duration is zero, not negative — so this is
    // what the order comparison is for, and the two are not the same check.
    // Only formation: the change's evaluation is selected as one that *follows*
    // the last attempt, so their order is how it was found rather than something
    // to check afterwards.
    for (const [what, first, second] of [
      ['formation', 'formation_opened', 'contract_approved_genesis'],
    ]) {
      const dir = mkdtempSync(join(tmpdir(), 'tie-'));
      const logPath = join(dir, 'log.ndjson');
      const src = fresh();
      const r = walk(src);
      src.status({ lineage: 'L', run: r.run });
      const lines = src.records().map(({ seq, ...record }) => record);
      const a = lines.findIndex((x) => x.kind === first);
      const b = lines.findIndex((x) => x.kind === second);
      lines[a].at = 1_000;
      lines[b].at = 1_000;
      [lines[a], lines[b]] = [lines[b], lines[a]];
      writeFileSync(logPath, lines.map((x) => JSON.stringify(x)).join('\n') + '\n');
      const tied = new Kernel(logPath, {
        sourceRoot: SOURCE_ROOT, render: RENDERED, owner: OWNER,
      });
      refuses(`${what} out of order within one millisecond`, 'cost_incomparable',
        () => tied.recordRun({
          lineage: 'L', run: r.run, traceOutcome: 'caught_nothing', wentWrong: '',
        }));
    }

    // A clock that went backwards between two appends. The order of the records
    // is right and the durations they imply are not, which is the case the two
    // clock comparisons exist for — and the only way to reach it is a log whose
    // timestamps say so.
    for (const [what, kind] of [
      ['formation', 'formation_opened'],
      ['the change', 'attempt_opened'],
    ]) {
      const dir = mkdtempSync(join(tmpdir(), 'clock-'));
      const logPath = join(dir, 'log.ndjson');
      const src = fresh();
      const r = walk(src);
      src.status({ lineage: 'L', run: r.run });
      // The *earlier* endpoint pushed forward, so the interval runs backwards
      // while the records stay in order — which is the case a clock rollback
      // produces and the only one these two comparisons exist for.
      writeFileSync(logPath, src.records()
        .map(({ seq, ...record }) => JSON.stringify(
          record.kind === kind ? { ...record, at: 9_999_999_999_999 } : record,
        )).join('\n') + '\n');
      const rolled = new Kernel(logPath, {
        sourceRoot: SOURCE_ROOT, render: RENDERED, owner: OWNER,
      });
      refuses(`${what} running backwards on the clock`, 'cost_incomparable',
        () => rolled.recordRun({
          lineage: 'L', run: r.run, traceOutcome: 'caught_nothing', wentWrong: '',
        }));
    }

    // A lineage that never marked the start of formation has nothing to measure
    // it from. Nothing else in the log stands in: the earliest record is the
    // activation decision, written inside `approve`, which would measure one
    // append rather than the work of forming the Contract.
    const unmarked = fresh();
    const m = walk(unmarked, { skipFormation: true });
    unmarked.status({ lineage: 'L', run: m.run });
    refuses('a lineage that never opened formation', 'run_facts_incomplete',
      () => unmarked.recordRun({
        lineage: 'L', run: m.run, traceOutcome: 'caught_nothing', wentWrong: '',
      }));

    // A Gate evaluation that predates the attempt is not the one that closed the
    // change — the endpoint is chosen as an evaluation *after* the last attempt,
    // so an earlier one is not a backwards interval, it is not the endpoint.
    const early = fresh();
    const e = walk(early, { reduceBeforeAttempt: true });
    refuses('only an evaluation from before the attempt', 'run_facts_incomplete',
      () => early.recordRun({
        lineage: 'L', run: e.run, traceOutcome: 'caught_nothing', wentWrong: '',
      }));

    // One set of facts per run. Two meant the live judgement read the first and
    // replay read the last, so the decision and the reconstruction of it
    // disagreed about what was decided.
    const twice = fresh();
    const t = walk(twice);
    twice.status({ lineage: 'L', run: t.run });
    twice.recordRun({ lineage: 'L', run: t.run, traceOutcome: 'caught_nothing', wentWrong: '' });
    refuses('a second set of run facts', 'run_facts_incomplete',
      () => twice.recordRun({
        lineage: 'L', run: t.run, traceOutcome: 'caught_nothing', wentWrong: '',
      }));

    const facts = k.recordRun({
      lineage: 'L', run: w.run, traceOutcome: 'caught_nothing', wentWrong: '',
    });
    eq('formation is measured from the record of its opening',
      facts.formation_from, seqOf('formation_opened'));
    eq('to the approval', facts.formation_to, seqOf('contract_approved_genesis'));
    eq('and the change from the attempt', facts.change_from, seqOf('attempt_opened'));
    eq('to the completed Gate evaluation', facts.change_to, seqOf('gate_completed'));

    // The cost is elapsed time between those records, observed when each landed.
    const atOf = (kind) => k.records().find((r) => r.kind === kind).at;
    // The property, stated exactly: each cost *is* the difference between its two
    // endpoints' clocks. Nothing can add a per-record increment to a quantity
    // defined as a subtraction of two specific values.
    //
    // A probe that appended ten unrelated records and checked the figures had not
    // moved was weaker than it read: the records landed inside the *change*
    // interval while the assertions looked at formation, and unrelated appends
    // take real time anyway, so "did not move" was never quite the claim.
    eq('formation is the time between its endpoints',
      facts.formation_elapsed, atOf('contract_approved_genesis') - atOf('formation_opened'));
    eq('the change is the time between its endpoints',
      facts.change_elapsed, atOf('gate_completed') - atOf('attempt_opened'));

    // And unrelated records between the endpoints add nothing of their own: the
    // figure is still exactly the endpoint difference, whatever landed between.
    const noisy = fresh();
    const n = walk(noisy);
    for (let i = 0; i < 10; i += 1) noisy.observeInput({ lineage: 'ELSEWHERE', path: INPUT });
    noisy.status({ lineage: 'L', run: n.run });
    const withNoise = noisy.recordRun({
      lineage: 'L', run: n.run, traceOutcome: 'caught_nothing', wentWrong: '',
    });
    const noisyAt = (kind) => noisy.records().find((r) => r.kind === kind).at;
    ok('ten records landed inside the change interval',
      withNoise.change_to - withNoise.change_from > 10);
    eq('and the change is still the endpoint difference',
      withNoise.change_elapsed, noisyAt('gate_completed') - noisyAt('attempt_opened'));

    // And the supported `caught_something` shape, which only its refusal had been
    // exercising: the record carries the discrepancy and what was done about it.
    const caught = fresh();
    const c = walk(caught);
    caught.status({ lineage: 'L', run: c.run });
    const held = caught.recordRun({
      lineage: 'L', run: c.run, traceOutcome: 'caught_something',
      discrepancy: 'the package named an input the run never read',
      disposition: 'the Contract now names the inputs',
      wentWrong: '',
    });
    eq('the discrepancy is recorded', held.kind, 'run_record_caught');
    eq('with what was done about it', held.disposition, 'the Contract now names the inputs');
    refuses('by someone the Kernel does not serve', 'authority_not_granted',
      () => k.decideWorth({ lineage: 'L', run: w.run, actor: 'P', choice: 'yes' }));
    const worth = k.decideWorth({ lineage: 'L', run: w.run, actor: OWNER, choice: 'yes' });
    eq('the judgement is recorded', worth.choice, 'yes');
    eq('bound to the facts it answers', worth.answers, facts.seq);
    eq('externally produced', worth.origin, 'host');

    // The retreat condition is arithmetic over those two figures and the trace
    // outcome. Whichever way it comes out, a decision disagreeing with it is
    // refused — and refused *before* anything is written, since appending first
    // left a durable record of a decision the Kernel had rejected.
    const fired = k.retreatCondition('L', w.run).fired;
    const disagrees = fired ? 'no' : 'yes';
    refuses('a decision that disagrees with the facts', 'retreat_contradicts_facts',
      () => k.decideRetreat({ lineage: 'L', run: w.run, actor: OWNER, choice: disagrees }));
    ok('and nothing was written',
      !k.records().some((r) => r.operation === 'retreat_decision'));
    eq('one that agrees is recorded',
      k.decideRetreat({
        lineage: 'L', run: w.run, actor: OWNER, choice: fired ? 'yes' : 'no',
      }).choice, fired ? 'yes' : 'no');
  });

  group('AC-5 · every authority operation answers to the same owner', () => {
    // Downstream operations compare the actor with the owner alone. Restating the
    // Contract's field at each one was a second copy of a fact approval settles,
    // and a planted defect could not tell the two apart.
    const w = run();
    refuses('completion by someone else', 'authority_not_granted',
      () => complete(w, { actor: 'P' }));
    refuses('a sign-off by someone else', 'authority_not_granted',
      () => w.k.signOff({ lineage: 'L', run: w.run, actor: 'P' }));
  });

  group('AC-2 · two records under one name resolve to neither', () => {
    // The evidence references ids a producer chooses, and the resolver returned
    // the first match — so recording a second result under an id already used
    // silently decided which one the evidence pointed at. Ambiguity is refused,
    // not resolved by order.
    const k = fresh();
    const w = walk(k);
    k.runObservation({
      id: 'cr1', lineage: 'L', run: w.run, attempt: w.attempt.attempt,
      obligation: 'O', artifact: 'art1',
    });
    refuses('a second result under the same name', 'binding_unresolved',
      () => k.status({ lineage: 'L', run: w.run }));
  });

  group('AC-5 · an attempt opened for one obligation cannot answer another', () => {
    // The whole path, because this reached an Acceptance: the Contract and the
    // Assignment grant two obligations, the attempt opens for one, and evidence
    // for both used to pass. The attempt's narrowing is authority and was being
    // dropped by everything downstream of it.
    const second = 'work/artifact2.txt';
    writeFileSync(join(SOURCE_ROOT, second), 'another artifact\n');
    const k = fresh();
    const w = walk(k, {
      obligations: ['O'],
      contract: {
        obligations: ['O', 'O2'],
        observations: [
          { obligation: 'O', observation: COMMAND, artifact: ARTIFACT, material_inputs: [INPUT] },
          { obligation: 'O2', observation: COMMAND, artifact: second, material_inputs: [INPUT] },
        ],
      },
      assignment: {
        grants: { attempt_producer: 'P', mutation_producer: 'P', obligations: ['O', 'O2'] },
      },
    });
    k.runObservation({
      id: 'cr2', lineage: 'L', run: w.run, attempt: w.attempt.attempt,
      obligation: 'O2', artifact: 'art2',
    });
    const pkg2 = asObject({ ...w.pkg.value, id: 'pkg2', artifact: 'art2', command_result: 'cr2' });
    k.recordPackage({
      lineage: 'L', run: w.run, bytes: pkg2.bytes, identity: pkg2.identity, submitter: 'P',
    });
    k.observeInput({ lineage: 'L', path: INPUT });
    refuses('a submission outside what the attempt opened for', 'authority_not_granted',
      () => k.submitObservation({
        lineage: 'L', run: w.run, obligation: 'O2', observation: COMMAND,
        attempt: w.attempt.attempt, producer: 'P', artifact: 'art2', pkg: 'pkg2',
        commandResult: 'cr2', submitter: 'P',
      }));
    const status = k.status({ lineage: 'L', run: w.run }).byObligation;
    eq('so it stays pending', status.O2.status, 'pending');
    eq('while the one the attempt opened for passes', status.O.status, 'passed');
    refuses('and completion does not land', 'not_all_passed',
      () => k.complete({ lineage: 'L', run: w.run, actor: OWNER }));
  });

  group('AC-2 · a decoy cannot stand in for the input', () => {
    // A material input is identified by the path the Contract states, so there is
    // no label for a producer to reuse. `observeInput` took an id and a path, and
    // the packaged file could change while something else was observed unchanged
    // under its name.
    const k = fresh();
    const w = walk(k);
    const decoy = 'work/decoy.txt';
    writeFileSync(join(SOURCE_ROOT, decoy), 'in1\n');
    writeFileSync(join(SOURCE_ROOT, INPUT), 'the input moved\n');
    // Observing the decoy records the decoy, and says nothing about the input:
    // the id is the path, so there is no name to borrow.
    k.observeInput({ lineage: 'L', path: decoy });
    const recorded = k.records().filter((r) => r.kind === 'input_observed');
    eq('the decoy is recorded as itself', recorded[recorded.length - 1].id, decoy);

    // The Gate still reads the last observation *of the input*, which is the one
    // the run made — the world moving is not something the log knows until the
    // Harness looks again. When it does, the evidence is stale.
    eq('and has not been made to answer for the input',
      k.status({ lineage: 'L', run: w.run }).byObligation.O.status, 'passed');
    k.observeInput({ lineage: 'L', path: INPUT });
    eq('looking at the input itself shows it moved',
      k.status({ lineage: 'L', run: w.run }).byObligation.O.status, 'stale');
  });

  group('AC-1 · a Kernel given no families cannot review, and does not pretend to', () => {
    // There was a `recordReview` that took a digest and a family and stamped them
    // `origin: harness`, and completion checked only that such a record existed —
    // so the party being judged wrote its own judge into being and got an
    // Acceptance carrying a digest of nothing. It is gone: a review is obtained by
    // the Kernel running a family's command, and this Kernel was given no families.
    //
    // The refusal moved from completion to the Gate, and that is the fix rather
    // than a regression. A required review that was never obtained means the
    // assurance the Contract asked for could not be used, so the obligations read
    // `unavailable` — where they used to read `passed` while completion refused,
    // which had the Gate and the Kernel saying different things about one run.
    const cross = {
      contract: {
        independence: {
          required: 'cross_family_required', requested_family: ['openai'],
          assurance: 'workflow_attested',
        },
      },
    };
    const w = run(cross);
    ok('there is no way to hand in a review', w.k.recordReview === undefined);
    eq('the obligation is unavailable, not passed',
      w.k.status({ lineage: w.lineage, run: w.run }).byObligation.O.status, 'unavailable');
    refuses('so a Contract requiring one cannot complete', 'not_all_passed',
      () => complete(w));
    refuses('nor by carrying a digest of its own', 'not_all_passed',
      () => complete(w, { acceptedReview: sha('imagined') }));

    // And a Contract requiring none may not carry one either: the Acceptance
    // would say something the Contract does not.
    refuses('a review where none was required', 'review_required_absent',
      () => complete(run(), { acceptedReview: sha('unasked for') }));
  });


  group('AC-11 · completion has no second entry point', () => {
    // The write is the last step of `complete`, and its destination belongs to
    // the Kernel. A Kernel with no completion root cannot complete at all, which
    // is the honest answer to "where would it write".
    const dir = mkdtempSync(join(tmpdir(), 'ac11-'));
    const k = new Kernel(join(dir, 'log.ndjson'), { sourceRoot: SOURCE_ROOT, render: RENDERED, owner: OWNER });
    const w = walk(k);
    refuses('no root, no completion', 'writer_not_sole',
      () => k.complete({ lineage: w.lineage, run: w.run, actor: 'Human Owner' }));
  });

  group('AC-6 · the Contract must trace to its sources', () => {
    // On the approval path, not beside it. These checks existed and nothing
    // called them, so a Contract whose statements cited nothing was approved.
    const k = fresh();
    const approve = (over) => {
      const c = asObject(contractDoc(over));
      return k.approve({
        lineage: 'L', revision: 'r1', bytes: c.bytes, identity: c.identity,
        actor: 'Human Owner', rendered: RENDERED(c.bytes),
      });
    };
    refuses('a statement citing nothing', 'statement_uncited',
      () => approve({ scope: ['S1 the completion path'] }));
    refuses('a statement citing an unknown source', 'citation_unknown',
      () => approve({ scope: ['S1 the completion path (D-99)'] }));
    // What the letter list used to get wrong, in both directions. A source the
    // provenance carries is citable whatever letter it uses — the extractor
    // recognised four and the known set was built from the provenance, so the two
    // disagreed and a statement resting on a real source read as resting on none.
    // And prose is prose: a statement mentioning a backlog item or a criterion is
    // not citing it, so those must not be read as citations at all.
    const withTranscribed = (over) => contractDoc({
      provenance: {
        ...contractDoc().provenance,
        transcribed: [
          ...contractDoc().provenance.transcribed,
          { id: 'T-01', statement: 'a source under another letter', disposition: 'carried' },
        ],
      },
      ...over,
    });
    const doc = asObject(withTranscribed({ scope: ['S1 the completion path (T-01)'] }));
    eq('a source under any letter the provenance uses is citable',
      k.approve({
        lineage: 'L', revision: 'r1', bytes: doc.bytes, identity: doc.identity,
        actor: 'Human Owner', rendered: RENDERED(doc.bytes),
      }).kind, 'contract_approved_genesis');
    refuses('and prose naming a criterion or a backlog item is not a citation',
      'statement_uncited',
      () => approve({ scope: ['S1 the completion path, which AC-9 and BL-214 both touch'] }));
    // D-02 is transcribed as `carried`, and nothing in this Contract cites it —
    // so the Contract claims to have taken on an obligation that landed nowhere.
    refuses('a carried obligation nothing cites', 'disposition_lands_nowhere',
      () => approve({
        scope: ['S1 the completion path (D-01)'],
        non_goals: ['N1 no release concept (D-01)'],
        required_evidence: ['E1 a command result (D-01)'],
      }));
  });

  group('AC-6 · a citation must point at the content it claims', () => {
    // Checking the ids without checking the digests establishes that a citation
    // is well-formed, not that it points at what it says. The Contract's
    // provenance records a digest per cited file; approval compares it.
    const k = fresh();
    const c = asObject(contractDoc({
      provenance: {
        verifiable: [{
          id: 'D-01', source: 'docs/v1/design.md', sha256: sha('something else'),
          quote: 'Evidence is externally produced.',
        }],
        transcribed: [
          { id: 'D-02', statement: 'evidence is externally produced', disposition: 'carried' },
        ],
        proposals: [],
        unknowns: [],
      },
    }));
    refuses('a cited file that is not what was cited', 'citation_unknown',
      () => k.approve({
        lineage: 'L', revision: 'r1', bytes: c.bytes, identity: c.identity,
        actor: 'Human Owner', rendered: RENDERED(c.bytes),
      }));

    // And the passage, not only the file. A matching digest says the source has
    // not changed since it was cited; it says nothing about whether the source
    // contains what the citing statement rests on — AC-6's falsifier names that
    // case, and nothing checked it.
    const misquoted = asObject(contractDoc({
      provenance: {
        verifiable: [{
          id: 'D-01', source: 'docs/v1/design.md', sha256: DESIGN_SHA,
          quote: 'a sentence that is not in the file',
        }],
        transcribed: [
          { id: 'D-02', statement: 'evidence is externally produced', disposition: 'carried' },
        ],
        proposals: [],
        unknowns: [],
      },
    }));
    refuses('a passage the cited source does not contain', 'citation_unknown',
      () => k.approve({
        lineage: 'L', revision: 'r1', bytes: misquoted.bytes, identity: misquoted.identity,
        actor: 'Human Owner', rendered: RENDERED(misquoted.bytes),
      }));

    // And a Kernel that cannot resolve them cannot approve at all, rather than
    // skipping the check because nobody configured a root.
    const blind = new Kernel(join(mkdtempSync(join(tmpdir(), 'blind-')), 'log.ndjson'),
      { render: RENDERED, owner: OWNER });
    const good = asObject(contractDoc());
    refuses('a Kernel with nowhere to resolve them', 'citation_unknown',
      () => blind.approve({
        lineage: 'L', revision: 'r1', bytes: good.bytes, identity: good.identity,
        actor: 'Human Owner', rendered: RENDERED(good.bytes),
      }));
  });

  group('AC-2 · a package names the lineage it is filed under', () => {
    const k = fresh();
    const w = walk(k);
    const foreign = asObject({ ...w.pkg.value, id: 'pkg9', lineage: 'ELSEWHERE' });
    refuses('bytes naming another lineage', 'binding_cross_execution',
      () => k.recordPackage({
        lineage: 'L', run: w.run, bytes: foreign.bytes, identity: foreign.identity,
        submitter: 'P',
      }));
  });

  group('AC-6 · the presented view is derived from the approved bytes', () => {
    const k = fresh();
    const c = asObject(contractDoc());
    refuses('a rendering of something else', 'identity_mismatch',
      () => k.approve({
        lineage: 'L', revision: 'r1', bytes: c.bytes, identity: c.identity,
        actor: 'Human Owner', rendered: 'VIEW OF SOMETHING ELSE',
      }));
    refuses('nothing shown at all', 'human_input_absent',
      () => k.approve({
        lineage: 'L', revision: 'r1', bytes: c.bytes, identity: c.identity,
        actor: 'Human Owner',
      }));
    // The renderer belongs to the Kernel. A caller that supplies both the
    // rendering and the function judging it approves anything at all —
    // `render: () => rendered` was enough — so there is no longer a parameter
    // for it, and a Kernel without one cannot approve.
    const noRenderer = new Kernel(join(mkdtempSync(join(tmpdir(), 'nr-')), 'log.ndjson'), {
      sourceRoot: SOURCE_ROOT,
    });
    refuses('a Kernel with no renderer', 'human_input_absent',
      () => noRenderer.approve({
        lineage: 'L', revision: 'r1', bytes: c.bytes, identity: c.identity,
        actor: 'Human Owner', rendered: 'ANYTHING AT ALL',
      }));
    const approved = k.approve({
      lineage: 'L', revision: 'r1', bytes: c.bytes, identity: c.identity,
      actor: 'Human Owner', rendered: RENDERED(c.bytes),
    });
    eq('a derived view is recorded', approved.identity.byte_sha256, c.identity.byte_sha256);
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
}
