// Executes the acyclic installed-release bootstrap corpus.
//
// Every rejection case asserts two things: the typed error, and that the import
// trace is EMPTY. Exit status alone would not distinguish "refused before
// importing anything" from "imported the core, then noticed" — and the second is
// the failure the DAG exists to prevent.

import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  mkdtempSync, readFileSync, readdirSync, rmSync, statSync, symlinkSync, writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { canonicalize } from '../lib/canonical-json.mjs';
import { buildRelease } from '../lib/release-build.mjs';
import { Checks } from './harness.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const POLICY_SOURCE = join(HERE, '..', '..', 'fixtures', 'v1-foundation', 'policy-bundle', 'release-a');

const EXPECTED_TRACE = [
  'import:validators-v1',
  'import:active-release-bridge',
  'attestation:obtained',
  'capability:minted',
  'import:ae-gate-core',
];

function listFiles(root, prefix = '') {
  return readdirSync(join(root, prefix)).sort().flatMap((name) => {
    const rel = prefix ? `${prefix}/${name}` : name;
    return statSync(join(root, rel)).isDirectory() ? listFiles(root, rel) : [rel];
  });
}

function makeWorkspace() {
  return mkdtempSync(join(tmpdir(), 'ae-release-'));
}

function launch(launcherPath, { work, hostRecord }) {
  const logPath = join(work, `trace-${Math.abs(hashCode(launcherPath + Date.now()))}.log`);
  writeFileSync(logPath, '');
  const env = { ...process.env, AE_FIXTURE_IMPORT_LOG: logPath };
  if (hostRecord) env.AE_FIXTURE_HOST_RECORD = hostRecord;
  let status = 0;
  let stdout = '';
  try {
    stdout = execFileSync('node', [launcherPath], { encoding: 'utf8', env, stdio: ['ignore', 'pipe', 'pipe'] });
  } catch (error) {
    status = error.status ?? -1;
    stdout = error.stdout ?? '';
  }
  let parsed = null;
  try { parsed = JSON.parse(stdout.trim()); } catch { /* non-JSON output stays null */ }
  const trace = readFileSync(logPath, 'utf8').split('\n').filter(Boolean);
  return { status, stdout, parsed, trace };
}

let hashSeed = 0;
function hashCode(text) {
  hashSeed += 1;
  let h = hashSeed;
  for (let i = 0; i < text.length; i += 1) h = (h * 31 + text.charCodeAt(i)) | 0;
  return h;
}

function writeHostRecord(work, name, { activeRoot, digest }) {
  const path = join(work, `${name}.json`);
  writeFileSync(path, JSON.stringify({ active_root: activeRoot, active_release_manifest_digest: digest }));
  return path;
}

// A rejection case: build a release (optionally transformed), optionally break it
// on disk, run the launcher, and require the exact code with an empty trace.
function expectRejection(checks, id, { work, build, breakIt, expectedCode, expectTrace = [] }) {
  const releaseRoot = join(work, `release-${id}`);
  let built;
  try {
    built = build ? build(releaseRoot) : buildRelease({ releaseRoot, policySourceDir: POLICY_SOURCE });
  } catch (error) {
    checks.ok(`${id}/build`, false, `fixture build threw: ${error.message}`);
    return;
  }
  if (breakIt) breakIt(built);
  const hostRecord = writeHostRecord(work, `host-${id}`, {
    activeRoot: releaseRoot, digest: built.manifestDigest,
  });
  const result = launch(built.launcherPath, { work, hostRecord });
  checks.equal(`${id}/exit-nonzero`, result.status !== 0, true);
  checks.equal(`${id}/code`, result.parsed?.error, expectedCode);
  checks.equal(`${id}/trace`, result.trace.join(','), expectTrace.join(','));
}

