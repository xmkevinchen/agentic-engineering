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
import { asObject, assignmentDoc, contractDoc, walk, sha, RENDERED, COMMAND, FAILING, VACUOUS, UNCOUNTABLE, SOURCE_ROOT, DESIGN_SHA, OWNER } from './fixtures.mjs';

const CONTRACT = join(
  dirname(fileURLToPath(import.meta.url)),
  '..', '..', '..', '..', '.ae', 'features', 'active',
  'F-086-v1-minimal-kernel', 'contract.md',
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
    // The second Kernel opens an attempt and does *not* reduce. Reading the last
    // recorded verdict would still say `passed` — that was the defect: a stale
    // answer read twice is one answer. The write re-runs the reduction.
    k2.openAttempt({ lineage: 'L', run: w.run, producer: 'P', obligations: ['O'], submitter: 'P' });
    eq('the recorded verdict is now stale',
      k1.records().filter((r) => r.kind === 'gate_result').pop().status, 'passed');
    eq('and re-reducing says otherwise',
      k1.verdictsNow({ lineage: 'L', run: w.run }).get('O'), 'pending');
    refuses('so completion does not land', 'not_all_passed',
      () => k1.complete({ lineage: 'L', run: w.run, actor: 'Human Owner' }));
  });

  group('AC-4 · a superseded attempt does not decide the deliverable', () => {
    // A failed first attempt naming one artifact, then a passing retry naming
    // another. `deliverableFor` read every observation in the run, so completion
    // saw two artifacts and refused — an attempt the Gate had already superseded
    // still deciding what could be accepted.
    const k = fresh();
    const w = walk(k, { command: FAILING });
    const second = join(w.world, 'artifact2.txt');
    writeFileSync(second, 'the retry\n');
    const retry = k.openAttempt({
      lineage: 'L', run: w.run, producer: 'P', obligations: ['O'], submitter: 'P',
    });
    k.recordArtifact({ id: 'art2', lineage: 'L', run: w.run, artifactKind: 'file', path: second });
    k.runObservation({
      id: 'cr2', lineage: 'L', run: w.run, attempt: retry.attempt,
      command: FAILING, artifact: 'art2', inputsUsed: ['in1'],
    });
    const pkg2 = asObject({
      ...w.pkg.value, id: 'pkg2', attempt: retry.attempt, artifact: 'art2', command_result: 'cr2',
    });
    k.recordPackage({
      lineage: 'L', run: w.run, bytes: pkg2.bytes, identity: pkg2.identity, submitter: 'P',
    });
    k.observeInput({ lineage: 'L', id: 'in1', path: w.inputPath });
    k.submitObservation({
      lineage: 'L', run: w.run, obligation: 'O', observation: FAILING,
      attempt: retry.attempt, producer: 'P', artifact: 'art2', pkg: 'pkg2',
      commandResult: 'cr2', submitter: 'P',
    });
    eq('the retry decides', k.deliverableFor({
      lineage: 'L', run: w.run, contract: k.contractFor('L').contract,
    }).identity, digestBytes(readFileSync(second)));
  });

  group('AC-1 · the deliverable is the artifact the evidence exercised', () => {
    // Two obligations, each fully evidenced against its own artifact. Both pass,
    // so the run reaches the point where the Acceptance must name a deliverable —
    // and there is no single thing to name. Picking one is not resolving.
    const k = fresh();
    const w = walk(k, {
      obligations: ['O', 'O2'],
      contract: {
        obligations: ['O', 'O2'],
        observations: [
          { obligation: 'O', observation: COMMAND },
          { obligation: 'O2', observation: COMMAND },
        ],
      },
      assignment: {
        grants: { attempt_producer: 'P', mutation_producer: 'P', obligations: ['O', 'O2'] },
      },
    });
    // `walk` answered both obligations against `art1`. Replace the second with a
    // complete, admissible chain of its own naming a different artifact.
    const second = join(w.world, 'artifact2.txt');
    writeFileSync(second, 'another artifact\n');
    k.recordArtifact({
      id: 'art2', lineage: 'L', run: w.run, artifactKind: 'file', path: second,
    });
    k.runObservation({
      id: 'cr2', lineage: 'L', run: w.run, attempt: w.attempt.attempt, command: COMMAND,
      artifact: 'art2', inputsUsed: ['in1'],
    });
    const pkg2 = asObject({
      ...w.pkg.value, id: 'pkg2', artifact: 'art2', command_result: 'cr2',
    });
    k.recordPackage({
      lineage: 'L', run: w.run, bytes: pkg2.bytes, identity: pkg2.identity, submitter: 'P',
    });
    // Observed after this package, as staleness requires: an observation taken
    // before the evidence was packaged says the input was current at some earlier
    // moment, which is not what is being asked.
    k.observeInput({ lineage: 'L', id: 'in1', path: w.inputPath });
    k.submitObservation({
      lineage: 'L', run: w.run, obligation: 'O2', observation: COMMAND,
      attempt: w.attempt.attempt, producer: 'P', artifact: 'art2', pkg: 'pkg2',
      commandResult: 'cr2', submitter: 'P',
    });
    eq('both obligations pass', k.status({ lineage: 'L', run: w.run }).allPassed, true);
    refuses('but the run names two artifacts', 'binding_cross_execution',
      () => k.complete({ lineage: 'L', run: w.run, actor: 'Human Owner' }));
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

  group('AC-2 · an observation of a decoy is not an observation of the input', () => {
    // An id is a label the producer chose. Without the path, the packaged input
    // could change while something else under the same label was observed
    // unchanged, and the run stayed `passed`.
    const k = fresh();
    const w = walk(k);
    const decoy = join(w.world, 'decoy.txt');
    writeFileSync(decoy, 'in1\n');
    writeFileSync(w.inputPath, 'the input moved\n');
    k.observeInput({ lineage: 'L', id: 'in1', path: decoy });
    eq('the observation answers a different file',
      k.status({ lineage: 'L', run: w.run }).byObligation.O.code, 'material_input_incomplete');
  });

  group('AC-1 · V1 cannot obtain a review, and does not pretend to', () => {
    // There was a `recordReview` that took a digest and a family and stamped them
    // `origin: harness`, and completion checked only that such a record existed —
    // so the party being judged wrote its own judge into being and got an
    // Acceptance carrying a digest of nothing. V1 has no successful cross-family
    // path at all, so a Contract that requires one cannot complete, and there is
    // no method through which a review could be claimed.
    const cross = {
      contract: {
        independence: {
          required: 'cross_family_required', requested_family: ['openai'],
          assurance: 'workflow_attested',
        },
      },
    };
    const w = run(cross);
    ok('there is no way to record a review', w.k.recordReview === undefined);
    refuses('and a Contract requiring one cannot complete', 'review_required_absent',
      () => complete(w));
    refuses('nor by carrying a digest of its own', 'review_required_absent',
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
