// AC-4, AC-5, AC-13 — what happens when two writers share a log.
//
// Every "read the log, then append" is two operations, and the gap between them
// only exists when something else is running. Three rounds of review found real
// defects in that gap: a sequence number two Ledgers both handed out, an attempt
// id minted from the position the log was *about* to reach, and a second
// Assignment both issuers thought they were the first to write. None of them was
// visible from a single process, which is why these spawn real ones.

import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { Kernel } from '../lib/kernel.mjs';
import { group, ok, eq, refuses } from './harness.mjs';
import { asObject, assignmentDoc, contractDoc, RENDERED, SOURCE_ROOT } from './fixtures.mjs';

const writer = fileURLToPath(new URL('./concurrent-writer.mjs', import.meta.url));
const WRITERS = 4;

// All of them are started first and then all spin until one agreed instant, so
// they collide rather than queue. Running them one at a time through
// `execFileSync` would be four sequential writers — which is what the rest of the
// suite already does, and which found none of these.
function race(dir, logPath, what, env = {}, pathFor = () => logPath) {
  const startAt = Date.now() + 700;
  const started = Array.from({ length: WRITERS }, (_, i) => [
    process.execPath, writer, pathFor(i), SOURCE_ROOT, what, String(i), String(startAt),
    join(dir, `out-${i}.json`),
  ].map((a) => `'${a}'`).join(' ')).map((cmd) => `${cmd} &`).join('\n');
  execFileSync('/bin/sh', ['-c', `${started}\nwait`], {
    encoding: 'utf8', env: { ...process.env, ...env },
  });
  return Array.from({ length: WRITERS }, (_, i) => {
    try { return JSON.parse(readFileSync(join(dir, `out-${i}.json`), 'utf8')); } catch { return null; }
  }).filter(Boolean);
}

function prepared() {
  const dir = mkdtempSync(join(tmpdir(), 'v1c-'));
  const logPath = join(dir, 'log.ndjson');
  const k = new Kernel(logPath, { sourceRoot: SOURCE_ROOT, render: RENDERED });
  const c = asObject(contractDoc());
  k.approve({
    lineage: 'L', revision: 'r1', bytes: c.bytes, identity: c.identity,
    actor: 'Human Owner', rendered: RENDERED(c.bytes),
  });
  return { dir, logPath, k };
}

export function concurrentTests() {
  group('AC-13 · positions do not collide', () => {
    const { dir, logPath, k } = prepared();
    race(dir, logPath, 'assignment', { ASSIGNMENT_BYTES: JSON.stringify(assignmentDoc()) });
    const seqs = k.records().map((r) => r.seq);
    eq('every record has its own position', new Set(seqs).size, seqs.length);
    eq('and they run without a gap', seqs.join(','), seqs.map((_, i) => i).join(','));
  });

  group('AC-5 · a run never silently picks between two Assignments', () => {
    // Whether the race opens depends on the schedule, so the assertion is the
    // invariant that holds either way: one Assignment, or a refusal. A branch that
    // only sometimes runs is a test that only sometimes tests.
    const { dir, logPath, k } = prepared();
    race(dir, logPath, 'assignment', { ASSIGNMENT_BYTES: JSON.stringify(assignmentDoc()) });
    const issued = k.records().filter((r) => r.kind === 'assignment_issued');
    ok('at least one was issued', issued.length >= 1);

    let outcome;
    try { outcome = k.assignmentFor('L', 'run1') ? 'one' : 'none'; } catch (e) { outcome = e.code; }
    ok('either exactly one, or a refusal — never a quiet choice',
      (issued.length === 1 && outcome === 'one')
        || (issued.length > 1 && outcome === 'assignment_not_unique'));
  });

  group('AC-13 · one log reached by two names is one log', () => {
    // The lock is named after the log's path, so two Kernels reaching the same
    // file through a real path and a symlink took different locks and both
    // believed they held it. Applied to an attempt, one opener then received
    // another's position — the execution-merging the lock exists to close.
    const { dir, logPath, k } = prepared();
    const a = asObject(assignmentDoc());
    k.issueAssignment({
      lineage: 'L', run: 'run1', bytes: a.bytes, identity: a.identity, actor: 'Human Owner',
    });
    const linkDir = join(dir, 'via-link');
    symlinkSync(dir, linkDir);
    const viaLink = new Kernel(join(linkDir, 'log.ndjson'), {
      sourceRoot: SOURCE_ROOT, render: RENDERED,
    });
    eq('both names see one log', k.records().length, viaLink.records().length);

    // The lock is named after this, so the two must agree on it. Asserted
    // directly rather than by racing through both names: whether a collision
    // reproduces depends on the schedule, and a test that only sometimes catches
    // the defect is one that only sometimes tests.
    eq('and agree on which file it is', viaLink.logPath, k.logPath);

    // Writers do reach it by both names at once, so the paths are real.
    const results = race(dir, logPath, 'attempt', {},
      (i) => (i % 2 === 0 ? logPath : join(linkDir, 'log.ndjson'))).filter((r) => r.ok);
    const opened = k.records().filter((r) => r.kind === 'attempt_opened');
    eq('every open produced a record', opened.length, results.length);
  });

  group('AC-3 · a forked approval history has no current revision', () => {
    // Each writer's own check passed: the genesis really was the prior approval
    // it saw. What they produced together is a fan, and counting genesis records
    // caught none of it — the reader took the last sibling as current, which is a
    // fork read as a history.
    const { dir, logPath, k } = prepared();
    const genesis = k.records().find((r) => r.kind === 'contract_approved_genesis');
    race(dir, logPath, 'revision', {
      CONTRACT_BYTES: JSON.stringify(contractDoc()),
      GENESIS: genesis.identity.byte_sha256,
    });
    const approvals = k.records().filter((r) => r.kind.startsWith('contract_approved'));
    if (approvals.length > 2) {
      refuses('the lineage refuses to name one', 'lineage_predecessor_wrong',
        () => k.currentRevision('L'));
    } else {
      ok('or the writers serialised and it is a chain', k.currentRevision('L') !== null);
    }
  });

  group('AC-4 · two attempts are never the same attempt', () => {
    // The one that was actually wrong: the id was the Assignment id joined to the
    // position the log was about to reach, and four writers all predicted the same
    // number. The Gate then selected one run's observation for another's attempt.
    const { dir, logPath, k } = prepared();
    const a = asObject(assignmentDoc());
    k.issueAssignment({
      lineage: 'L', run: 'run1', bytes: a.bytes, identity: a.identity, actor: 'Human Owner',
    });
    const results = race(dir, logPath, 'attempt').filter((r) => r.ok);
    ok('several opened', results.length > 1);

    // Asserted on the log, not on what each opener was told. Concurrent opens by
    // the same producer for the same obligations are byte-identical records, so
    // no writer can point at its own line — but each landed at its own position,
    // and a position is the identity.
    const opened = k.records().filter((r) => r.kind === 'attempt_opened');
    eq('every open produced a record', opened.length, results.length);
    eq('and no two share a position', new Set(opened.map((r) => r.seq)).size, opened.length);

    // And each opener learned its own position, not somebody else's. Returning
    // "the latest attempt in the run" merged executions that never happened
    // together: three of four openers would have submitted against a fourth's
    // attempt, and complementary observations could then all pass at once.
    eq('each opener learned its own attempt',
      new Set(results.map((r) => r.attempt)).size, results.length);
    eq('and those are exactly the positions opened',
      results.map((r) => r.attempt).sort((a, b) => a - b).join(','),
      opened.map((r) => r.seq).join(','));
  });
}
