// Executes the ae.tree-snapshot.v1 corpus: the three profiles, the
// observed-source to expected-target move projection, and the mutation matrix.

import { execFileSync } from 'node:child_process';
import {
  chmodSync, linkSync, mkdtempSync, readFileSync, renameSync, rmSync, symlinkSync, writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { canonicalDigest } from '../lib/canonical-json.mjs';
import { FoundationError } from '../lib/errors.mjs';
import {
  ALGORITHM, PROFILE_NAMES, entriesProjectionDigest, finalizeEntries, isObservedSnapshot,
  observeTree, projectExpectedAfterMove, snapshotDigest, validatePathBytes,
} from '../lib/tree-snapshot.mjs';
import { executeDirectoryMove, planDirectoryMove, planFileMove } from '../lib/fs-move-provider.mjs';
import { LOGICAL_ROOT, materializeTree } from '../corpus/tree-corpus.mjs';
import { Checks } from './harness.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const FIXTURE = join(HERE, '..', '..', 'fixtures', 'v1-foundation', 'tree-snapshot');

// changed   — the mutation is inside the profile's include set
// unchanged — the mutation is outside it, and the boundary holds
// reject:X  — the mutation makes the tree unsnapshottable, with typed code X
const MUTATIONS = [
  {
    id: 'file-bytes',
    apply: (root) => writeFileSync(join(root, 'contract/contract-v1.json'), '{"feature_id":"F-100","revision":"R0002"}'),
    expect: { origin_complete: 'changed', rollout_inventory: 'changed', feature_evidence: 'changed' },
  },
  {
    id: 'file-mode',
    apply: (root) => chmodSync(join(root, 'authority/current.json'), 0o600),
    expect: { origin_complete: 'changed', rollout_inventory: 'changed', feature_evidence: 'changed' },
  },
  {
    id: 'directory-mode',
    apply: (root) => chmodSync(join(root, 'runs/RUN-001'), 0o700),
    expect: { origin_complete: 'changed', rollout_inventory: 'changed', feature_evidence: 'changed' },
  },
  {
    id: 'path-rename',
    apply: (root) => renameSync(join(root, 'runs/RUN-001/stdout.txt'), join(root, 'runs/RUN-001/stdout.log')),
    expect: { origin_complete: 'changed', rollout_inventory: 'changed', feature_evidence: 'changed' },
  },
  {
    id: 'missing-descendant',
    apply: (root) => rmSync(join(root, 'authority/releases/deadbeef.json')),
    expect: { origin_complete: 'changed', rollout_inventory: 'changed', feature_evidence: 'changed' },
  },
  {
    // A temp/quarantine/unknown file inside an included root is not skipped: it
    // enters the snapshot and moves the digest, which is the intended alarm.
    id: 'unexpected-file-in-included-root',
    apply: (root) => writeFileSync(join(root, 'contract/quarantine.tmp'), 'partial write\n'),
    expect: { origin_complete: 'changed', rollout_inventory: 'changed', feature_evidence: 'changed' },
  },
  {
    id: 'type-change-file-to-directory',
    apply: (root) => {
      rmSync(join(root, 'ledger/head.json'));
      execFileSync('mkdir', [join(root, 'ledger/head.json')]);
      chmodSync(join(root, 'ledger/head.json'), 0o755);
    },
    expect: { origin_complete: 'changed', rollout_inventory: 'changed', feature_evidence: 'changed' },
  },

  // ---- exclusion boundary: these must move origin_complete and NOT feature_evidence
  {
    id: 'excluded-telemetry-bytes',
    apply: (root) => writeFileSync(join(root, 'ledger/telemetry.ndjson'), '{"metric":"tokens","value":9999}\n'),
    expect: { origin_complete: 'changed', rollout_inventory: 'changed', feature_evidence: 'unchanged' },
  },
  {
    id: 'excluded-index-md',
    apply: (root) => writeFileSync(join(root, 'index.md'), '# rewritten\n'),
    expect: { origin_complete: 'changed', rollout_inventory: 'changed', feature_evidence: 'unchanged' },
  },
  {
    id: 'excluded-plan-md',
    apply: (root) => writeFileSync(join(root, 'plan.md'), '## rewritten\n'),
    expect: { origin_complete: 'changed', rollout_inventory: 'changed', feature_evidence: 'unchanged' },
  },
  {
    id: 'excluded-status-json',
    apply: (root) => writeFileSync(join(root, 'state/status.json'), '{"status":"paused"}'),
    expect: { origin_complete: 'changed', rollout_inventory: 'changed', feature_evidence: 'unchanged' },
  },
  {
    id: 'excluded-new-file',
    apply: (root) => writeFileSync(join(root, 'state/scratch.json'), '{}'),
    expect: { origin_complete: 'changed', rollout_inventory: 'changed', feature_evidence: 'unchanged' },
  },

  // ---- link and special-file rejections
  {
    id: 'symlink-in-included-root',
    apply: (root) => symlinkSync(join(root, 'contract/contract-v1.json'), join(root, 'contract/alias.json')),
    expect: {
      origin_complete: 'reject:symlink_entry',
      rollout_inventory: 'reject:symlink_entry',
      feature_evidence: 'reject:symlink_entry',
    },
  },
  {
    // A symlink outside the include set is not an entry, so feature_evidence is
    // unaffected while the complete profiles still refuse.
    id: 'symlink-in-excluded-path',
    apply: (root) => symlinkSync(join(root, 'ledger/events.ndjson'), join(root, 'state/alias.ndjson')),
    expect: {
      origin_complete: 'reject:symlink_entry',
      rollout_inventory: 'reject:symlink_entry',
      feature_evidence: 'unchanged',
    },
  },
  {
    id: 'hardlink',
    apply: (root) => linkSync(join(root, 'authority/current.json'), join(root, 'authority/current-link.json')),
    expect: {
      origin_complete: 'reject:hardlink_entry',
      rollout_inventory: 'reject:hardlink_entry',
      feature_evidence: 'reject:hardlink_entry',
    },
  },
  {
    id: 'special-file-fifo',
    apply: (root) => execFileSync('mkfifo', [join(root, 'runs/RUN-001/pipe')]),
    expect: {
      origin_complete: 'reject:special_file_entry',
      rollout_inventory: 'reject:special_file_entry',
      feature_evidence: 'reject:special_file_entry',
    },
  },
];

function snapshotOrError(root, profile) {
  try {
    return { snapshot: observeTree({ logicalRoot: LOGICAL_ROOT, resolvedRootPath: root, profile }) };
  } catch (error) {
    if (error instanceof FoundationError) return { code: error.code };
    throw error;
  }
}

export function run() {
  const checks = new Checks('tree-snapshot');
  const expected = JSON.parse(readFileSync(join(FIXTURE, 'expected.json'), 'utf8'));
  const work = mkdtempSync(join(tmpdir(), 'ae-tree-'));

  try {
    // ---- baseline against the checked-in projections ----------------------
    checks.equal('algorithm-build-digest', ALGORITHM.build_digest, expected.algorithm.build_digest);

    const baseRoot = materializeTree(join(work, 'baseline'));
    const baseline = {};
    for (const profile of PROFILE_NAMES) {
      const snapshot = observeTree({ logicalRoot: LOGICAL_ROOT, resolvedRootPath: baseRoot, profile });
      baseline[profile] = snapshot;
      const golden = expected.profiles[profile];
      checks.equal(`baseline/${profile}/entry-count`, snapshot.entries.length, golden.entry_count);
      checks.equal(`baseline/${profile}/projection-digest`,
        entriesProjectionDigest(snapshot), golden.entries_projection_digest);
      checks.equal(`baseline/${profile}/paths`,
        snapshot.entries.map((e) => `${e.type === 'directory' ? 'd' : 'f'} ${e.path}`).join('|'),
        golden.paths.join('|'));
      checks.equal(`baseline/${profile}/projection-kind`, snapshot.projection_kind, 'observed');
      checks.equal(`baseline/${profile}/binds-logical-root`, snapshot.subject.logical_root, LOGICAL_ROOT);
      checks.ok(`baseline/${profile}/binds-resolved-root`,
        typeof snapshot.subject.resolved_root === 'string' && snapshot.subject.resolved_root.length > 0);
    }

    // The two complete profiles cover every descendant, so they must agree.
    checks.equal('complete-profiles-agree',
      entriesProjectionDigest(baseline.origin_complete),
      entriesProjectionDigest(baseline.rollout_inventory));
    // feature_evidence must be a strict subset, or the exclusion set is doing nothing.
    checks.ok('feature-evidence-is-strict-subset',
      baseline.feature_evidence.entries.length < baseline.origin_complete.entries.length);

    // Entries are sorted by raw UTF-8 path bytes.
    for (const profile of PROFILE_NAMES) {
      const paths = baseline[profile].entries.map((e) => Buffer.from(e.path, 'utf8'));
      let sorted = true;
      for (let i = 1; i < paths.length; i += 1) {
        if (Buffer.compare(paths[i - 1], paths[i]) >= 0) sorted = false;
      }
      checks.ok(`baseline/${profile}/sorted-by-utf8-bytes`, sorted);
    }

    // ---- mutation matrix --------------------------------------------------
    for (const mutation of MUTATIONS) {
      const root = materializeTree(join(work, `mut-${mutation.id}`));
      mutation.apply(root);
      for (const profile of PROFILE_NAMES) {
        const want = mutation.expect[profile];
        const observed = snapshotOrError(root, profile);
        const id = `mutation/${mutation.id}/${profile}`;
        if (want.startsWith('reject:')) {
          checks.equal(id, observed.code ?? 'accepted', want.slice('reject:'.length));
          continue;
        }
        if (observed.code) {
          checks.ok(id, false, `expected ${want}, observed rejection ${observed.code}`);
          continue;
        }
        const same = entriesProjectionDigest(observed.snapshot)
          === entriesProjectionDigest(baseline[profile]);
        checks.equal(id, same ? 'unchanged' : 'changed', want);
      }
    }

    // ---- synthetic rejections the host filesystem will not produce ---------
    // APFS refuses to create a filename that is not well-formed UTF-8, so the
    // path-decoding guard is exercised directly rather than through a real
    // directory entry. Whether any supported filesystem can produce one is a
    // P0.7/P0.8 host-matrix question, not a claim made here.
    let utf8Code = null;
    try {
      validatePathBytes(Buffer.from([0x61, 0xff, 0x62]));
    } catch (error) {
      utf8Code = error.code;
    }
    checks.equal('synthetic/invalid-utf8-path', utf8Code, 'invalid_utf8_path');

    let collisionCode = null;
    try {
      finalizeEntries([
        { path: 'contract/a.json', type: 'file', mode: '0644', length: 1, digest: `sha256:${'0'.repeat(64)}` },
        { path: 'contract/a.json', type: 'file', mode: '0644', length: 2, digest: `sha256:${'1'.repeat(64)}` },
      ]);
    } catch (error) {
      collisionCode = error.code;
    }
    checks.equal('synthetic/path-collision', collisionCode, 'path_collision');

    // ---- mode encoding ----------------------------------------------------
    // Four octal digits regardless of setuid/setgid/sticky. A three-digit pad with
    // a literal `0` prefix silently widens to five for exactly these modes.
    const modeRoot = materializeTree(join(work, 'modes'));
    for (const [label, bits, expectedMode] of [
      ['setuid', 0o4755, '4755'],
      ['setgid', 0o2644, '2644'],
      ['sticky', 0o1644, '1644'],
      ['plain', 0o644, '0644'],
      ['read-only', 0o400, '0400'],
    ]) {
      chmodSync(join(modeRoot, 'contract/contract-v1.json'), bits);
      const snapshot = observeTree({
        logicalRoot: LOGICAL_ROOT, resolvedRootPath: modeRoot, profile: 'feature_evidence',
      });
      const entry = snapshot.entries.find((e) => e.path === 'contract/contract-v1.json');
      checks.equal(`mode/${label}`, entry.mode, expectedMode);
      checks.equal(`mode/${label}/width`, entry.mode.length, 4);
    }
    chmodSync(join(modeRoot, 'contract/contract-v1.json'), 0o644);

    // ---- expected_after_move projection -----------------------------------
    //
    // The whole chain is producer-made: the source is a snapshot that enumerated a
    // real tree, and the plan and result come from a move provider that probed the
    // filesystem and then actually performed the rename.
    const moveRoot = materializeTree(join(work, 'to-be-moved'));
    const source = observeTree({
      logicalRoot: LOGICAL_ROOT, resolvedRootPath: moveRoot, profile: 'feature_evidence',
    });
    checks.ok('move/source-is-a-real-observation', isObservedSnapshot(source));

    const targetSubject = {
      logical_root: '.ae/features/done/F-100-billing-export',
      resolved_root: join(work, 'moved-target'),
      device_id: source.subject.device_id,
    };
    const movePlan = planDirectoryMove({ sourceSubject: source.subject, targetSubject });
    const qualification = movePlan.qualification;
    const moveResult = executeDirectoryMove(movePlan);
    checks.equal('move/provider-performed-the-move', moveResult.outcome, 'succeeded');

    const projected = projectExpectedAfterMove({
      observedSource: source, movePlan, moveResult, targetSubject: movePlan.target,
    });

    checks.equal('move/projection-kind', projected.projection_kind, 'expected_after_move');
    checks.equal('move/subject-is-target', projected.subject.logical_root, targetSubject.logical_root);
    checks.equal('move/provider-is-not-claimed-qualified',
      qualification.provider_id, 'fixture-fs-directory-move-v1');
    checks.equal('move/binds-enumeration-source',
      projected.enumeration_source.snapshot_digest, canonicalDigest(source));
    checks.equal('move/binds-plan', projected.move.plan_digest, canonicalDigest(movePlan));
    checks.equal('move/binds-result', projected.move.result_digest, canonicalDigest(moveResult));
    checks.equal('move/binds-operation', projected.move.operation, 'atomic_directory_noreplace');
    checks.equal('move/binds-qualification',
      canonicalDigest(projected.move.qualification), canonicalDigest(qualification));

    // The two claims that together define the projection: same content, different
    // subject. Entry projection identical, snapshot digests necessarily different.
    checks.equal('move/entries-projection-identical',
      entriesProjectionDigest(projected), entriesProjectionDigest(source));
    checks.ok('move/snapshot-digests-differ', snapshotDigest(projected) !== snapshotDigest(source));

    // A projection may only be derived from a real observation, of the right
    // subject, onto a distinct same-filesystem target.
    const rejections = [
      ['requires-observed-source',
        () => projectExpectedAfterMove({
          observedSource: projected, movePlan, moveResult, targetSubject: movePlan.target,
        }),
        'move_projection_requires_observed_source'],
      ['same-identity',
        () => projectExpectedAfterMove({
          observedSource: source,
          movePlan: { ...movePlan, target: source.subject },
          moveResult: { ...moveResult, target: source.subject },
          targetSubject: source.subject,
        }),
        'move_projection_plan_not_qualified'],
    ];
    for (const [label, fn, code] of rejections) {
      checks.rejects(`move/${label}`, fn, code);
    }

    // ---- provenance, not field agreement ---------------------------------
    //
    // These are the cases that matter most: every field below is exactly what a
    // genuine value carries, and every one is refused, because agreeing with
    // yourself is not evidence.
    const plainObserved = {
      schema_version: 'ae.tree-snapshot.v1',
      profile: 'feature_evidence',
      algorithm: ALGORITHM,
      projection_kind: 'observed',
      subject: { logical_root: 'x/F-1', resolved_root: '/nonexistent/source', device_id: 1 },
      enumeration_source: null,
      move: null,
      entries: [],
    };
    const plainTarget = { logical_root: 'y/F-1', resolved_root: '/nonexistent/target', device_id: 1 };
    const plainQualification = {
      provider_id: 'caller',
      build_digest: `sha256:${'1'.repeat(64)}`,
      selector_digest: `sha256:${'2'.repeat(64)}`,
      result_ref: 'anything',
      result_digest: `sha256:${'3'.repeat(64)}`,
    };
    const plainPlan = {
      operation: 'atomic_directory_noreplace',
      qualification: plainQualification,
      source: plainObserved.subject,
      target: plainTarget,
    };
    const plainResult = {
      operation: 'atomic_directory_noreplace',
      outcome: 'succeeded',
      qualified: true,
      qualification: plainQualification,
      source: plainObserved.subject,
      target: plainTarget,
    };

    // A hand-written "observed" snapshot over paths that do not exist.
    checks.rejects('provenance/caller-authored-observation',
      () => projectExpectedAfterMove({
        observedSource: plainObserved, movePlan: plainPlan, moveResult: plainResult,
        targetSubject: plainTarget,
      }),
      'move_projection_requires_observed_source');

    // A shallow copy of a genuine observation is not the observation.
    checks.rejects('provenance/copied-observation',
      () => projectExpectedAfterMove({
        observedSource: { ...source }, movePlan, moveResult, targetSubject: movePlan.target,
      }),
      'move_projection_requires_observed_source');

    // A real observation, but a caller-authored plan and result.
    checks.rejects('provenance/caller-authored-plan',
      () => projectExpectedAfterMove({
        observedSource: source,
        movePlan: { ...movePlan, qualification: plainQualification },
        moveResult,
        targetSubject: movePlan.target,
      }),
      'move_projection_plan_not_qualified');

    checks.rejects('provenance/caller-authored-result',
      () => projectExpectedAfterMove({
        observedSource: source, movePlan, moveResult: { ...moveResult },
        targetSubject: movePlan.target,
      }),
      'move_projection_unqualified_helper');

    // `qualified: true` written by the caller buys nothing.
    checks.rejects('provenance/self-declared-qualified-flag',
      () => projectExpectedAfterMove({
        observedSource: source, movePlan: plainPlan, moveResult: plainResult,
        targetSubject: plainTarget,
      }),
      'move_projection_plan_not_qualified');

    // A genuine, provider-produced plan for the wrong capability. This projection
    // is defined for directory no-replace moves only; a file move cannot stand in.
    {
      const fileMove = planFileMove({
        sourceSubject: source.subject,
        targetSubject: movePlan.target,
      });
      checks.rejects('move/genuine-plan-wrong-capability',
        () => projectExpectedAfterMove({
          observedSource: source,
          movePlan: fileMove.plan,
          moveResult: fileMove.result,
          targetSubject: movePlan.target,
        }),
        'move_projection_unsupported_operation');
    }

    // ---- a genuine provider result that FAILED ---------------------------
    // Branded exactly like a success, and still refused — the outcome is what is
    // being checked here, not the provenance.
    const failRoot = materializeTree(join(work, 'fail-source'));
    const failSource = observeTree({
      logicalRoot: LOGICAL_ROOT, resolvedRootPath: failRoot, profile: 'feature_evidence',
    });
    const failTarget = {
      logical_root: '.ae/features/done/F-100-fail',
      resolved_root: join(work, 'fail-target'),
      device_id: failSource.subject.device_id,
    };
    const failPlan = planDirectoryMove({ sourceSubject: failSource.subject, targetSubject: failTarget });
    rmSync(failRoot, { recursive: true, force: true });
    const failedResult = executeDirectoryMove(failPlan);
    checks.equal('move/provider-can-report-failure', failedResult.outcome, 'failed');
    checks.rejects('move/genuine-but-failed-result',
      () => projectExpectedAfterMove({
        observedSource: failSource, movePlan: failPlan, moveResult: failedResult,
        targetSubject: failPlan.target,
      }),
      'move_projection_failed_operation');

    // ---- the provider refuses to plan what it cannot do -------------------
    checks.rejects('provider/refuses-nonexistent-source',
      () => planDirectoryMove({
        sourceSubject: { logical_root: 'x', resolved_root: join(work, 'not-there'), device_id: 1 },
        targetSubject: { logical_root: 'y', resolved_root: join(work, 'also-not-there'), device_id: 1 },
      }),
      'move_projection_plan_not_qualified');

    checks.rejects('provider/refuses-existing-target',
      () => planDirectoryMove({
        sourceSubject: baseline.feature_evidence.subject,
        targetSubject: { ...baseline.feature_evidence.subject, logical_root: 'other' },
      }),
      'move_projection_plan_not_qualified');

    return checks;
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { report } = await import('./harness.mjs');
  process.exit(report([run()], { verbose: process.argv.includes('--verbose') }) === 0 ? 0 : 1);
}
