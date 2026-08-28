// F-088 — the entry point, and the reader.
//
// AC4: the entry point is callable on its own and requires no preceding AE skill.
// AC2's "for it": an Acceptance answers to exactly one run, so no two runs may be
// written to one path. Which run an Acceptance belongs to is answered by its
// `completion_committed` record, not by parsing the file name — every other
// resolution in this Kernel binds through the ledger.

import { mkdtempSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { Kernel } from '../lib/kernel.mjs';
import { RENDERED, SOURCE_ROOT, OWNER, walk } from './fixtures.mjs';
import { group, ok, eq } from './harness.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const BIN = join(here, '..', 'bin', 'ae-v1.mjs');
const tmp = (p) => mkdtempSync(join(tmpdir(), p));

const kernelIn = (dir) => new Kernel(join(dir, 'log.ndjson'), {
  completionRoot: dir, sourceRoot: SOURCE_ROOT, render: RENDERED, owner: OWNER,
});

// The same construction the binary performs, so the fixture and the binary read
// one ledger.
const kernelWithRoot = (root) => new Kernel(join(root, 'log.ndjson'), {
  completionRoot: join(root, 'completions'),
  sourceRoot: SOURCE_ROOT, render: RENDERED, owner: OWNER,
});

export function entryTests() {
  group('F-088 AC4 — an Acceptance answers to one run', () => {
    const dir = tmp('v1p-');
    const k = kernelIn(dir);

    // The composition is `${lineage}.${run}.acceptance.json` and the id schema
    // constrains no characters, so these two distinct runs name one file. The
    // write side fails closed on the second write; the read side this slice
    // builds does not, and there the same collision answers "accepted" to a run
    // that earned nothing.
    const a = k.completionPathFor({ lineage: 'F-088.a', run: 'b' });
    const b = k.completionPathFor({ lineage: 'F-088', run: 'a.b' });
    ok('two distinct runs do not name the same Acceptance', a !== b);

    // Distinctness has to hold across every pair, not just the two that collided.
    const pairs = [
      { lineage: 'F-088.a', run: 'b' },
      { lineage: 'F-088', run: 'a.b' },
      { lineage: 'L', run: 'run1' },
      { lineage: 'L.run1', run: '' + 'x' },
    ];
    const seen = new Map();
    for (const pair of pairs) {
      const path = k.completionPathFor(pair);
      ok(`${pair.lineage}/${pair.run} claims a path no other run claims`, !seen.has(path));
      seen.set(path, pair);
    }

    // Distinctness on hand-picked pairs cannot tell a strong disambiguator from a
    // weak one, and neither can a collision probe: pairs that share a readable
    // name come in twos, so a weak stamp fails a birthday test that never runs.
    // The first implementation sliced the digest STRING rather than its hex,
    // taking seven characters of constant `sha256:` prefix and leaving twenty
    // bits — and every collision test written against it passed.
    //
    // So assert the disambiguator itself, structurally. It is the component
    // between the run and `.acceptance.json`.
    const stampOf = (pair) => {
      const name = k.completionPathFor(pair).split('/').pop();
      const body = name.slice(0, -'.acceptance.json'.length);
      return body.split('.').pop();
    };
    ok('the disambiguator is hex, carrying no constant prefix',
      /^[0-9a-f]+$/.test(stampOf({ lineage: 'L', run: 'run1' })));
    ok('and is wide enough that distinct pairs do not meet by accident',
      stampOf({ lineage: 'L', run: 'run1' }).length >= 16);

    // And a legitimate name that happens to contain the delimiter is still
    // written, not refused — the false refusal record.test.mjs:104 pins.
    ok('a lineage naming a dotted directory is still accepted',
      typeof k.completionPathFor({ lineage: '..inside/L', run: 'run1' }) === 'string');
  });

  group('F-088 AC4 — the entry point is callable on its own', () => {
    ok('the binary exists', existsSync(BIN));

    // The criterion is that it needs no skill-produced state. So: a fresh
    // directory holding a ledger and an approved Contract, nothing under `.ae/`,
    // and the Gate's reduction must come back.
    const root = tmp('v1e-');
    mkdirSync(join(root, 'completions'), { recursive: true });
    walk(kernelWithRoot(root));

    let out = '';
    let status = 0;
    try {
      out = execFileSync(process.execPath, [BIN, 'status', '--lineage', 'L', '--run', 'run1'], {
        encoding: 'utf8',
        cwd: root,
        env: {
          ...process.env,
          AE_V1_ROOT: root,
          AE_V1_OWNER: OWNER,
          AE_V1_SOURCE_ROOT: SOURCE_ROOT,
        },
      });
    } catch (error) {
      status = typeof error.status === 'number' ? error.status : 1;
      out = `${error.stdout || ''}${error.stderr || ''}`;
    }
    eq('a run reachable from a bare directory exits 0', status, 0);

    // Setting up is not the Kernel working. A root that cannot hold a directory
    // must not exit with the code a refusal uses — otherwise a caller cannot tell
    // "the Kernel said no" from "the binary could not start".
    const blocked = join(tmp('v1b-'), 'a-file');
    writeFileSync(blocked, 'not a directory\n');
    let setupStatus = 0;
    let setupOut = '';
    try {
      execFileSync(process.execPath, [BIN, 'status', '--lineage', 'L', '--run', 'run1'], {
        encoding: 'utf8',
        env: { ...process.env, AE_V1_ROOT: blocked, AE_V1_OWNER: OWNER },
      });
    } catch (error) {
      setupStatus = typeof error.status === 'number' ? error.status : 1;
      setupOut = `${error.stderr || ''}`;
    }
    eq('a root that cannot be set up exits misuse, not refusal', setupStatus, 2);
    ok('and says so rather than naming a Kernel code',
      setupOut.includes('setup_failed'));
    let parsed = null;
    try { parsed = JSON.parse(out); } catch { parsed = null; }
    ok('it answers with one JSON envelope', parsed !== null && parsed.ok === true);
    ok('and the envelope carries the Gate reduction, not a claim about it',
      parsed !== null && parsed.result !== undefined
        && typeof parsed.result.byObligation === 'object');
  });
}
