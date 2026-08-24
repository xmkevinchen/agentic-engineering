// Executes the policy materialization corpus and the activation/replay split.
//
// The split under test: materializing policy bytes into a project is one
// decision; deciding which activation base bundle a NEW candidate may bind is a
// different one. A project keeps old bundles so it can replay history — never so
// a new candidate can pick one.

import {
  cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { sealVerifiedActiveRelease } from '../lib/active-release.mjs';
import { canonicalize, canonicalDigest, digestBytes } from '../lib/canonical-json.mjs';
import {
  bundleProjectRef, candidateEpochStatus, materializePolicies, policyEpoch,
  replayFromLocalSnapshots, selectActivationBaseBundle, verifyBundleSources,
} from '../lib/policy-bundle.mjs';
import { Checks } from './harness.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const FIXTURE = join(HERE, '..', '..', 'fixtures', 'v1-foundation', 'policy-bundle');

const PROJECT_FILES = [
  '.ae/policies/runner-v1.json',
  '.ae/policies/adapters-v1.json',
  '.ae/policies/floors/code-regression-v1.json',
];

export function run() {
  const checks = new Checks('policy-bundle');
  const index = JSON.parse(readFileSync(join(FIXTURE, 'index.json'), 'utf8'));
  const work = mkdtempSync(join(tmpdir(), 'ae-policy-'));

  try {
    // Plugin trees are copied into the workspace so one case can delete the
    // plugin outright and still expect replay to work.
    const pluginA = join(work, 'plugin-a');
    const pluginB = join(work, 'plugin-b');
    const pluginBad = join(work, 'plugin-c-bad');
    cpSync(join(FIXTURE, 'release-a'), pluginA, { recursive: true });
    cpSync(join(FIXTURE, 'release-b'), pluginB, { recursive: true });
    cpSync(join(FIXTURE, 'release-c-bad'), pluginBad, { recursive: true });

    const digestA = index.trees['release-a'].bundle_digest;
    const digestB = index.trees['release-b'].bundle_digest;

    checks.equal('bundle-digest-a', verifyBundleSources(pluginA).bundleDigest, digestA);
    checks.equal('bundle-digest-b', verifyBundleSources(pluginB).bundleDigest, digestB);

    // ---- materialization --------------------------------------------------
    const project = join(work, 'project');
    mkdirSync(project, { recursive: true });

    const first = materializePolicies({ pluginRoot: pluginA, projectRoot: project });
    checks.equal('materialize/fresh-write-count', first.written.length, 4);
    checks.equal('materialize/fresh-unchanged-count', first.unchanged.length, 0);
    for (const ref of PROJECT_FILES) {
      checks.ok(`materialize/wrote/${ref}`, first.written.includes(ref));
    }
    // The bundle manifest lands at a content-addressed path so a later bundle
    // cannot collide with it.
    checks.ok('materialize/bundle-content-addressed',
      first.bundle_project_ref === `.ae/policies/bundles/${digestA.replace('sha256:', '')}.json`);

    // Bytes are copied verbatim, not re-serialized.
    for (const entry of verifyBundleSources(pluginA).bundle.entries) {
      checks.equalBytes(`materialize/byte-for-byte/${entry.project_ref}`,
        readFileSync(join(project, entry.project_ref)),
        readFileSync(join(pluginA, entry.plugin_source)));
    }

    // ---- idempotence ------------------------------------------------------
    const again = materializePolicies({ pluginRoot: pluginA, projectRoot: project });
    checks.equal('materialize/idempotent-writes', again.written.length, 0);
    checks.equal('materialize/idempotent-unchanged', again.unchanged.length, 4);

    // ---- a legitimate upgrade: new content at a NEW versioned path ---------
    const upgraded = materializePolicies({ pluginRoot: pluginB, projectRoot: project });
    checks.ok('upgrade/new-versioned-path-written',
      upgraded.written.includes('.ae/policies/runner-v2.json'));
    checks.ok('upgrade/retained-files-unchanged',
      PROJECT_FILES.every((ref) => upgraded.unchanged.includes(ref)));
    checks.ok('upgrade/new-bundle-written',
      upgraded.written.includes(`.ae/policies/bundles/${digestB.replace('sha256:', '')}.json`));
    // The old bundle survives the upgrade; that is what makes replay possible.
    checks.accepts('upgrade/old-bundle-retained',
      () => readFileSync(join(project, `.ae/policies/bundles/${digestA.replace('sha256:', '')}.json`)));

    // ---- an illegitimate upgrade: same path, different bytes --------------
    checks.rejects('upgrade/same-path-different-bytes',
      () => materializePolicies({ pluginRoot: pluginBad, projectRoot: project }),
      'integrity_error');
    // ...and it changed nothing on the way to failing.
    checks.equalBytes('upgrade/rejected-leaves-bytes-intact',
      readFileSync(join(project, '.ae/policies/runner-v1.json')),
      readFileSync(join(pluginA, 'policies/runner-v1.json')));

    // ---- bundle source integrity -----------------------------------------
    const tampered = join(work, 'plugin-tampered');
    cpSync(join(FIXTURE, 'release-a'), tampered, { recursive: true });
    writeFileSync(join(tampered, 'policies/runner-v1.json'), '{"schema_version":"ae.runner-policy.v1"}');
    checks.rejects('bundle/source-tampered',
      () => verifyBundleSources(tampered), 'bundle_source_digest_mismatch');

    const truncated = join(work, 'plugin-truncated');
    cpSync(join(FIXTURE, 'release-a'), truncated, { recursive: true });
    rmSync(join(truncated, 'policies/adapters-v1.json'));
    checks.rejects('bundle/source-missing',
      () => verifyBundleSources(truncated), 'bundle_source_missing');

    // ---- project ref escapes ---------------------------------------------
    for (const [label, badRef] of [
      ['dotdot', '../outside.json'],
      ['absolute', '/etc/hosts'],
      ['outside-policy-root', '.ae/features/active/F-100/injected.json'],
    ]) {
      const escaping = join(work, `plugin-escape-${label}`);
      cpSync(join(FIXTURE, 'release-a'), escaping, { recursive: true });
      const bundle = JSON.parse(readFileSync(join(escaping, 'policies/bundle-v1.json'), 'utf8'));
      bundle.entries[0].project_ref = badRef;
      writeFileSync(join(escaping, 'policies/bundle-v1.json'), canonicalize(bundle));
      checks.rejects(`bundle/ref-escape/${label}`,
        () => verifyBundleSources(escaping), 'ref_escapes_project_root');
    }

    for (const [label, badRef, code] of [
      ['dot-component', '.ae/policies/./runner-v1.json', 'ref_non_canonical'],
      ['empty-component', '.ae/policies//runner-v1.json', 'ref_non_canonical'],
      ['empty-ref', '', 'ref_non_canonical'],
    ]) {
      const escaping = join(work, `plugin-noncanonical-${label}`);
      cpSync(join(FIXTURE, 'release-a'), escaping, { recursive: true });
      const bundle = JSON.parse(readFileSync(join(escaping, 'policies/bundle-v1.json'), 'utf8'));
      bundle.entries[0].project_ref = badRef;
      writeFileSync(join(escaping, 'policies/bundle-v1.json'), canonicalize(bundle));
      checks.rejects(`bundle/ref-non-canonical/${label}`, () => verifyBundleSources(escaping), code);
    }

    // ---- plugin_source escapes -------------------------------------------
    // Previously unchecked: a bundle could name bytes outside the installed
    // plugin root and have them materialized as policy, provided the digest matched.
    for (const [label, badSource, code] of [
      ['dotdot', '../../../etc/hosts', 'plugin_source_escapes_plugin_root'],
      ['absolute', '/etc/hosts', 'plugin_source_escapes_plugin_root'],
      ['dot-component', 'policies/./runner-v1.json', 'ref_non_canonical'],
    ]) {
      const escaping = join(work, `plugin-source-escape-${label}`);
      cpSync(join(FIXTURE, 'release-a'), escaping, { recursive: true });
      const bundle = JSON.parse(readFileSync(join(escaping, 'policies/bundle-v1.json'), 'utf8'));
      bundle.entries[0].plugin_source = badSource;
      writeFileSync(join(escaping, 'policies/bundle-v1.json'), canonicalize(bundle));
      checks.rejects(`bundle/plugin-source-escape/${label}`, () => verifyBundleSources(escaping), code);
    }

    // A symlinked plugin source is refused even though it resolves inside the
    // plugin root lexically.
    const linkedPlugin = join(work, 'plugin-symlinked-source');
    cpSync(join(FIXTURE, 'release-a'), linkedPlugin, { recursive: true });
    {
      const realTarget = join(work, 'outside-source.json');
      writeFileSync(realTarget, readFileSync(join(linkedPlugin, 'policies/runner-v1.json')));
      rmSync(join(linkedPlugin, 'policies/runner-v1.json'));
      symlinkSync(realTarget, join(linkedPlugin, 'policies/runner-v1.json'));
      checks.rejects('bundle/plugin-source-symlink',
        () => verifyBundleSources(linkedPlugin), 'ref_symlink_component');
    }

    // ---- materialization never writes through a symlink -------------------
    // `.ae/policies` pointing outside the project passes every lexical test and
    // still lands the bytes elsewhere. This is the case that motivated moving the
    // write onto an explicit no-replace boundary.
    const escapeProject = join(work, 'project-symlink-escape');
    const escapeTarget = join(work, 'outside-project');
    mkdirSync(join(escapeProject, '.ae'), { recursive: true });
    mkdirSync(escapeTarget, { recursive: true });
    symlinkSync(escapeTarget, join(escapeProject, '.ae/policies'));
    checks.rejects('materialize/symlinked-policy-root',
      () => materializePolicies({ pluginRoot: pluginA, projectRoot: escapeProject }),
      'ref_symlink_component');
    checks.equal('materialize/symlinked-policy-root-wrote-nothing',
      readdirSync(escapeTarget).length, 0);

    // ...and the same for a symlink deeper in the path.
    const deepEscape = join(work, 'project-deep-symlink');
    const deepTarget = join(work, 'outside-floors');
    mkdirSync(join(deepEscape, '.ae/policies'), { recursive: true });
    mkdirSync(deepTarget, { recursive: true });
    symlinkSync(deepTarget, join(deepEscape, '.ae/policies/floors'));
    checks.rejects('materialize/symlinked-subdirectory',
      () => materializePolicies({ pluginRoot: pluginA, projectRoot: deepEscape }),
      'ref_symlink_component');
    checks.equal('materialize/symlinked-subdirectory-wrote-nothing',
      readdirSync(deepTarget).length, 0);
    // Destinations are validated before any byte is written, so the entries that
    // would have succeeded are absent too.
    checks.equal('materialize/rejection-is-all-or-nothing',
      existsSync(join(deepEscape, '.ae/policies/runner-v1.json')), false);

    // A symlink standing where a policy file belongs is refused rather than
    // followed, even when the target's bytes would have compared equal.
    const linkedFile = join(work, 'project-symlinked-file');
    mkdirSync(join(linkedFile, '.ae/policies'), { recursive: true });
    const decoy = join(work, 'decoy-runner-v1.json');
    writeFileSync(decoy, readFileSync(join(pluginA, 'policies/runner-v1.json')));
    symlinkSync(decoy, join(linkedFile, '.ae/policies/runner-v1.json'));
    checks.rejects('materialize/symlink-in-place-of-policy-file',
      () => materializePolicies({ pluginRoot: pluginA, projectRoot: linkedFile }),
      'ref_symlink_component');

    // ---- base bundle selection for a NEW candidate ------------------------
    // The active release is B. A is still on disk, for replay only.
    const activeReleaseManifest = {
      schema_version: 'ae.release-manifest.v1',
      release_id: 'ae-gate-fixture',
      activation_base_bundle_digest: digestB,
    };
    const rootIdentity = '/fixture/active/root';
    const attestation = {
      active_release_manifest_digest: canonicalDigest(activeReleaseManifest),
      active_root_identity: rootIdentity,
    };
    const verifiedActiveRelease = sealVerifiedActiveRelease({
      manifest: activeReleaseManifest,
      attestation,
      rootIdentity,
      bootstrapResultDigest: `sha256:${'8'.repeat(64)}`,
    });
    const retained = [digestA, digestB];

    checks.accepts('select/current-singleton', () => selectActivationBaseBundle({
      verifiedActiveRelease, requestedBaseBundleDigest: digestB, retainedHistoricalBundleDigests: retained,
    }));

    checks.rejects('select/old-retained-bundle-downgrade', () => selectActivationBaseBundle({
      verifiedActiveRelease, requestedBaseBundleDigest: digestA, retainedHistoricalBundleDigests: retained,
    }), 'base_bundle_not_current');

    checks.rejects('select/unknown-bundle', () => selectActivationBaseBundle({
      verifiedActiveRelease,
      requestedBaseBundleDigest: `sha256:${'9'.repeat(64)}`,
      retainedHistoricalBundleDigests: retained,
    }), 'base_bundle_not_current');

    // Nothing that is merely *shaped* like a verified active release can select
    // the current one. In particular there is no default: omitting the argument
    // must fail closed rather than fall through to an authoritative branch.
    const impostors = [
      ['omitted', undefined],
      ['null', null],
      ['plain-manifest-object', activeReleaseManifest],
      ['structurally-perfect-literal', {
        schema_version: 'ae.verified-active-release.v1',
        release_manifest_digest: canonicalDigest(activeReleaseManifest),
        activation_base_bundle_digest: digestB,
        root_identity: rootIdentity,
        bootstrap_result_digest: `sha256:${'8'.repeat(64)}`,
      }],
      ['shallow-copy-of-a-sealed-value', { ...verifiedActiveRelease }],
      ['string-naming-the-source', 'verified_active_release'],
    ];
    for (const [label, impostor] of impostors) {
      checks.rejects(`select/not-selectable-by/${label}`, () => selectActivationBaseBundle({
        verifiedActiveRelease: impostor,
        requestedBaseBundleDigest: digestB,
        retainedHistoricalBundleDigests: retained,
      }), 'current_release_not_selectable_by_declaration');
    }

    // Sealing is itself checked, so a caller cannot mint the sealed value from
    // mismatched parts.
    checks.rejects('seal/manifest-does-not-match-attested-digest', () => sealVerifiedActiveRelease({
      manifest: { ...activeReleaseManifest, release_id: 'other' },
      attestation,
      rootIdentity,
      bootstrapResultDigest: `sha256:${'8'.repeat(64)}`,
    }), 'current_release_not_selectable_by_declaration');
    checks.rejects('seal/root-identity-does-not-match', () => sealVerifiedActiveRelease({
      manifest: activeReleaseManifest,
      attestation,
      rootIdentity: '/somewhere/else',
      bootstrapResultDigest: `sha256:${'8'.repeat(64)}`,
    }), 'current_release_not_selectable_by_declaration');
    checks.rejects('seal/no-bootstrap-result', () => sealVerifiedActiveRelease({
      manifest: activeReleaseManifest, attestation, rootIdentity, bootstrapResultDigest: '',
    }), 'current_release_not_selectable_by_declaration');

    // ---- policy epoch staleness ------------------------------------------
    const epochOld = policyEpoch({
      releaseManifestDigest: `sha256:${'a'.repeat(64)}`, activationBaseBundleDigest: digestA,
    });
    const epochNew = policyEpoch({
      releaseManifestDigest: `sha256:${'b'.repeat(64)}`, activationBaseBundleDigest: digestB,
    });
    checks.notEqual('epoch/differs-across-releases', epochOld, epochNew);

    checks.equal('epoch/current-candidate',
      candidateEpochStatus({ candidate: { activated: false, policy_epoch: epochNew }, currentEpoch: epochNew }).status,
      'current');
    checks.equal('epoch/unactivated-candidate-goes-stale',
      candidateEpochStatus({ candidate: { activated: false, policy_epoch: epochOld }, currentEpoch: epochNew }).status,
      'policy_epoch_stale');

    // A current-release change does not reach back into an existing activation.
    const activatedStatus = candidateEpochStatus({
      candidate: { activated: true, policy_epoch: epochOld }, currentEpoch: epochNew,
    });
    checks.equal('epoch/activation-unaffected', activatedStatus.status, 'activated');
    checks.equal('epoch/activation-not-rewritten', activatedStatus.rewritten, false);
    checks.equal('epoch/activation-keeps-its-epoch', activatedStatus.epoch, epochOld);

    // ---- historical replay from local snapshots ---------------------------
    const activation = {
      activation_base_bundle_digest: digestA,
      policy_epoch: epochOld,
      policy_snapshots: PROJECT_FILES.map((ref) => ({
        project_ref: ref,
        raw_digest: digestBytes(readFileSync(join(project, ref))),
      })),
    };

    const replayed = checks.accepts('replay/with-plugin-present',
      () => replayFromLocalSnapshots({ projectRoot: project, activation }));

    // The point of the split: delete every installed plugin tree and replay again.
    rmSync(pluginA, { recursive: true, force: true });
    rmSync(pluginB, { recursive: true, force: true });
    rmSync(pluginBad, { recursive: true, force: true });
    const replayedWithoutPlugin = checks.accepts('replay/with-plugin-removed',
      () => replayFromLocalSnapshots({ projectRoot: project, activation }));
    checks.equal('replay/identical-without-plugin',
      replayedWithoutPlugin?.effective_digest, replayed?.effective_digest);

    // ---- local snapshot failures fail closed ------------------------------
    const tamperedProject = join(work, 'project-tampered');
    cpSync(project, tamperedProject, { recursive: true });
    writeFileSync(join(tamperedProject, '.ae/policies/runner-v1.json'), '{"schema_version":"tampered"}');
    checks.rejects('replay/local-snapshot-tampered',
      () => replayFromLocalSnapshots({ projectRoot: tamperedProject, activation }), 'snapshot_tampered');

    const missingProject = join(work, 'project-missing');
    cpSync(project, missingProject, { recursive: true });
    rmSync(join(missingProject, '.ae/policies/floors/code-regression-v1.json'));
    checks.rejects('replay/local-snapshot-missing',
      () => replayFromLocalSnapshots({ projectRoot: missingProject, activation }), 'snapshot_missing');

    checks.equal('bundle-project-ref-is-pure',
      bundleProjectRef(Buffer.from('abc')), bundleProjectRef(Buffer.from('abc')));

    return checks;
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { report } = await import('./harness.mjs');
  process.exit(report([run()], { verbose: process.argv.includes('--verbose') }) === 0 ? 0 : 1);
}
