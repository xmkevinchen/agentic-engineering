// Executes the policy materialization corpus and the activation/replay split.
//
// The split under test: materializing policy bytes into a project is one
// decision; deciding which activation base bundle a NEW candidate may bind is a
// different one. A project keeps old bundles so it can replay history — never so
// a new candidate can pick one.

import {
  cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync,
} from 'node:fs';
import { writeSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { sealVerifiedActiveRelease } from '../lib/active-release.mjs';
import { observeActiveRoot, verifyBootstrap } from '../lib/active-release-provider.mjs';
import { buildRelease } from '../lib/release-build.mjs';
import { canonicalize, canonicalDigest, digestBytes } from '../lib/canonical-json.mjs';
import {
  bundleProjectRef, candidateEpochStatus, materializePolicies, policyEpoch,
  replayFromLocalSnapshots, selectActivationBaseBundle, verifyBundleSources,
} from '../lib/policy-bundle.mjs';
import { NoReplaceError, atomicFileNoReplace } from '../lib/fs-noreplace.mjs';
import { isDeeplyFrozen } from '../lib/freeze.mjs';
import { Checks } from './harness.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const FIXTURE = join(HERE, '..', '..', 'fixtures', 'v1-foundation', 'policy-bundle');
const FLOOR = JSON.parse(readFileSync(
  join(HERE, '..', '..', 'fixtures', 'v1-foundation', 'coverage-floor.json'), 'utf8',
)).min_corpus_sizes;


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

    checks.ok('floor/policy-trees',
      Object.keys(index.trees).length >= FLOOR.policy_bundle_trees,
      `${Object.keys(index.trees).length} trees, floor is ${FLOOR.policy_bundle_trees}`);
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

    // ---- duplicate destinations -------------------------------------------
    //
    // Two entries naming one destination is a malformed bundle, not a race to be
    // won by whichever is written first. Both are rejected before any filesystem
    // mutation, so nothing is left behind.
    for (const [label, mutate] of [
      ['different-bytes', (bundle) => {
        bundle.entries[1].project_ref = bundle.entries[0].project_ref;
      }],
      ['identical-bytes', (bundle) => {
        bundle.entries.push({ ...bundle.entries[0] });
      }],
    ]) {
      const dupPlugin = join(work, `plugin-duplicate-${label}`);
      cpSync(join(FIXTURE, 'release-a'), dupPlugin, { recursive: true });
      const dupBundle = JSON.parse(readFileSync(join(dupPlugin, 'policies/bundle-v1.json'), 'utf8'));
      mutate(dupBundle);
      writeFileSync(join(dupPlugin, 'policies/bundle-v1.json'), canonicalize(dupBundle));

      checks.rejects(`duplicate-destination/${label}/verify`,
        () => verifyBundleSources(dupPlugin), 'duplicate_project_ref');

      const dupProject = join(work, `project-duplicate-${label}`);
      mkdirSync(dupProject, { recursive: true });
      checks.rejects(`duplicate-destination/${label}/materialize`,
        () => materializePolicies({ pluginRoot: dupPlugin, projectRoot: dupProject }),
        'duplicate_project_ref');
      checks.equal(`duplicate-destination/${label}/created-nothing`,
        existsSync(join(dupProject, '.ae/policies'))
          ? readdirSync(join(dupProject, '.ae/policies')).length : 0,
        0);
    }

    // Distinct ref strings that name one file on a case-insensitive volume get
    // past the entry-level uniqueness check and are caught on the resolved path.
    {
      const casePlugin = join(work, 'plugin-case-collision');
      cpSync(join(FIXTURE, 'release-a'), casePlugin, { recursive: true });
      const caseBundle = JSON.parse(readFileSync(join(casePlugin, 'policies/bundle-v1.json'), 'utf8'));
      caseBundle.entries[1].project_ref = '.ae/policies/RUNNER-V1.json';
      writeFileSync(join(casePlugin, 'policies/bundle-v1.json'), canonicalize(caseBundle));
      const caseProject = join(work, 'project-case-collision');
      mkdirSync(caseProject, { recursive: true });

      const probe = join(work, 'CaseProbe');
      writeFileSync(probe, 'probe');
      let caseInsensitive = false;
      try { readFileSync(join(work, 'caseprobe')); caseInsensitive = true; } catch { /* case-sensitive */ }

      if (!caseInsensitive) {
        checks.skip('duplicate-destination/case-collision',
          'filesystem is case-sensitive; these refs are genuinely two files here');
      } else {
        checks.rejects('duplicate-destination/case-collision',
          () => materializePolicies({ pluginRoot: casePlugin, projectRoot: caseProject }),
          'duplicate_project_ref');
        checks.equal('duplicate-destination/case-collision/created-nothing',
          existsSync(join(caseProject, '.ae/policies'))
            ? readdirSync(join(caseProject, '.ae/policies')).length : 0,
          0);
      }
    }

    // ---- the no-replace boundary itself ------------------------------------
    const writeProbe = join(work, 'noreplace-probe');
    mkdirSync(writeProbe, { recursive: true });

    const created = atomicFileNoReplace({ path: join(writeProbe, 'a.json'), bytes: Buffer.from('{"a":1}') });
    checks.equal('noreplace/first-write-creates', created.outcome, 'created');
    const second = atomicFileNoReplace({ path: join(writeProbe, 'a.json'), bytes: Buffer.from('{"a":2}') });
    checks.equal('noreplace/second-write-does-not-clobber', second.outcome, 'exists');
    checks.equalBytes('noreplace/original-bytes-intact',
      readFileSync(join(writeProbe, 'a.json')), Buffer.from('{"a":1}'));

    // A short write must not fsync and report success over a truncated file. The
    // write syscall is injected so the partial-write path is deterministic rather
    // than dependent on hitting a real pipe boundary.
    const payload = Buffer.from('{"long":"' + 'x'.repeat(200) + '"}');
    let shortWriteCalls = 0;
    const shortPath = join(writeProbe, 'short.json');
    const shortResult = atomicFileNoReplace({
      path: shortPath,
      bytes: payload,
      // Writes at most 7 bytes per call, as a real short write would.
      write: (fd, buf, offset, length, position) => {
        shortWriteCalls += 1;
        return writeSync(fd, buf, offset, Math.min(7, length), position);
      },
    });
    checks.equal('noreplace/short-write-completes', shortResult.outcome, 'created');
    checks.ok('noreplace/short-write-looped', shortWriteCalls > 1, `${shortWriteCalls} write calls`);
    checks.equalBytes('noreplace/short-write-is-byte-for-byte', readFileSync(shortPath), payload);

    // fs-noreplace's own symlink and non-regular-file branches. Through
    // materializePolicies these are unreachable — the component walk refuses first
    // — so the boundary is exercised directly or not at all.
    {
      const decoyTarget = join(writeProbe, 'decoy-target.json');
      writeFileSync(decoyTarget, Buffer.from('{"a":1}'));
      const linkPath = join(writeProbe, 'linked.json');
      symlinkSync(decoyTarget, linkPath);
      let linkCode = null;
      try {
        atomicFileNoReplace({ path: linkPath, bytes: Buffer.from('{"a":1}') });
      } catch (error) {
        linkCode = error instanceof NoReplaceError ? error.code : error.name;
      }
      // Note the bytes match the link target exactly: without the lstat the read
      // would follow the link, compare equal, and report a benign 'exists'.
      checks.equal('noreplace/symlink-at-destination', linkCode, 'ref_symlink_component');

      const danglingPath = join(writeProbe, 'dangling.json');
      symlinkSync(join(writeProbe, 'nothing-here.json'), danglingPath);
      let danglingCode = null;
      try {
        atomicFileNoReplace({ path: danglingPath, bytes: Buffer.from('{"a":1}') });
      } catch (error) {
        danglingCode = error instanceof NoReplaceError ? error.code : error.name;
      }
      checks.equal('noreplace/dangling-symlink-at-destination', danglingCode, 'ref_symlink_component');

      const dirPath = join(writeProbe, 'a-directory');
      mkdirSync(dirPath, { recursive: true });
      let dirCode = null;
      try {
        atomicFileNoReplace({ path: dirPath, bytes: Buffer.from('{"a":1}') });
      } catch (error) {
        dirCode = error instanceof NoReplaceError ? error.code : error.name;
      }
      checks.equal('noreplace/directory-at-destination', dirCode, 'integrity_error');
    }

    // A write that makes no progress fails rather than silently truncating.
    let stalledCode = null;
    try {
      atomicFileNoReplace({
        path: join(writeProbe, 'stalled.json'),
        bytes: payload,
        write: () => 0,
      });
    } catch (error) {
      stalledCode = error instanceof NoReplaceError ? error.code : error.name;
    }
    checks.equal('noreplace/stalled-write-fails', stalledCode, 'short_write');

    // ---- base bundle selection for a NEW candidate ------------------------
    //
    // The verified-active-release value is produced from a REAL installed release
    // and a real host record. Nothing about it is asserted by this test.
    const releaseRoot = join(work, 'installed-release');
    const built = buildRelease({
      releaseRoot,
      policySourceDir: join(FIXTURE, 'release-b'),
    });
    const hostRecordPath = join(work, 'host-record.json');
    writeFileSync(hostRecordPath, JSON.stringify({ active_root: releaseRoot }));

    const attestation = observeActiveRoot({ hostRecordPath });
    const bootstrapResult = verifyBootstrap({ releaseRoot });
    const verifiedActiveRelease = sealVerifiedActiveRelease({ attestation, bootstrapResult });

    // The provider derived the digest from the release on disk; it was never told.
    checks.equal('provider/derives-manifest-digest',
      attestation.active_release_manifest_digest, built.manifestDigest);
    checks.equal('provider/derives-activation-base',
      verifiedActiveRelease.activation_base_bundle_digest, digestB);
    // A lying digest in the host record changes nothing, because it is not read.
    writeFileSync(hostRecordPath, JSON.stringify({
      active_root: releaseRoot,
      active_release_manifest_digest: `sha256:${'e'.repeat(64)}`,
    }));
    checks.equal('provider/ignores-host-record-digest',
      observeActiveRoot({ hostRecordPath }).active_release_manifest_digest, built.manifestDigest);

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

    // ---- a brand certifies identity, not content -------------------------
    checks.ok('immutability/attestation-is-deeply-frozen', isDeeplyFrozen(attestation));
    checks.ok('immutability/bootstrap-result-is-deeply-frozen', isDeeplyFrozen(bootstrapResult));
    checks.ok('immutability/sealed-value-is-deeply-frozen', isDeeplyFrozen(verifiedActiveRelease));

    // The nested manifest is the one that matters: rewriting it in place would
    // change which bundle the sealed value names while the brand survived.
    for (const [label, mutate] of [
      ['manifest-activation-base', () => {
        bootstrapResult.manifest.activation_base_bundle_digest = `sha256:${'d'.repeat(64)}`;
      }],
      ['manifest-members', () => { bootstrapResult.manifest.members.length = 0; }],
      ['attestation-root-identity', () => { attestation.active_root_identity = '/elsewhere'; }],
      ['attestation-digest', () => {
        attestation.active_release_manifest_digest = `sha256:${'d'.repeat(64)}`;
      }],
      ['sealed-base-digest', () => {
        verifiedActiveRelease.activation_base_bundle_digest = `sha256:${'d'.repeat(64)}`;
      }],
    ]) {
      let blocked = false;
      try { mutate(); } catch { blocked = true; }
      checks.ok(`immutability/rejects-in-place-mutation/${label}`, blocked);
    }
    // Re-sealing after the attempted mutations still names the real bundle.
    checks.equal('immutability/sealed-value-still-names-the-real-bundle',
      sealVerifiedActiveRelease({ attestation, bootstrapResult }).activation_base_bundle_digest,
      digestB);

    // ---- the activation base must BE a verified member --------------------
    //
    // The launcher enforces this at step 7b. lib/ is the code slated for promotion
    // into plugins/ae/runtime/, so it needs the same invariant, not a weaker one.
    for (const [label, transform, code] of [
      ['digest-names-no-member',
        (m) => ({ ...m, activation_base_bundle_digest: `sha256:${'c'.repeat(64)}` }),
        'activation_base_member_mismatch'],
      ['ref-names-no-member',
        (m) => ({ ...m, activation_base_bundle_ref: 'policies/not-installed.json' }),
        'activation_base_member_mismatch'],
      ['ref-names-a-non-policy-member',
        (m) => ({
          ...m,
          activation_base_bundle_ref: 'schemas/release-manifest-v1.schema.json',
          activation_base_bundle_digest:
            m.members.find((x) => x.ref === 'schemas/release-manifest-v1.schema.json').raw_digest,
        }),
        'activation_base_member_mismatch'],
    ]) {
      const ungrounded = join(work, `release-ungrounded-${label}`);
      buildRelease({
        releaseRoot: ungrounded,
        policySourceDir: join(FIXTURE, 'release-a'),
        transformManifest: transform,
      });
      checks.rejects(`activation-base/${label}`,
        () => verifyBootstrap({ releaseRoot: ungrounded }), code);
    }

    // A directory holding a manifest and matching members is not yet a release:
    // the release's own launcher has to have been built against this manifest.
    {
      const unbound = join(work, 'release-unbound-launcher');
      buildRelease({ releaseRoot: unbound, policySourceDir: join(FIXTURE, 'release-a') });
      rmSync(join(unbound, 'runtime/ae-gate.mjs'));
      checks.rejects('activation-base/no-launcher',
        () => verifyBootstrap({ releaseRoot: unbound }), 'release_launcher_not_bound');
    }
    {
      const crossed = join(work, 'release-crossed-launcher');
      buildRelease({ releaseRoot: crossed, policySourceDir: join(FIXTURE, 'release-a') });
      const other = join(work, 'release-launcher-donor');
      const donor = buildRelease({
        releaseRoot: other, policySourceDir: join(FIXTURE, 'release-a'), releaseVersion: '3.0.0',
      });
      cpSync(donor.launcherPath, join(crossed, 'runtime/ae-gate.mjs'), { force: true });
      checks.rejects('activation-base/launcher-from-another-release',
        () => verifyBootstrap({ releaseRoot: crossed }), 'release_launcher_not_bound');
    }

    // ---- self-declaration cannot become verification ----------------------
    //
    // Every public surface on the selection path is called with fully
    // self-consistent plain objects: an attestation and a bootstrap result that
    // agree with each other and with a manifest the caller wrote. Internal
    // consistency is not provenance.
    const inventedManifest = {
      schema_version: 'ae.release-manifest.v1',
      release_id: 'invented',
      activation_base_bundle_digest: `sha256:${'a'.repeat(64)}`,
    };
    const inventedDigest = canonicalDigest(inventedManifest);
    const plainAttestation = {
      schema_version: 'ae.active-release-attestation.v1',
      fixture_only: true,
      active_root_identity: '/entirely/made/up',
      active_release_manifest_digest: inventedDigest,
      provider_build: 'fixture-active-release-provider-v1',
    };
    const plainBootstrap = {
      schema_version: 'ae.bootstrap-result.v1',
      fixture_only: true,
      manifest: inventedManifest,
      manifest_digest: inventedDigest,
      root_identity: '/entirely/made/up',
      member_count: 0,
      bootstrapResultDigest: `sha256:${'b'.repeat(64)}`,
      bootstrap_result_digest: `sha256:${'b'.repeat(64)}`,
    };

    checks.rejects('seal/plain-attestation', () => sealVerifiedActiveRelease({
      attestation: plainAttestation, bootstrapResult,
    }), 'attestation_not_observed');

    checks.rejects('seal/plain-bootstrap-result', () => sealVerifiedActiveRelease({
      attestation, bootstrapResult: plainBootstrap,
    }), 'bootstrap_result_not_derived');

    checks.rejects('seal/both-plain-and-fully-consistent', () => sealVerifiedActiveRelease({
      attestation: plainAttestation, bootstrapResult: plainBootstrap,
    }), 'attestation_not_observed');

    // A shallow copy of a genuine value is not the value.
    checks.rejects('seal/copied-attestation', () => sealVerifiedActiveRelease({
      attestation: { ...attestation }, bootstrapResult,
    }), 'attestation_not_observed');
    checks.rejects('seal/copied-bootstrap-result', () => sealVerifiedActiveRelease({
      attestation, bootstrapResult: { ...bootstrapResult },
    }), 'bootstrap_result_not_derived');

    // Genuine values that describe different releases still do not seal.
    const otherReleaseRoot = join(work, 'other-release');
    buildRelease({
      releaseRoot: otherReleaseRoot,
      policySourceDir: join(FIXTURE, 'release-a'),
      releaseVersion: '2.0.0',
    });
    checks.rejects('seal/attestation-and-bootstrap-disagree', () => sealVerifiedActiveRelease({
      attestation, bootstrapResult: verifyBootstrap({ releaseRoot: otherReleaseRoot }),
    }), 'current_release_not_selectable_by_declaration');

    // The provider will not derive a bootstrap result for a release whose bytes
    // do not match its manifest, so one cannot be earned for a tampered tree.
    const tamperedRelease = join(work, 'tampered-release');
    buildRelease({ releaseRoot: tamperedRelease, policySourceDir: join(FIXTURE, 'release-a') });
    writeFileSync(join(tamperedRelease, 'policies/runner-v1.json'), '{"tampered":true}');
    checks.rejects('provider/refuses-tampered-release',
      () => verifyBootstrap({ releaseRoot: tamperedRelease }), 'bootstrap_result_not_derived');

    // An installed manifest that is not in canonical form: its raw bytes and its
    // authoritative digest would disagree, so nothing downstream is stable.
    {
      const nonCanonical = join(work, 'release-non-canonical-manifest');
      const nc = buildRelease({ releaseRoot: nonCanonical, policySourceDir: join(FIXTURE, 'release-a') });
      writeFileSync(
        join(nonCanonical, 'release-manifest-v1.json'),
        Buffer.from(`${JSON.stringify(nc.manifest, null, 2)}\n`, 'utf8'),
      );
      checks.rejects('provider/refuses-non-canonical-manifest',
        () => verifyBootstrap({ releaseRoot: nonCanonical }), 'active_release_unavailable');
    }

    // ...and not for a root the host does not resolve.
    writeFileSync(hostRecordPath, JSON.stringify({ active_root: join(work, 'no-such-root') }));
    checks.rejects('provider/refuses-unresolvable-root',
      () => observeActiveRoot({ hostRecordPath }), 'active_release_unavailable');

    // Nothing that is merely *shaped* like a sealed value can select the current
    // release either. In particular there is no default: omitting the argument must
    // fail closed rather than fall through to an authoritative branch.
    const impostors = [
      ['omitted', undefined],
      ['null', null],
      ['plain-manifest-object', inventedManifest],
      ['structurally-perfect-literal', {
        schema_version: 'ae.verified-active-release.v1',
        release_manifest_digest: built.manifestDigest,
        activation_base_bundle_digest: digestB,
        root_identity: releaseRoot,
        bootstrap_result_digest: bootstrapResult.bootstrap_result_digest,
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

    // ---- policy epoch staleness ------------------------------------------
    const epochOld = policyEpoch({
      releaseManifestDigest: `sha256:${'a'.repeat(64)}`, activationBaseBundleDigest: digestA,
    });
    const epochNew = policyEpoch({
      releaseManifestDigest: `sha256:${'b'.repeat(64)}`, activationBaseBundleDigest: digestB,
    });
    checks.notEqual('epoch/differs-across-releases', epochOld, epochNew);

    checks.equal('epoch/current-candidate',
      candidateEpochStatus({ declaredCandidateState: { activated: false, policy_epoch: epochNew }, currentEpoch: epochNew }).status,
      'current');
    checks.equal('epoch/unactivated-candidate-goes-stale',
      candidateEpochStatus({ declaredCandidateState: { activated: false, policy_epoch: epochOld }, currentEpoch: epochNew }).status,
      'policy_epoch_stale');

    // A current-release change does not reach back into an existing activation.
    const activatedStatus = candidateEpochStatus({
      declaredCandidateState: { activated: true, policy_epoch: epochOld }, currentEpoch: epochNew,
    });
    checks.equal('epoch/activation-unaffected', activatedStatus.status, 'activated');
    checks.equal('epoch/activation-not-rewritten', activatedStatus.rewritten, false);
    checks.equal('epoch/activation-keeps-its-epoch', activatedStatus.epoch, epochOld);

    // Stated limitation, asserted so it cannot be mistaken for a guarantee:
    // candidateEpochStatus classifies caller-declared activation state and does
    // NOT establish it. Everywhere else a caller-set boolean is refused; here it
    // is accepted because the Ledger that establishes activation is P1's, and
    // this function decides nothing about whether the claim is true.
    checks.equal('epoch/classifies-declared-state-without-verifying-it',
      candidateEpochStatus({
        declaredCandidateState: { activated: true, policy_epoch: 'not-a-real-epoch' },
        currentEpoch: epochNew,
      }).status,
      'activated');
    checks.ok('epoch/is-not-a-provenance-boundary',
      typeof candidateEpochStatus === 'function',
      'documented in v1-foundation-freeze.md: P1 owns establishing activation');

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

    // Content-addressed, so different bytes must land at different paths and the
    // same bytes at the same one. Comparing one call against another call with the
    // same input only restates that the function is deterministic.
    checks.notEqual('bundle-project-ref/differs-for-different-bytes',
      bundleProjectRef(Buffer.from('abc')), bundleProjectRef(Buffer.from('abd')));
    checks.equal('bundle-project-ref/is-content-addressed',
      bundleProjectRef(canonicalize({ schema_version: 'ae.policy-bundle.v1' })),
      `.ae/policies/bundles/${canonicalDigest({ schema_version: 'ae.policy-bundle.v1' }).replace('sha256:', '')}.json`);

    return checks;
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { report } = await import('./harness.mjs');
  process.exit(report([run()], { verbose: process.argv.includes('--verbose') }) === 0 ? 0 : 1);
}
