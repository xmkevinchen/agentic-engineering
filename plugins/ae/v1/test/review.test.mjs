// Phase 2 — a review is obtained, not handed in.
//
// The point of every case here is one sentence from §4: a submission cannot
// author its own provenance. A review the reviewed party could write, or could
// choose the reviewer for, is the same defect as an Assignment its beneficiary
// issues — which Phase 1 already refuses.

import { mkdtempSync, writeFileSync, chmodSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Kernel } from '../lib/kernel.mjs';
import { auditOriginSurface } from '../lib/source-audit.mjs';
import { readFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { group, ok, eq, refuses } from './harness.mjs';
import {
  walk, asObject, packageDoc, contractDoc, assignmentDoc,
  RENDERED, OWNER, SOURCE_ROOT, INPUT, COMMAND,
} from './fixtures.mjs';
import { digestBytes } from '../lib/canonical-json.mjs';
import { validate } from '../lib/schema.mjs';
import { ACCEPTANCE } from '../schema/objects.mjs';

const libDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'lib');

// Two commands that each say which family answered. Nothing about the family is
// read off the command by the Kernel — it stamps the registry key it resolved —
// so a test that named a family and got the other one back would be reading a
// caller's word.
function world() {
  const dir = mkdtempSync(join(tmpdir(), 'rev-'));
  const say = (name) => {
    const p = join(dir, `${name}.sh`);
    writeFileSync(p, `#!/bin/sh\necho "reviewed by ${name}"\n`);
    chmodSync(p, 0o755);
    return `sh ${p}`;
  };
  return { dir, families: { openai: say('openai'), google: say('google') } };
}

const kernelWith = (families) => {
  const dir = mkdtempSync(join(tmpdir(), 'revk-'));
  return new Kernel(join(dir, 'log.ndjson'), {
    completionRoot: dir, sourceRoot: SOURCE_ROOT, render: RENDERED, owner: OWNER, families,
  });
};