export async function run() {
  const checks = new Checks('release-bootstrap');
  const work = makeWorkspace();

  try {
    // ---- valid build ----------------------------------------------------
    const rootA = join(work, 'release-a');
    const a = buildRelease({ releaseRoot: rootA, policySourceDir: POLICY_SOURCE });
    const hostA = writeHostRecord(work, 'host-a', { activeRoot: rootA, digest: a.manifestDigest });

    checks.ok('manifest-has-no-self-digest',
      !Object.prototype.hasOwnProperty.call(a.manifest, 'self_digest'));
    checks.ok('launcher-is-not-a-member',
      !a.manifest.members.some((m) => m.ref === 'runtime/ae-gate.mjs'));
    // Recomputed here rather than trusted from the builder: the authoritative
    // digest is SHA-256 over JCS of the complete manifest object, held outside it.
    checks.equal('manifest-digest-is-external',
      a.manifestDigest,
      `sha256:${createHash('sha256').update(canonicalize(a.manifest)).digest('hex')}`);

    const okRun = launch(a.launcherPath, { work, hostRecord: hostA });
    checks.equal('valid/exit-zero', okRun.status, 0);
    checks.equal('valid/result-ok', okRun.parsed?.ok, true);
    checks.equal('valid/import-order', okRun.trace.join(','), EXPECTED_TRACE.join(','));

    // ---- rebuild is byte-identical ---------------------------------------
    const rootRebuild = join(work, 'release-rebuild');
    const rebuilt = buildRelease({ releaseRoot: rootRebuild, policySourceDir: POLICY_SOURCE });
    checks.equal('rebuild/manifest-digest', rebuilt.manifestDigest, a.manifestDigest);
    const filesA = listFiles(rootA);
    const filesB = listFiles(rootRebuild);
    checks.equal('rebuild/file-set', filesB.join(','), filesA.join(','));
    let identical = true;
    for (const rel of filesA) {
      if (!readFileSync(join(rootA, rel)).equals(readFileSync(join(rootRebuild, rel)))) {
        identical = false;
        checks.ok(`rebuild/bytes/${rel}`, false, 'rebuilt bytes differ');
      }
    }
    checks.ok('rebuild/byte-identical', identical);

    // ---- every required member, tampered and missing ----------------------
    const REQUIRED = [
      ['validator', 'runtime/validators-v1.mjs'],
      ['bridge', 'runtime/active-release-bridge.mjs'],
      ['core', 'runtime/ae-gate-core.mjs'],
      ['schema', 'schemas/release-manifest-v1.schema.json'],
      ['policy', 'policies/runner-v1.json'],
      ['policy-bundle', 'policies/bundle-v1.json'],
    ];
    for (const [label, ref] of REQUIRED) {
      expectRejection(checks, `tamper-${label}`, {
        work,
        breakIt: (built) => {
          const path = join(built.releaseRoot, ref);
          writeFileSync(path, Buffer.concat([readFileSync(path), Buffer.from('\n// tampered\n')]));
        },
        expectedCode: 'member_digest_mismatch',
      });
      // Length-preserving tamper. Without it the declared-length check alone
      // would satisfy every tamper case and the digest recomputation could be
      // removed without turning this suite red.
      expectRejection(checks, `tamper-same-length-${label}`, {
        work,
        breakIt: (built) => {
          const path = join(built.releaseRoot, ref);
          const bytes = readFileSync(path);
          bytes[bytes.length - 1] = bytes[bytes.length - 1] === 0x20 ? 0x09 : 0x20;
          writeFileSync(path, bytes);
        },
        expectedCode: 'member_digest_mismatch',
      });
      expectRejection(checks, `missing-${label}`, {
        work,
        breakIt: (built) => rmSync(join(built.releaseRoot, ref)),
        expectedCode: 'member_missing',
      });
    }

    // ---- manifest-level rejections ---------------------------------------
    expectRejection(checks, 'manifest-tamper', {
      work,
      breakIt: (built) => {
        const manifest = JSON.parse(readFileSync(join(built.releaseRoot, 'release-manifest-v1.json'), 'utf8'));
        manifest.release_version = '9.9.9';
        writeFileSync(join(built.releaseRoot, 'release-manifest-v1.json'), canonicalize(manifest));
      },
      expectedCode: 'manifest_digest_mismatch',
    });

    // self_digest and unknown fields are rejected in a *consistently built*
    // release — the launcher embeds the digest of the bad manifest, so the
    // rejection cannot be explained away as a digest mismatch.
    expectRejection(checks, 'self-digest', {
      work,
      build: (releaseRoot) => buildRelease({
        releaseRoot,
        policySourceDir: POLICY_SOURCE,
        transformManifest: (m) => ({ ...m, self_digest: 'sha256:'.padEnd(71, '0') }),
      }),
      expectedCode: 'manifest_has_self_digest',
    });

    expectRejection(checks, 'unknown-field', {
      work,
      build: (releaseRoot) => buildRelease({
        releaseRoot,
        policySourceDir: POLICY_SOURCE,
        transformManifest: (m) => ({ ...m, undeclared_field: 'x' }),
      }),
      expectedCode: 'schema_invalid',
    });

    // Duplicate keys cannot be expressed as an object, so the bytes are supplied
    // directly. The launcher must refuse at the lexical layer, before the digest
    // check it would otherwise pass.
    expectRejection(checks, 'duplicate-keys', {
      work,
      build: (releaseRoot) => {
        const staged = buildRelease({ releaseRoot: `${releaseRoot}-stage`, policySourceDir: POLICY_SOURCE });
        const text = canonicalize(staged.manifest).toString('utf8');
        const withDuplicate = Buffer.from(`{"release_id":"x",${text.slice(1)}`, 'utf8');
        return buildRelease({
          releaseRoot, policySourceDir: POLICY_SOURCE, manifestBytesOverride: withDuplicate,
        });
      },
      expectedCode: 'duplicate_key',
    });

    // ---- member ref escapes ----------------------------------------------
    // An absolute ref never reaches the launcher's path guard: the closed schema's
    // `plugin_ref` pattern refuses it first. Both layers are asserted — the
    // end-to-end code here, and the launcher's own guard directly below.
    expectRejection(checks, 'ref-absolute', {
      work,
      build: (releaseRoot) => buildRelease({
        releaseRoot,
        policySourceDir: POLICY_SOURCE,
        transformManifest: (m) => ({
          ...m,
          members: m.members.map((x) => (x.role === 'policy' ? { ...x, ref: '/etc/hosts' } : x)),
        }),
      }),
      expectedCode: 'schema_invalid',
    });

    const launcherModule = await import(`file://${a.launcherPath}`);
    for (const [label, badRef, code] of [
      ['absolute', '/etc/hosts', 'member_ref_absolute'],
      ['dotdot', '../outside/policy.json', 'member_ref_escapes_root'],
    ]) {
      let observed = null;
      try {
        launcherModule.resolveMemberRef(badRef);
      } catch (error) {
        observed = error.code;
      }
      checks.equal(`ref-guard-direct/${label}`, observed, code);
    }

    expectRejection(checks, 'ref-dotdot', {
      work,
      build: (releaseRoot) => buildRelease({
        releaseRoot,
        policySourceDir: POLICY_SOURCE,
        transformManifest: (m) => ({
          ...m,
          members: m.members.map((x) => (x.role === 'policy' ? { ...x, ref: '../outside/policy.json' } : x)),
        }),
      }),
      expectedCode: 'member_ref_escapes_root',
    });

    expectRejection(checks, 'ref-duplicate', {
      work,
      build: (releaseRoot) => buildRelease({
        releaseRoot,
        policySourceDir: POLICY_SOURCE,
        transformManifest: (m) => ({ ...m, members: [...m.members, m.members[0]] }),
      }),
      expectedCode: 'member_ref_duplicate',
    });

    expectRejection(checks, 'ref-symlink', {
      work,
      build: (releaseRoot) => buildRelease({
        releaseRoot,
        policySourceDir: POLICY_SOURCE,
        transformManifest: (m) => ({
          ...m,
          members: m.members.map((x) => (x.role === 'standalone_validator'
            ? { ...x, ref: 'runtime-alias/validators-v1.mjs' }
            : x)),
        }),
      }),
      // The symlink is created after the build so the declared digest is the
      // real file's digest: the rejection is about the *path*, not the bytes.
      breakIt: (built) => symlinkSync(join(built.releaseRoot, 'runtime'), join(built.releaseRoot, 'runtime-alias')),
      expectedCode: 'member_ref_symlink',
    });

    expectRejection(checks, 'launcher-as-member', {
      work,
      build: (releaseRoot) => buildRelease({
        releaseRoot,
        policySourceDir: POLICY_SOURCE,
        transformManifest: (m) => ({
          ...m,
          members: [...m.members, {
            role: 'schema', ref: 'runtime/ae-gate.mjs', raw_digest: `sha256:${'0'.repeat(64)}`, length: 1,
          }],
        }),
      }),
      expectedCode: 'launcher_is_member',
    });

    // ---- direct core invocation ------------------------------------------
    const coreRun = launch(join(rootA, 'runtime', 'ae-gate-core.mjs'), { work, hostRecord: hostA });
    checks.equal('direct-core/exit-nonzero', coreRun.status !== 0, true);
    checks.equal('direct-core/code', coreRun.parsed?.error, 'unsupported_direct_invocation');

    // Importing the core module and calling its export is equally inert: the
    // export re-verifies the capability itself.
    const importPath = join(work, 'direct-import.mjs');
    writeFileSync(importPath, [
      `const core = await import(${JSON.stringify(join(rootA, 'runtime', 'ae-gate-core.mjs'))});`,
      'try {',
      "  const out = core.run({ capability: null, bootstrap_result_digest: 'sha256:0' });",
      '  process.stdout.write(JSON.stringify({ unexpected: out }));',
      '} catch (error) {',
      '  process.stdout.write(JSON.stringify({ error: error.code }));',
      '  process.exit(1);',
      '}',
    ].join('\n'));
    const importRun = launch(importPath, { work, hostRecord: hostA });
    checks.equal('direct-import/code', importRun.parsed?.error, 'release_not_active');

    // ---- A/B: two complete roots, host says B is active -------------------
    const rootB = join(work, 'release-b');
    const b = buildRelease({
      releaseRoot: rootB, policySourceDir: POLICY_SOURCE, releaseVersion: '1.0.1',
    });
    checks.ok('ab/distinct-digests', a.manifestDigest !== b.manifestDigest);
    const hostB = writeHostRecord(work, 'host-b', { activeRoot: rootB, digest: b.manifestDigest });

    const bRun = launch(b.launcherPath, { work, hostRecord: hostB });
    checks.equal('ab/active-root-runs', bRun.parsed?.ok, true);

    const aWhileBActive = launch(a.launcherPath, { work, hostRecord: hostB });
    checks.equal('ab/inactive-root-refused', aWhileBActive.parsed?.error, 'release_not_active');
    // The inactive root verified its own members and imported the bridge to ask
    // the host — and then stopped. The core was never imported.
    checks.equal('ab/inactive-root-trace', aWhileBActive.trace.join(','),
      ['import:validators-v1', 'import:active-release-bridge', 'attestation:obtained'].join(','));

    // ---- no host record at all -------------------------------------------
    const noHost = launch(a.launcherPath, { work, hostRecord: null });
    checks.equal('no-host-record/code', noHost.parsed?.error, 'active_release_unavailable');
    checks.equal('no-host-record/no-core-import',
      noHost.trace.includes('import:ae-gate-core'), false);

    return checks;
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { report } = await import('./harness.mjs');
  process.exit(report([await run()], { verbose: process.argv.includes('--verbose') }) === 0 ? 0 : 1);
}
