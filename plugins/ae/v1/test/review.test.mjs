// Phase 2 — a review is obtained, not handed in.
//
// The point of every case here is one sentence from §4: a submission cannot
// author its own provenance. A review the reviewed party could write, or could
// choose the reviewer for, is the same defect as an Assignment its beneficiary
// issues — which Phase 1 already refuses.

import { mkdtempSync, writeFileSync, chmodSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Kernel } from '../lib/kernel.mjs';
import { auditOriginSurface } from '../lib/source-audit.mjs';
import { readFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { group, ok, eq, refuses } from './harness.mjs';
import {
  walk, asObject, packageDoc, RENDERED, OWNER, SOURCE_ROOT, INPUT, COMMAND,
} from './fixtures.mjs';
import { digestBytes } from '../lib/canonical-json.mjs';

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
    refuses('a family the registry does not hold', 'review_required_absent',
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
    eq('and none takes an origin either, unchanged',
      auditOriginSurface({ readFileSync, dir: libDir }).join(','), '');
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
      const { k, w } = setup();
      refuses('no review recorded at all', 'review_required_absent', () => complete(k, w));
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
}
