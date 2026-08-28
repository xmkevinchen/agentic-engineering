// F-088 — the entry point, and the reader.
//
// AC4: the entry point is callable on its own and requires no preceding AE skill.
// AC2's "for it": an Acceptance answers to exactly one run, so no two runs may be
// written to one path. Which run an Acceptance belongs to is answered by its
// `completion_committed` record, not by parsing the file name — every other
// resolution in this Kernel binds through the ledger.

import { mkdtempSync, existsSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { Kernel } from '../lib/kernel.mjs';
import { identify } from '../lib/identity.mjs';
import { digestBytes } from '../lib/canonical-json.mjs';
import {
  RENDERED, SOURCE_ROOT, OWNER, walk, asObject, contractDoc, assignmentDoc, packageDoc,
  ARTIFACT, INPUT, COMMAND,
} from './fixtures.mjs';
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

  group('F-088 AC1 — a run walks to an Acceptance through the binary', () => {
    const root = tmp('v1w-');
    mkdirSync(join(root, 'completions'), { recursive: true });
    const k = kernelWithRoot(root);

    // Approval is upstream of the entry point — AC1 and AC4 both begin "from an
    // approved Contract" — so the fixture seeds it and the binary never approves.
    const obligations = ['O'];
    k.openFormation({ lineage: 'W', actor: OWNER });
    const contract = asObject(contractDoc({
      lineage: 'W',
      observations: obligations.map((o) => ({
        obligation: o, observation: COMMAND, artifact: ARTIFACT, material_inputs: [INPUT],
      })),
      obligations,
    }));
    k.approve({
      lineage: 'W', revision: 'r1', bytes: contract.bytes, identity: contract.identity,
      actor: OWNER, rendered: RENDERED(contract.bytes),
    });

    const cli = (...argv) => {
      try {
        const out = execFileSync(process.execPath, [BIN, ...argv], {
          encoding: 'utf8',
          env: {
            ...process.env,
            AE_V1_ROOT: root, AE_V1_OWNER: OWNER, AE_V1_SOURCE_ROOT: SOURCE_ROOT,
          },
        });
        return { status: 0, body: JSON.parse(out) };
      } catch (error) {
        return {
          status: typeof error.status === 'number' ? error.status : 1,
          body: `${error.stdout || ''}${error.stderr || ''}`,
        };
      }
    };

    // Documents go in as documents. A caller that supplied its own digest would be
    // naming the identity of the thing it is submitting.
    const docPath = (name, value) => {
      const p = join(root, name);
      writeFileSync(p, JSON.stringify(value));
      return p;
    };

    const assignment = assignmentDoc({ lineage: 'W' });
    const r1 = cli('issue-assignment', '--lineage', 'W', '--run', 'run1',
      '--doc', docPath('assignment.json', assignment), '--actor', OWNER);
    eq('issue-assignment is performed', r1.status, 0);

    const r2 = cli('open-attempt', '--lineage', 'W', '--run', 'run1',
      '--producer', 'P', '--obligations', 'O', '--submitter', 'P');
    eq('open-attempt is performed', r2.status, 0);
    const attempt = r2.body && r2.body.result && r2.body.result.attempt;

    const r3 = cli('run-observation', '--lineage', 'W', '--run', 'run1',
      '--attempt', String(attempt), '--obligation', 'O', '--id', 'cr1', '--artifact', 'art1');
    eq('run-observation is performed', r3.status, 0);

    const pkg = packageDoc({
      lineage: 'W',
      attempt,
      material_inputs: [{
        path: INPUT,
        identity: digestBytes(readFileSync(join(SOURCE_ROOT, INPUT))),
      }],
    });
    const r4 = cli('record-package', '--lineage', 'W', '--run', 'run1',
      '--doc', docPath('package.json', pkg), '--submitter', 'P');
    eq('record-package is performed', r4.status, 0);

    const r5 = cli('observe-input', '--lineage', 'W', '--path', INPUT);
    eq('observe-input is performed', r5.status, 0);

    const r6 = cli('submit-observation', '--lineage', 'W', '--run', 'run1',
      '--obligation', 'O', '--attempt', String(attempt), '--producer', 'P',
      '--artifact', 'art1', '--pkg', pkg.id, '--command-result', 'cr1', '--submitter', 'P',
      '--observation', COMMAND);
    eq('submit-observation is performed', r6.status, 0);
    if (r6.status !== 0) console.log('   SO:', String(r6.body).slice(0, 260));

    const r7 = cli('complete', '--lineage', 'W', '--run', 'run1', '--actor', OWNER);
    eq('complete is performed', r7.status, 0);
    if (r7.status !== 0) console.log('   CO:', String(r7.body).slice(0, 260));

    // The criterion is what landed on disk, not that a command exited 0.
    const written = k.completionPathFor({ lineage: 'W', run: 'run1' });
    ok('the Acceptance exists at the path the Kernel names', existsSync(written));
    const committed = k.records().find(
      (r) => r.kind === 'completion_committed' && r.lineage === 'W' && r.run === 'run1',
    );
    ok('a completion_committed record answers for it', committed !== undefined);
    // The record's identity must answer for the bytes that are actually there —
    // comparing the objects would compare two references and always differ.
    ok('and its identity answers for the bytes on disk',
      committed !== undefined
        && identify(readFileSync(written, 'utf8')).byte_sha256 === committed.identity.byte_sha256);
  });
}