export function reviewTests() {
  group('AC-5 · the family is the one the Kernel resolved', () => {
    const { families } = world();
    const k = kernelWith(families);
    const w = walk(k);
    const r = k.obtainReview({
      id: 'rev1', lineage: w.lineage, run: w.run, family: 'openai', reviewer: 'Reviewer',
    });
    eq('the record carries the family that was asked for', r.family, 'openai');
    // And it is the command that family maps to, not a command the caller chose.
    ok('and the command it ran is the registry\'s', r.command === families.openai);
    ok('and the reviewer\'s own words are recorded', /reviewed by openai/.test(r.raw));
    eq('and the Harness produced it, not a submission', r.origin, 'harness');
    // The other direction: a different key runs a different command.
    const other = k.obtainReview({
      id: 'rev2', lineage: w.lineage, run: w.run, family: 'google', reviewer: 'Reviewer',
    });
    ok('a different family reaches a different reviewer', /reviewed by google/.test(other.raw));
    eq('and is stamped as that family', other.family, 'google');
  });

  group('AC-5 · no caller supplies a command or an unresolved family', () => {
    const { families } = world();
    const k = kernelWith(families);
    const w = walk(k);
    refuses('a family the registry does not hold', 'review_family_unknown',
      () => k.obtainReview({
        id: 'rev3', lineage: w.lineage, run: w.run, family: 'invented', reviewer: 'R',
      }));
    // On a run that exists, so the refusal is about the registry and not about
    // the run — the contract is resolved first, as every other operation does.
    const bare = kernelWith(null);
    const bw = walk(bare);
    refuses('and a Kernel given no families can obtain nothing', 'review_required_absent',
      () => bare.obtainReview({
        id: 'rev4', lineage: bw.lineage, run: bw.run, family: 'openai', reviewer: 'R',
      }));

    // The surface itself: no public operation takes a command. Checked against the
    // source rather than against a call, because the claim is about what can be
    // asked for at all — the same instrument that keeps `origin` unpassable.
    const text = readFileSync(join(libDir, 'kernel.mjs'), 'utf8');
    const takesCommand = [...text.matchAll(/^ {2}([A-Za-z][\w]*)\(\{([^}]*)\}/gm)]
      .filter((m) => /\bcommand\b/.test(m[2])).map((m) => m[1]);
    eq('no public operation takes a command', takesCommand.join(','), '');
    // AC5's discriminating case, after the criterion was corrected: naming one
    // family must not get the other family's reviewer. An implementation that
    // copied the caller's family through while running some other command would
    // pass every other assertion here and fail this one.
    const k2 = kernelWith(families);
    const w2 = walk(k2);
    const got = k2.obtainReview({
      id: 'x', lineage: w2.lineage, run: w2.run, family: 'google', reviewer: 'R',
    });
    ok('naming google reaches google, not whoever is first in the registry',
      /reviewed by google/.test(got.raw) && !/reviewed by openai/.test(got.raw));
    eq('and none takes an origin either, unchanged',
      auditOriginSurface({ readFileSync, dir: libDir }).join(','), '');
  });

  group('AC-5 · a call that obtained nothing is not a review', () => {
    // Three distinct ways to obtain nothing, and each has its own code. They shared
    // `review_required_absent` at first, and the sweep found all three deletable:
    // one code across four sites meant a test could not tell which site refused.
    const dir = mkdtempSync(join(tmpdir(), 'bad-'));
    const script = (name, body) => {
      const p = join(dir, `${name}.sh`);
      writeFileSync(p, `#!/bin/sh\n${body}\n`);
      chmodSync(p, 0o755);
      return `sh ${p}`;
    };
    const k = kernelWith({
      failing: script('failing', 'exit 7'),
      silent: script('silent', 'exit 0'),
    });
    const w = walk(k);

    // A failed call obtained nothing. An earlier version recorded it as a review
    // with substituted text — so a command that exited non-zero and said nothing
    // became a review with words in it, and completion accepted it.
    refuses('a reviewer whose command failed', 'reviewer_unreachable',
      () => k.obtainReview({
        id: 'b1', lineage: w.lineage, run: w.run, family: 'failing', reviewer: 'R',
      }));
    // Nor is silence. A record of nothing still satisfies a check that only asks
    // whether a review exists.
    refuses('a reviewer that answered nothing', 'reviewer_silent',
      () => k.obtainReview({
        id: 'b2', lineage: w.lineage, run: w.run, family: 'silent', reviewer: 'R',
      }));
    eq('and neither left a record behind', k.reviewsFor(w.lineage, w.run).length, 0);
  });

  group('AC-5 · a review is bound to the run it reviewed', () => {
    const { families } = world();
    const k = kernelWith(families);
    const w = walk(k);
    const r = k.obtainReview({
      id: 'rev5', lineage: w.lineage, run: w.run, family: 'openai', reviewer: 'Reviewer',
    });
    // Resolved from the run, never taken as an argument: a review that named its
    // own subject would review whatever it said it did.
    const deliverable = k.deliverableFor({
      lineage: w.lineage, run: w.run, contract: k.contractForRun(w.lineage, w.run).contract,
    });
    eq('the deliverable is the run\'s', r.deliverable, deliverable.identity);
    refuses('and a review needs a run that has an Assignment', 'assignment_not_issued',
      () => k.obtainReview({
        id: 'rev6', lineage: w.lineage, run: 'never-issued', family: 'openai', reviewer: 'R',
      }));
    eq('the reader returns what was recorded', k.reviewsFor(w.lineage, w.run).length, 1);
  });

  // A Contract that asks for a review, so completion has something to enforce.
  const REQUIRES = {
    independence: {
      required: 'cross_family_required',
      assurance: 'workflow_attested',
      requested_family: ['openai'],
    },
  };

  group('AC-1, AC-2, AC-3, AC-8 · completion is where a review is judged', () => {
    // Each case asserts its OWN code, and every one of them differs from
    // `review_required_absent`. Before this step, completion refused every
    // required-review run with that single code — so a test asserting only "it
    // refused" would have passed against a Kernel that could not review at all.
    const { families } = world();
    const setup = () => {
      const k = kernelWith(families);
      const w = walk(k, { contract: REQUIRES });
      return { k, w };
    };
    const complete = (k, w) => k.complete({ lineage: w.lineage, run: w.run, actor: OWNER });

    {
      // Caught at the Gate now, not at completion: a required review that was
      // never obtained means the assurance the Contract asked for could not be
      // used, so the obligation is `unavailable` and the run does not pass. The
      // refusals below are about a review that *exists* and is wrong.
      const { k, w } = setup();
      eq('no review at all leaves the obligation unavailable',
        k.status({ lineage: w.lineage, run: w.run }).byObligation.O.status, 'unavailable');
      refuses('and the run cannot complete', 'not_all_passed', () => complete(k, w));
    }
    {
      // The reviewed party as its own reviewer. The same defect as an Assignment
      // its beneficiary issues, which Phase 1 already refuses.
      const { k, w } = setup();
      k.obtainReview({ id: 'r', lineage: w.lineage, run: w.run, family: 'openai', reviewer: w.producer });
      refuses('the producer reviewing itself', 'review_self_authored', () => complete(k, w));
    }
    {
      // From a family the Contract did not ask for.
      const { k, w } = setup();
      k.obtainReview({ id: 'r', lineage: w.lineage, run: w.run, family: 'google', reviewer: 'Reviewer' });
      refuses('a family the Contract did not request', 'review_wrong_family', () => complete(k, w));
    }
    {
      // Two reviews, and nothing says which one answers. A name answering to two
      // records answers to neither — the rule Phase 1 applies to every other
      // identity, applied here.
      const { k, w } = setup();
      k.obtainReview({ id: 'r1', lineage: w.lineage, run: w.run, family: 'openai', reviewer: 'Reviewer' });
      k.obtainReview({ id: 'r2', lineage: w.lineage, run: w.run, family: 'openai', reviewer: 'Reviewer' });
      refuses('two reviews for one run', 'review_not_unique', () => complete(k, w));
    }
  });

  group('AC-3 · a review is judged against the deliverable at completion', () => {
    // Checked when completion runs, not when the review is recorded. A review
    // valid at recording can be bound to a superseded deliverable by a later
    // attempt, and a check that fired only at ingestion would never see it.
    const { families } = world();
    const k = kernelWith(families);
    const w = walk(k, { contract: REQUIRES });
    k.obtainReview({ id: 'r', lineage: w.lineage, run: w.run, family: 'openai', reviewer: 'Reviewer' });
    // A second attempt produces a different deliverable; the review still names
    // the first one.
    const before = k.reviewsFor(w.lineage, w.run)[0].deliverable;
    writeFileSync(join(SOURCE_ROOT, 'work', 'artifact.txt'), 'the artifact, changed\n');
    const att = k.openAttempt({
      lineage: w.lineage, run: w.run, producer: w.producer, obligations: ['O'], submitter: w.producer,
    });
    k.runObservation({
      id: 'cr2', lineage: w.lineage, run: w.run, attempt: att.attempt, obligation: 'O', artifact: 'art2',
    });
    const now = k.records().find((r) => r.kind === 'artifact_recorded' && r.id === 'art2');
    ok('the run now produces a different artifact', now.identity !== before);
    // Carry the second attempt through to a passing Gate, so the refusal below is
    // about the review and not about the evidence being incomplete.
    const pkg = asObject(packageDoc({
      id: 'pkg2', attempt: att.attempt, artifact: 'art2', command_result: 'cr2',
      material_inputs: [{ path: INPUT, identity: digestBytes(readFileSync(join(SOURCE_ROOT, INPUT))) }],
    }));
    k.recordPackage({
      lineage: w.lineage, run: w.run, bytes: pkg.bytes, identity: pkg.identity, submitter: w.producer,
    });
    k.observeInput({ lineage: w.lineage, path: INPUT });
    k.submitObservation({
      lineage: w.lineage, run: w.run, obligation: 'O', observation: COMMAND,
      attempt: att.attempt, producer: w.producer, artifact: 'art2',
      pkg: pkg.value.id, commandResult: 'cr2', submitter: w.producer,
    });
    eq('the second attempt passes the Gate',
      k.status({ lineage: w.lineage, run: w.run }).byObligation.O.status, 'passed');
    // And completion refuses, because the review examined the artifact this run
    // no longer produces. This is the case a check at ingestion cannot see: the
    // review was correct when it was recorded.
    refuses('a review of a superseded deliverable', 'review_wrong_deliverable',
      () => k.complete({ lineage: w.lineage, run: w.run, actor: OWNER }));
  });

  group('AC-6 · a review that could not be obtained is unavailable, never passed', () => {
    // No new mechanism. AC-7's unavailable arm already carries "the capability
    // could not be used", and a review the Kernel could not obtain is exactly
    // that. Verified before building anything: the requirement routes *into* the
    // existing arm rather than around it, so nothing here needed adding.
    //
    // What this pins is that it stays true. A later change that let a required
    // review be missing while the obligation still read `passed` would turn this
    // red, which is the only thing an already-satisfied criterion needs.
    // Written out rather than driven through `walk`, which always submits an
    // observation. A fixture flag for "skip the observation" would be machinery
    // existing only so a test could set it.
    const k = kernelWith(null);
    const c = asObject(contractDoc(REQUIRES));
    k.openFormation({ lineage: 'L', actor: OWNER });
    k.approve({
      lineage: 'L', revision: 'r1', bytes: c.bytes, identity: c.identity,
      actor: OWNER, rendered: RENDERED(c.bytes),
    });
    const a = asObject(assignmentDoc());
    k.issueAssignment({
      lineage: 'L', run: 'run1', bytes: a.bytes, identity: a.identity, actor: OWNER,
    });
    const at = k.openAttempt({
      lineage: 'L', run: 'run1', producer: 'P', obligations: ['O'], submitter: 'P',
    });
    k.recordDispatch({ lineage: 'L', run: 'run1', attempt: at.attempt, obligation: 'O' });
    k.recordUnavailable({ lineage: 'L', run: 'run1', obligation: 'O', attempt: at.attempt });
    const w = { lineage: 'L', run: 'run1' };
    const st = k.status({ lineage: w.lineage, run: w.run });
    eq('the obligation is unavailable', st.byObligation.O.status, 'unavailable');
    ok('and not passed', st.byObligation.O.status !== 'passed');
    ok('so the run does not pass', st.allPassed === false);
    refuses('and completion refuses on the Gate, before any review question',
      'not_all_passed', () => k.complete({ lineage: w.lineage, run: w.run, actor: OWNER }));
  });

  // The whole path, and it belongs to no step above. Per-step closure is necessary
  // and not sufficient: three of the five structural causes found in Phase 1 were
  // composition defects that every per-step check passed. Review selection is the
  // new place where a name can answer to two records, so replaying only the
  // ordinary Gate verdicts would miss exactly this class.
  group('AC-7 · the Acceptance names the review it rested on', () => {
    // Its own group, not an assertion inside AC-4's. A criterion covered under
    // another one's name is covered until that other one is renamed, and then it
    // is orphaned while the suite stays green — the aliasing the coverage check
    // exists to refuse.
    //
    // Read from the written file, because that is the artifact a later reader
    // has. An in-memory object proves the Kernel built one, not that one landed.
    // Its own run. Reading one another group built would couple the two through
    // execution order, and a group that only passes when another ran first is a
    // group that passes for a reason it does not state.
    const { families } = world();
    const k = kernelWith(families);
    const w = walk(k, { contract: REQUIRES });
    k.obtainReview({
      id: 'r', lineage: w.lineage, run: w.run, family: 'openai', reviewer: 'Reviewer',
    });
    const done = k.complete({ lineage: w.lineage, run: w.run, actor: OWNER });
    const onDisk = JSON.parse(readFileSync(done.written.path, 'utf8'));
    eq('the Acceptance records that a review was required', onDisk.review.required, true);
    const review = k.reviewsFor(w.lineage, w.run)[0];
    eq('and names the review that answered', onDisk.review.accepted_review,
      digestBytes(Buffer.from(JSON.stringify(review), 'utf8')));
    eq('and it is still the closed shape', validate(ACCEPTANCE, onDisk).join(','), '');
  });

  group('AC-13 · a run that rested on a review replays to the same verdict', () => {
    const { families } = world();
    const dir = mkdtempSync(join(tmpdir(), 'wp-'));
    const logPath = join(dir, 'log.ndjson');
    const k = new Kernel(logPath, {
      completionRoot: dir, sourceRoot: SOURCE_ROOT, render: RENDERED, owner: OWNER, families,
    });
    const w = walk(k, { contract: REQUIRES });
    k.obtainReview({
      id: 'rev', lineage: w.lineage, run: w.run, family: 'openai', reviewer: 'Reviewer',
      findings: [{ id: 'f1', statement: 'the boundary is wider than the change' }],
    });
    k.disposeFinding({
      lineage: w.lineage, run: w.run, review: 'rev', finding: 'f1',
      disposition: 'accepted — boundary narrowed', actor: w.producer,
    });
    const { acceptance } = k.complete({ lineage: w.lineage, run: w.run, actor: OWNER });

    const replay = fileURLToPath(new URL('./replay.mjs', import.meta.url));
    const out = JSON.parse(execFileSync(
      process.execPath, [replay, logPath, w.lineage, w.run], { encoding: 'utf8' },
    ));

    eq('the Gate verdict comes back', out.gateVerdicts.O, 'passed');
    eq('one review comes back, not "a review happened"', out.reviews.length, 1);
    eq('and it is the one that answered', out.reviews[0].id, 'rev');
    eq('with the family the Kernel stamped', out.reviews[0].family, 'openai');
    eq('and the reviewer that is not the producer', out.reviews[0].reviewer, 'Reviewer');
    eq('the finding it raised comes back', out.reviews[0].findings.join(','), 'f1');
    eq('and so does the answer to it', out.dispositions.map((d) => d.finding).join(','), 'f1');
    // The decisive half: what the Acceptance recorded is reachable from the
    // records alone, in a process that never saw the run.
    eq('and the Acceptance names that review', acceptance.review.accepted_review,
      digestBytes(Buffer.from(JSON.stringify(
        k.reviewsFor(w.lineage, w.run)[0],
      ), 'utf8')));
    eq('recomputing the verdict from the records agrees', out.recomputed.O, 'passed');
  });

  group('AC-4 · a finding must be answered before completion', () => {
    // A review that raises findings and a completion that ignores them makes the
    // findings decoration. What is required is an answer, not a particular answer:
    // the disposition is the producer's, and recording it is what stops a finding
    // from being passed over in silence.
    const { families } = world();
    const withFinding = () => {
      const k = kernelWith(families);
      const w = walk(k, { contract: REQUIRES });
      k.obtainReview({
        id: 'r', lineage: w.lineage, run: w.run, family: 'openai', reviewer: 'Reviewer',
        findings: [{ id: 'f1', statement: 'the input is not re-observed after packaging' }],
      });
      return { k, w };
    };

    {
      const { k, w } = withFinding();
      refuses('a finding nobody answered', 'finding_undisposed',
        () => k.complete({ lineage: w.lineage, run: w.run, actor: OWNER }));
    }
    {
      const { k, w } = withFinding();
      k.disposeFinding({
        lineage: w.lineage, run: w.run, review: 'r', finding: 'f1',
        disposition: 'accepted — re-observed after packaging', actor: w.producer,
      });
      eq('and answering it lets completion proceed',
        k.complete({ lineage: w.lineage, run: w.run, actor: OWNER }).written.outcome, 'created');
    }
    {
      // A disposition naming a finding the review never raised answers nothing.
      const { k, w } = withFinding();
      refuses('a disposition for a finding that was never raised', 'binding_unresolved',
        () => k.disposeFinding({
          lineage: w.lineage, run: w.run, review: 'r', finding: 'invented',
          disposition: 'accepted', actor: w.producer,
        }));
      // And one naming a review that does not exist. Without this the disposition
      // would be filed against nothing, and the count of answered findings would
      // still go up.
      refuses('and a disposition naming no recorded review', 'binding_unresolved',
        () => k.disposeFinding({
          lineage: w.lineage, run: w.run, review: 'never-obtained', finding: 'f1',
          disposition: 'accepted', actor: w.producer,
        }));
    }
  });
}
