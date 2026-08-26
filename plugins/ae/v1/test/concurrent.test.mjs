// AC-4, AC-5, AC-13 — what happens when two writers share a log.
//
// Every "read the log, then append" is two operations, and the gap between them
// only exists when something else is running. Three rounds of review found real
// defects in that gap: a sequence number two Ledgers both handed out, an attempt
// id minted from the position the log was *about* to reach, and a second
// Assignment both issuers thought they were the first to write. None of them was
// visible from a single process, which is why these spawn real ones.

import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync } from 'node:fs';
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
function race(dir, logPath, what, env = {}) {
  const startAt = Date.now() + 700;
  const started = Array.from({ length: WRITERS }, (_, i) => [
    process.execPath, writer, logPath, SOURCE_ROOT, what, String(i), String(startAt),
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

  group('AC-5 · a run that ends up with two Assignments holds none', () => {
    // Both issuers read no Assignment and both wrote one. Uniqueness is decided
    // when the Assignment is read, so the run fails closed rather than the reader
    // quietly taking the first.
    const { dir, logPath, k } = prepared();
    race(dir, logPath, 'assignment', { ASSIGNMENT_BYTES: JSON.stringify(assignmentDoc()) });
    const issued = k.records().filter((r) => r.kind === 'assignment_issued');
    ok('at least one was issued', issued.length >= 1);
    if (issued.length > 1) {
      refuses('and the run refuses to proceed', 'assignment_not_unique',
        () => k.assignmentFor('L', 'run1'));
    } else {
      ok('or exactly one landed', k.assignmentFor('L', 'run1').id.startsWith('A'));
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

    // And every opener was told the same latest attempt, which is the one the
    // Gate selects. An older one would never be selected, so telling an opener it
    // held one would be telling it something untrue about its own submissions.
    eq('each opener learned the attempt the Gate will select',
      new Set(results.map((r) => r.attempt)).size, 1);
    eq('which is the last one opened',
      results[0].attempt, opened[opened.length - 1].seq);
  });
}
