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
import { walk, RENDERED, OWNER, SOURCE_ROOT } from './fixtures.mjs';

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
}
