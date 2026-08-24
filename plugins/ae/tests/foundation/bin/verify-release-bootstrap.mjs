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
import { verifyBootstrap } from '../lib/active-release-provider.mjs';
import { Checks } from './harness.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const POLICY_SOURCE = join(HERE, '..', '..', 'fixtures', 'v1-foundation', 'policy-bundle', 'release-a');

const EXPECTED_TRACE = [
  'import:validators-v1',
  'import:active-release-bridge',
  'attestation:obtained',
  'active-root:matched',
  'capability:minted',
  'import:ae-gate-core',
];

// What a launcher gets through when the host says a DIFFERENT root is active: it
// verifies its own members, imports the bridge to ask, and stops. Crucially it
// never reaches 'active-root:matched'.
const INACTIVE_ROOT_TRACE = [
  'import:validators-v1',
  'import:active-release-bridge',
  'attestation:obtained',
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

// The record names the active ROOT only. The bridge derives that root's manifest
// digest from the root itself, so a caller who controls the record can choose an
// installed release but cannot describe one.
function writeHostRecord(work, name, { activeRoot }) {
  const path = join(work, `${name}.json`);
  writeFileSync(path, JSON.stringify({ active_root: activeRoot }));
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
  const hostRecord = writeHostRecord(work, `host-${id}`, { activeRoot: releaseRoot });
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
    const hostA = writeHostRecord(work, 'host-a', { activeRoot: rootA });

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
      ['dot-component', 'policies/./runner-v1.json', 'member_ref_non_canonical'],
      ['empty-component', 'policies//runner-v1.json', 'member_ref_non_canonical'],
      ['trailing-slash', 'policies/runner-v1.json/', 'member_ref_non_canonical'],
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
    checks.equal('direct-import/code', importRun.parsed?.error, 'capability_not_minted');

    // ---- activation base bundle must BE a verified member -----------------
    expectRejection(checks, 'base-digest-not-a-member', {
      work,
      build: (releaseRoot) => buildRelease({
        releaseRoot,
        policySourceDir: POLICY_SOURCE,
        transformManifest: (m) => ({ ...m, activation_base_bundle_digest: `sha256:${'0'.repeat(64)}` }),
      }),
      expectedCode: 'activation_base_member_mismatch',
    });
    expectRejection(checks, 'base-ref-names-no-member', {
      work,
      build: (releaseRoot) => buildRelease({
        releaseRoot,
        policySourceDir: POLICY_SOURCE,
        transformManifest: (m) => ({ ...m, activation_base_bundle_ref: 'policies/not-installed.json' }),
      }),
      expectedCode: 'activation_base_member_mismatch',
    });
    expectRejection(checks, 'base-ref-names-a-non-policy-member', {
      work,
      build: (releaseRoot) => buildRelease({
        releaseRoot,
        policySourceDir: POLICY_SOURCE,
        transformManifest: (m) => ({
          ...m,
          activation_base_bundle_ref: 'schemas/release-manifest-v1.schema.json',
          activation_base_bundle_digest:
            m.members.find((x) => x.ref === 'schemas/release-manifest-v1.schema.json').raw_digest,
        }),
      }),
      expectedCode: 'activation_base_member_mismatch',
    });

    // ---- one file, two member refs ----------------------------------------
    // A `.` component makes one file addressable under two ref strings, which
    // string-level duplicate detection cannot see.
    expectRejection(checks, 'ref-dot-alias', {
      work,
      build: (releaseRoot) => buildRelease({
        releaseRoot,
        policySourceDir: POLICY_SOURCE,
        transformManifest: (m) => ({
          ...m,
          members: [...m.members, {
            ...m.members.find((x) => x.ref === 'policies/runner-v1.json'),
            ref: 'policies/./runner-v1.json',
          }],
        }),
      }),
      expectedCode: 'member_ref_non_canonical',
    });
    expectRejection(checks, 'ref-empty-component', {
      work,
      build: (releaseRoot) => buildRelease({
        releaseRoot,
        policySourceDir: POLICY_SOURCE,
        transformManifest: (m) => ({
          ...m,
          members: [...m.members, {
            ...m.members.find((x) => x.ref === 'policies/runner-v1.json'),
            ref: 'policies//runner-v1.json',
          }],
        }),
      }),
      // Refused by the closed schema's plugin_ref pattern before the launcher's
      // canonicality guard sees it; the guard itself is asserted directly below.
      expectedCode: 'schema_invalid',
    });

    // Case folding produces the same aliasing on a case-insensitive volume, and
    // no lexical rule can catch it — only resolved identity can. Skipped loudly
    // where the filesystem is case-sensitive rather than passed silently.
    const caseProbe = join(work, 'CaseProbe');
    writeFileSync(caseProbe, 'probe');
    let caseInsensitive = false;
    try {
      readFileSync(join(work, 'caseprobe'));
      caseInsensitive = true;
    } catch { /* case-sensitive volume */ }
    if (!caseInsensitive) {
      checks.skip('ref-case-alias', 'filesystem is case-sensitive; alias cannot be constructed here');
    } else {
      expectRejection(checks, 'ref-case-alias', {
        work,
        build: (releaseRoot) => buildRelease({
          releaseRoot,
          policySourceDir: POLICY_SOURCE,
          transformManifest: (m) => ({
            ...m,
            members: [...m.members, {
              ...m.members.find((x) => x.ref === 'policies/runner-v1.json'),
              ref: 'policies/RUNNER-V1.json',
            }],
          }),
        }),
        expectedCode: 'member_ref_duplicate',
      });
    }

    // ---- A/B: two complete roots, host says B is active -------------------
    const rootB = join(work, 'release-b');
    const b = buildRelease({
      releaseRoot: rootB, policySourceDir: POLICY_SOURCE, releaseVersion: '1.0.1',
    });
    checks.ok('ab/distinct-digests', a.manifestDigest !== b.manifestDigest);
    const hostB = writeHostRecord(work, 'host-b', { activeRoot: rootB });

    const bRun = launch(b.launcherPath, { work, hostRecord: hostB });
    checks.equal('ab/active-root-runs', bRun.parsed?.ok, true);

    const aWhileBActive = launch(a.launcherPath, { work, hostRecord: hostB });
    checks.equal('ab/inactive-root-refused', aWhileBActive.parsed?.error, 'release_not_active');
    // The inactive root verified its own members and imported the bridge to ask
    // the host — and then stopped. The core was never imported.
    checks.equal('ab/inactive-root-trace', aWhileBActive.trace.join(','), INACTIVE_ROOT_TRACE.join(','));

    // ---- two BYTE-IDENTICAL roots, host says one of them ------------------
    // Identical content means identical manifest digests, so digest comparison
    // alone cannot tell these apart. Only the resolved root identity can.
    const twinA = join(work, 'twin-a');
    const twinB = join(work, 'twin-b');
    const tA = buildRelease({ releaseRoot: twinA, policySourceDir: POLICY_SOURCE });
    const tB = buildRelease({ releaseRoot: twinB, policySourceDir: POLICY_SOURCE });
    checks.equal('twin/digests-are-identical', tA.manifestDigest, tB.manifestDigest);

    const hostTwinB = writeHostRecord(work, 'host-twin-b', { activeRoot: twinB });
    const twinBRun = launch(tB.launcherPath, { work, hostRecord: hostTwinB });
    checks.equal('twin/active-twin-runs', twinBRun.parsed?.ok, true);

    const twinARun = launch(tA.launcherPath, { work, hostRecord: hostTwinB });
    checks.equal('twin/inactive-twin-refused', twinARun.parsed?.error, 'release_not_active');
    checks.equal('twin/inactive-twin-no-core-import',
      twinARun.trace.includes('import:ae-gate-core'), false);
    // The identity comparison is the step that must refuse here. Asserting the
    // trace rather than only the error code keeps the bridge's own mint-time
    // check from masking the loss of this one.
    checks.equal('twin/inactive-twin-trace', twinARun.trace.join(','), INACTIVE_ROOT_TRACE.join(','));
    checks.equal('twin/active-twin-matched-root',
      twinBRun.trace.includes('active-root:matched'), true);

    // The record names the active root; the digest is read off that root. A record
    // that also carries a digest — truthful or not — changes nothing.
    {
      const lyingRecord = join(work, 'host-lying-digest.json');
      writeFileSync(lyingRecord, JSON.stringify({
        active_root: rootA,
        active_release_manifest_digest: `sha256:${'e'.repeat(64)}`,
      }));
      const lyingRun = launch(a.launcherPath, { work, hostRecord: lyingRecord });
      checks.equal('host-record/lying-digest-is-ignored', lyingRun.parsed?.ok, true);

      // ...and it cannot make an inactive root look active either.
      const lyingAboutB = join(work, 'host-lying-about-b.json');
      writeFileSync(lyingAboutB, JSON.stringify({
        active_root: rootB,
        active_release_manifest_digest: a.manifestDigest,
      }));
      const lyingRunB = launch(a.launcherPath, { work, hostRecord: lyingAboutB });
      checks.equal('host-record/lying-digest-cannot-activate-another-root',
        lyingRunB.parsed?.error, 'release_not_active');
    }

    // ---- capability cannot be constructed from public data ----------------
    // Everything a forger could know — both digests and the schema version — is
    // public. The capability is accepted only if this bridge instance minted it.
    const capabilityCases = [
      ['null-capability', 'null', 'capability_not_minted'],
      ['forged-plain-object', `{
        schema_version: 'ae.active-release-operation.v1',
        fixture_only: true,
        active_release_manifest_digest: MANIFEST_DIGEST,
        active_root_identity: ROOT_IDENTITY,
        bootstrap_result_digest: BOOTSTRAP_DIGEST,
        scope: SCOPE,
        nonce: 'deadbeef'.repeat(4),
        issued_at: 0,
        expires_at: 1e15,
      }`, 'capability_not_minted'],
      ['forged-with-bearer-shaped-field', `{
        schema_version: 'ae.active-release-operation.v1',
        active_release_manifest_digest: MANIFEST_DIGEST,
        bootstrap_result_digest: BOOTSTRAP_DIGEST,
        scope: SCOPE,
        expires_at: 1e15,
        __bearer: require('node:crypto').createHash('sha256')
          .update(MANIFEST_DIGEST + '|' + BOOTSTRAP_DIGEST).digest('hex'),
      }`, 'capability_not_minted'],
    ];

    for (const [label, expr, expectedCode] of capabilityCases) {
      const probe = join(work, `cap-${label}.mjs`);
      writeFileSync(probe, [
        "import { createRequire } from 'node:module';",
        'const require = createRequire(import.meta.url);',
        `const MANIFEST_DIGEST = ${JSON.stringify(a.manifestDigest)};`,
        `const ROOT_IDENTITY = ${JSON.stringify(rootA)};`,
        `const BOOTSTRAP_DIGEST = ${JSON.stringify(`sha256:${'7'.repeat(64)}`)};`,
        "const SCOPE = { repo: null, feature_id: null, purpose: 'bootstrap_selftest', "
          + "host_operation: 'verify_installed_release' };",
        `const core = await import(${JSON.stringify(join(rootA, 'runtime', 'ae-gate-core.mjs'))});`,
        'try {',
        `  const out = core.run({ capability: ${expr}, bootstrapResultDigest: BOOTSTRAP_DIGEST, scope: SCOPE });`,
        '  process.stdout.write(JSON.stringify({ unexpected: out }));',
        '} catch (error) {',
        '  process.stdout.write(JSON.stringify({ error: error.code }));',
        '  process.exit(1);',
        '}',
      ].join('\n'));
      const probeRun = launch(probe, { work, hostRecord: hostA });
      checks.equal(`capability/${label}`, probeRun.parsed?.error, expectedCode);
    }

    // A genuinely minted capability is still inert outside the bootstrap result,
    // the scope, and the lifetime it was issued for.
    const bridge = await import(`file://${join(rootA, 'runtime', 'active-release-bridge.mjs')}`);
    const launcherA = await import(`file://${a.launcherPath}`);
    process.env.AE_FIXTURE_HOST_RECORD = hostA;
    const verifiedA = launcherA.verifyInstalledRelease();
    const attestationA = bridge.attestActiveRoot({ observedReleaseRoot: rootA });
    const derivedA = bridge.deriveBootstrapResult({ releaseRoot: rootA });
    checks.equal('bridge/derives-the-same-bootstrap-result',
      derivedA.bootstrap_result_digest, verifiedA.bootstrap_result_digest);
    checks.equal('bridge/derives-the-same-manifest-digest',
      derivedA.manifest_digest, verifiedA.manifest_digest);

    // The derivation exists in three places: this launcher, the bridge it cross-
    // checks against, and lib/active-release-provider.mjs, which exists so the
    // policy corpus can seal a verified active release in-process without spawning
    // the whole bootstrap. The first two check each other at run time by design;
    // this is what stops the third drifting away from that pair unnoticed.
    const libDerived = verifyBootstrap({ releaseRoot: rootA });
    checks.equal('lib-provider/agrees-with-the-bridge',
      libDerived.bootstrap_result_digest, derivedA.bootstrap_result_digest);
    checks.equal('lib-provider/agrees-on-manifest-digest',
      libDerived.manifest_digest, derivedA.manifest_digest);
    checks.equal('lib-provider/agrees-on-root-identity',
      libDerived.root_identity, derivedA.root_identity);
    const realScope = {
      repo: null, feature_id: 'F-100', purpose: 'record_event', host_operation: 'append',
    };
    const realCapability = bridge.mintOperationCapability({
      attestation: attestationA, bootstrapResult: derivedA, scope: realScope, issuedAt: 1000, ttlMs: 60000,
    });

    checks.ok('capability/minted-carries-no-bearer',
      !Object.keys(realCapability).some((k) => k.toLowerCase().includes('bearer')));

    // A brand certifies identity, not content: a mutable scope on a branded
    // capability would let a caller keep the brand and rewrite what it authorises.
    let scopeMutationBlocked = false;
    try { realCapability.scope.purpose = 'finalize'; } catch { scopeMutationBlocked = true; }
    checks.ok('capability/scope-cannot-be-rewritten-in-place', scopeMutationBlocked);
    checks.equal('capability/scope-intact-after-attempt', realCapability.scope.purpose, 'record_event');
    let expiryMutationBlocked = false;
    try { realCapability.expires_at = 1e15; } catch { expiryMutationBlocked = true; }
    checks.ok('capability/expiry-cannot-be-rewritten-in-place', expiryMutationBlocked);

    const coreA = await import(`file://${join(rootA, 'runtime', 'ae-gate-core.mjs')}`);
    const coreCode = (fn) => {
      try { fn(); return 'accepted'; } catch (error) { return error.code; }
    };

    checks.equal('capability/genuine-accepted',
      coreCode(() => coreA.run({
        capability: realCapability,
        bootstrapResultDigest: derivedA.bootstrap_result_digest,
        scope: realScope,
        now: 2000,
      })), 'accepted');

    checks.equal('capability/replayed-onto-another-bootstrap-result',
      coreCode(() => coreA.run({
        capability: realCapability,
        bootstrapResultDigest: `sha256:${'4'.repeat(64)}`,
        scope: realScope,
        now: 2000,
      })), 'capability_bootstrap_mismatch');

    for (const [field, value] of [
      ['purpose', 'finalize'], ['host_operation', 'move'], ['feature_id', 'F-999'],
    ]) {
      checks.equal(`capability/wrong-scope-${field}`,
        coreCode(() => coreA.run({
          capability: realCapability,
          bootstrapResultDigest: derivedA.bootstrap_result_digest,
          scope: { ...realScope, [field]: value },
          now: 2000,
        })), 'capability_scope_mismatch');
    }

    // The case the value comparison alone cannot see: a capability minted with an
    // explicitly-undefined scope entry, verified against a request that omits the
    // key. Both read as `undefined`, so only a presence check separates them.
    const holedCapability = bridge.mintOperationCapability({
      attestation: attestationA,
      bootstrapResult: derivedA,
      scope: { ...realScope, host_operation: undefined },
      issuedAt: 1000,
      ttlMs: 60000,
    });
    checks.equal('capability/undefined-scope-value-vs-omitted-key',
      coreCode(() => coreA.run({
        capability: holedCapability,
        bootstrapResultDigest: derivedA.bootstrap_result_digest,
        scope: { repo: null, feature_id: 'F-100', purpose: 'record_event' },
        now: 2000,
      })), 'capability_scope_mismatch');

    // A scope entry that is present-but-undefined must not match an omitted key.
    checks.equal('capability/scope-omitted-key-is-not-a-match',
      coreCode(() => coreA.run({
        capability: realCapability,
        bootstrapResultDigest: derivedA.bootstrap_result_digest,
        scope: { repo: null, feature_id: 'F-100', purpose: 'record_event' },
        now: 2000,
      })), 'capability_scope_mismatch');

    checks.equal('capability/expired',
      coreCode(() => coreA.run({
        capability: realCapability,
        bootstrapResultDigest: derivedA.bootstrap_result_digest,
        scope: realScope,
        now: 1000 + 60000 + 1,
      })), 'capability_expired');

    // Minting also refuses a fabricated attestation and a fabricated bootstrap
    // result: both halves of the active identity are re-checked at mint time.
    checks.equal('capability/mint-refuses-forged-attestation',
      coreCode(() => bridge.mintOperationCapability({
        attestation: { ...attestationA },
        bootstrapResult: verifiedA,
        scope: realScope,
      })), 'capability_not_minted');
    // A bootstrap result the caller wrote is refused however self-consistent it is,
    // including a shallow copy of a genuine one.
    checks.equal('capability/mint-refuses-caller-authored-bootstrap-result',
      coreCode(() => bridge.mintOperationCapability({
        attestation: attestationA,
        bootstrapResult: {
          schema_version: 'ae.bootstrap-result.v1',
          fixture_only: true,
          manifest_digest: derivedA.manifest_digest,
          root_identity: derivedA.root_identity,
          member_count: derivedA.member_count,
          bootstrap_result_digest: derivedA.bootstrap_result_digest,
        },
        scope: realScope,
      })), 'bootstrap_result_not_derived');
    checks.equal('capability/mint-refuses-copied-bootstrap-result',
      coreCode(() => bridge.mintOperationCapability({
        attestation: attestationA, bootstrapResult: { ...derivedA }, scope: realScope,
      })), 'bootstrap_result_not_derived');
    checks.equal('capability/mint-refuses-missing-bootstrap-result',
      coreCode(() => bridge.mintOperationCapability({
        attestation: attestationA, bootstrapResult: null, scope: realScope,
      })), 'bootstrap_result_not_derived');
    // The derivation itself cannot be earned for a release that does not verify.
    checks.equal('bridge/refuses-to-derive-for-a-missing-root',
      coreCode(() => bridge.deriveBootstrapResult({ releaseRoot: join(work, 'no-such-release') })),
      'bootstrap_result_not_derived');
    delete process.env.AE_FIXTURE_HOST_RECORD;

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
