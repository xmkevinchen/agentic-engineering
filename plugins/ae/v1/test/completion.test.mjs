// AC-1, AC-6 — completion through the channel, and the formation trace.
//
// Every case here walks the whole path: approve, issue, open, run, record,
// submit, reduce, complete. That is deliberate. An earlier version of this file
// called a standalone `emitAcceptance` with a bare observation and asserted
// `accepted`, which is exactly the bypass the review found — a positive test that
// codified the defect. There is no standalone entry point any more, so a test
// cannot take one by accident.

import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { Kernel } from '../lib/kernel.mjs';
import { checkCitations, statementsFrom } from '../lib/formation.mjs';
import { group, ok, eq, refuses } from './harness.mjs';
import { validate } from '../lib/schema.mjs';
import { RECORDS } from '../schema/records.mjs';
import { asObject, assignmentDoc, contractDoc, walk, sha, RENDERED, COMMAND, SOURCE_ROOT } from './fixtures.mjs';

const CONTRACT = join(
  dirname(fileURLToPath(import.meta.url)),
  '..', '..', '..', '..', '.ae', 'features', 'active',
  'F-086-v1-minimal-kernel', 'contract.md',
);

// A Kernel that can complete: the destination belongs to it, not to whoever
// calls the write.
function fresh() {
  const dir = mkdtempSync(join(tmpdir(), 'ac1-'));
  return new Kernel(join(dir, 'log.ndjson'), { completionRoot: dir, sourceRoot: SOURCE_ROOT });
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
    eq('the deliverable is the recorded artifact', acceptance.deliverable.identity, sha('artifact'));

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
      () => complete(run({ exit: 1 })));
    refuses('zero subjects does not complete', 'not_all_passed',
      () => complete(run({ subjects: 0 })));

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
      () => complete(run({ inputNow: sha('moved') })));
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
      lineage: 'L', run: 'run2', bytes: a2.bytes, identity: a2.identity, actor: 'Owner',
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
    const k1 = new Kernel(logPath, { completionRoot: dir, sourceRoot: SOURCE_ROOT });
    const k2 = new Kernel(logPath, { completionRoot: dir, sourceRoot: SOURCE_ROOT });

    const c = asObject(contractDoc());
    k1.approve({
      lineage: 'L', revision: 'r1', bytes: c.bytes, identity: c.identity,
      actor: 'Owner', rendered: RENDERED(c.bytes), render: RENDERED,
    });
    const a = asObject(assignmentDoc());
    k1.issueAssignment({
      lineage: 'L', run: 'run1', bytes: a.bytes, identity: a.identity, actor: 'Owner',
    });
    k2.issueAssignment({
      lineage: 'L', run: 'run2', bytes: a.bytes, identity: a.identity, actor: 'Owner',
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
    k.recordCommandResult({
      id: 'cr2', lineage: 'L', run: w.run, attempt: w.attempt.attempt, command: COMMAND,
      exit: 0, raw: 'GREEN', subjects: 12, inputsUsed: ['in1'],
    });
    k.recordArtifact({
      id: 'art2', lineage: 'L', run: w.run, artifactKind: 'commit', identity: sha('other'),
    });
    const pkg2 = asObject({
      ...w.pkg.value, id: 'pkg2', artifact: 'art2', command_result: 'cr2',
    });
    k.recordPackage({
      lineage: 'L', run: w.run, bytes: pkg2.bytes, identity: pkg2.identity, submitter: 'P',
    });
    k.submitObservation({
      lineage: 'L', run: w.run, obligation: 'O2', observation: COMMAND,
      attempt: w.attempt.attempt, producer: 'P', artifact: 'art2', pkg: 'pkg2',
      commandResult: 'cr2', submitter: 'P',
    });
    eq('both obligations pass', k.status({ lineage: 'L', run: w.run }).allPassed, true);
    refuses('but the run names two artifacts', 'binding_cross_execution',
      () => k.complete({ lineage: 'L', run: w.run, actor: 'Human Owner' }));
  });

  group('AC-1 · the Contract names who signs', () => {
    // `actor` was whatever the caller wrote, so a run could be signed off by a
    // party the Contract never nominated.
    const w = run();
    refuses('someone the Contract did not nominate', 'authority_not_granted',
      () => complete(w, { actor: 'P' }));
  });

  group('AC-1 · review is stated, never left empty', () => {
    const cross = {
      contract: {
        independence: {
          required: 'cross_family_required', requested_family: ['openai'],
          assurance: 'workflow_attested',
        },
      },
    };
    refuses('a required review that is absent', 'review_required_absent',
      () => complete(run(cross)));

    // A digest the caller chose is a claim about a review nobody else saw. It
    // used to be enough that it was truthy.
    refuses('a review nobody recorded', 'review_required_absent',
      () => complete(run(cross), { acceptedReview: sha('imagined') }));

    const w = run(cross);
    w.k.recordReview({
      lineage: w.lineage, run: w.run, identity: sha('the review'), family: 'openai',
    });
    const { acceptance } = complete(w, { acceptedReview: sha('the review') });
    eq('a recorded one is carried', acceptance.review.accepted_review, sha('the review'));

    // And the other direction: a Contract requiring none cannot carry one, or the
    // Acceptance would say something the Contract does not.
    refuses('a review where none was required', 'review_required_absent',
      () => complete(run(), { acceptedReview: sha('unasked for') }));
  });

  group('AC-11 · completion has no second entry point', () => {
    // The write is the last step of `complete`, and its destination belongs to
    // the Kernel. A Kernel with no completion root cannot complete at all, which
    // is the honest answer to "where would it write".
    const dir = mkdtempSync(join(tmpdir(), 'ac11-'));
    const k = new Kernel(join(dir, 'log.ndjson'), { sourceRoot: SOURCE_ROOT });
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
        actor: 'Owner', rendered: RENDERED(c.bytes), render: RENDERED,
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
        verifiable: [{ id: 'D-01', source: 'docs/v1/design.md', sha256: sha('something else') }],
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
        actor: 'Human Owner', rendered: RENDERED(c.bytes), render: RENDERED,
      }));

    // And a Kernel that cannot resolve them cannot approve at all, rather than
    // skipping the check because nobody configured a root.
    const blind = new Kernel(join(mkdtempSync(join(tmpdir(), 'blind-')), 'log.ndjson'));
    const good = asObject(contractDoc());
    refuses('a Kernel with nowhere to resolve them', 'citation_unknown',
      () => blind.approve({
        lineage: 'L', revision: 'r1', bytes: good.bytes, identity: good.identity,
        actor: 'Human Owner', rendered: RENDERED(good.bytes), render: RENDERED,
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
        actor: 'Human Owner', rendered: 'VIEW OF SOMETHING ELSE', render: RENDERED,
      }));
    refuses('nothing shown at all', 'human_input_absent',
      () => k.approve({
        lineage: 'L', revision: 'r1', bytes: c.bytes, identity: c.identity,
        actor: 'Human Owner', render: RENDERED,
      }));
    // The derivation must be checkable, so the renderer is required. When it ran
    // only if a caller passed one, omitting it accepted any non-empty string.
    refuses('no way to re-derive what was shown', 'human_input_absent',
      () => k.approve({
        lineage: 'L', revision: 'r1', bytes: c.bytes, identity: c.identity,
        actor: 'Human Owner', rendered: 'ANYTHING AT ALL',
      }));
    const approved = k.approve({
      lineage: 'L', revision: 'r1', bytes: c.bytes, identity: c.identity,
      actor: 'Human Owner', rendered: RENDERED(c.bytes), render: RENDERED,
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
