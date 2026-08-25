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
import { isDeeplyFrozen } from '../lib/freeze.mjs';
import { ALL_CODES, CODES } from '../lib/errors.mjs';
import { FoundationError } from '../lib/errors.mjs';
import { FIXTURE_PROVIDER } from '../lib/fs-noreplace.mjs';
import {
  ALGORITHM, PROFILES, PROFILE_NAMES, assertMoveContent, assertProjectionEndpoints,
  entriesProjectionDigest, finalizeEntries, isObservedSnapshot, observeTree,
  projectExpectedAfterMove, snapshotDigest, validatePathBytes,
} from '../lib/tree-snapshot.mjs';
import {
  FIXTURE_MOVE_PROVIDER, executeDirectoryMove, planDirectoryMove, planFileMove,
} from '../lib/fs-move-provider.mjs';
import { LOGICAL_ROOT, materializeTree } from '../corpus/tree-corpus.mjs';
import { Checks } from './harness.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const FIXTURE = join(HERE, '..', '..', 'fixtures', 'v1-foundation', 'tree-snapshot');
const FLOOR = JSON.parse(readFileSync(
  join(HERE, '..', '..', 'fixtures', 'v1-foundation', 'coverage-floor.json'), 'utf8',
)).min_corpus_sizes;


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
    // ---- module constants, asserted before ANY observation ----------------
    //
    // Order is load-bearing here. A snapshot carries `algorithm: ALGORITHM` — the
    // same object — so taking a baseline observation first deep-freezes ALGORITHM
    // transitively, and an assertion placed after that would pass even with its own
    // freeze removed. Asserted first, each constant is scored on its own freeze.
    for (const [label, value] of [
      ['PROFILES', PROFILES],
      ['PROFILE_NAMES', PROFILE_NAMES],
      ['ALGORITHM', ALGORITHM],
      ['FIXTURE_MOVE_PROVIDER', FIXTURE_MOVE_PROVIDER],
      ['FIXTURE_PROVIDER', FIXTURE_PROVIDER],
      ['CODES', CODES],
      ['ALL_CODES', ALL_CODES],
    ]) {
      checks.ok(`immutability/constant-is-deeply-frozen/${label}`, isDeeplyFrozen(value));
    }
    // The specific shape that got past a shallow freeze: a profile's predicates.
    let profileMutationBlocked = false;
    try { PROFILES.feature_evidence.includes = () => true; } catch { profileMutationBlocked = true; }
    checks.ok('immutability/profile-predicates-cannot-be-replaced', profileMutationBlocked);
    // isDeeplyFrozen answers for the predicates themselves, not just the object
    // holding them. It used to return true for any function, because functions
    // are not typeof 'object' — so the assertions above were satisfied by a
    // property the helper never looked at.
    checks.ok('immutability/deep-freeze-sees-functions',
      !isDeeplyFrozen({ predicate: () => true }),
      'isDeeplyFrozen reports an unfrozen function as deeply frozen');
    checks.ok('immutability/profile-predicates-are-themselves-frozen',
      Object.values(PROFILES).every((p) => typeof p.includes !== 'function' || Object.isFrozen(p.includes)));
    checks.ok('profiles/complete-profiles-are-distinct-objects',
      PROFILES.origin_complete !== PROFILES.rollout_inventory);

    // ---- baseline against the checked-in projections ----------------------
    checks.ok('floor/mutations', MUTATIONS.length >= FLOOR.tree_snapshot_mutations,
      `${MUTATIONS.length} mutations, floor is ${FLOOR.tree_snapshot_mutations}`);
    checks.ok('floor/profiles', PROFILE_NAMES.length >= FLOOR.tree_snapshot_profiles,
      `${PROFILE_NAMES.length} profiles, floor is ${FLOOR.tree_snapshot_profiles}`);
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
    checks.equal('move/qualification-names-the-fixture-provider',
      qualification.provider_id, 'fixture-fs-directory-move-v1');
    checks.equal('move/fixture-provider-does-not-claim-qualification',
      FIXTURE_MOVE_PROVIDER.qualified, false);
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

    // ---- a brand certifies identity, not content -------------------------
    //
    // The corpus previously tested only "a shallow copy is not the value". That
    // misses the sharper attack: keep the identity, edit the contents. A branded
    // object that is still mutable certifies nothing, because the WeakSet keys on
    // the reference and the reference never changed.
    // Deliberately a FRESH observation: projectExpectedAfterMove deep-freezes the
    // members it carries over, so asserting on `source` after a projection would
    // pass even if observeTree itself froze nothing.
    const untouched = observeTree({
      logicalRoot: LOGICAL_ROOT,
      resolvedRootPath: materializeTree(join(work, 'immutability')),
      profile: 'feature_evidence',
    });
    checks.ok('immutability/observed-snapshot-is-deeply-frozen', isDeeplyFrozen(untouched));
    const originalRoot = untouched.subject.resolved_root;
    const originalEntryCount = untouched.entries.length;
    const originalFirstDigest = untouched.entries.find((e) => e.type === 'file')?.digest;
    for (const [label, mutate] of [
      ['subject-root', (snap) => { snap.subject.resolved_root = '/somewhere/else'; }],
      ['subject-logical-root', (snap) => { snap.subject.logical_root = 'claimed/elsewhere'; }],
      ['append-entry', (snap) => {
        snap.entries.push({
          path: 'fabricated.txt', type: 'file', mode: '0644', length: 0,
          digest: `sha256:${'0'.repeat(64)}`,
        });
      }],
      ['edit-entry-digest', (snap) => { snap.entries[0].digest = `sha256:${'f'.repeat(64)}`; }],
      ['edit-projection-kind', (snap) => { snap.projection_kind = 'expected_after_move'; }],
    ]) {
      let blocked = false;
      try {
        mutate(untouched);
      } catch {
        blocked = true;
      }
      checks.ok(`immutability/observed-snapshot-rejects/${label}`, blocked,
        'a branded snapshot was mutated in place and stayed branded');
    }
    // ...and the contents are actually unchanged, not merely refused loudly.
    checks.ok('immutability/observed-snapshot-content-intact',
      !untouched.entries.some((e) => e.path === 'fabricated.txt')
      && untouched.entries.length === originalEntryCount
      && untouched.subject.resolved_root === originalRoot
      && untouched.entries.find((e) => e.type === 'file')?.digest === originalFirstDigest
      && untouched.projection_kind === 'observed');

    checks.equal('immutability/profile-still-excludes-after-attempt',
      observeTree({
        logicalRoot: LOGICAL_ROOT,
        resolvedRootPath: baseRoot,
        profile: 'feature_evidence',
      }).entries.length,
      expected.profiles.feature_evidence.entry_count);
    // The declared exclusions are a field nothing read. Asserting them against the
    // observed entry set makes the declaration load-bearing instead of decorative.
    const observedPaths = new Set(baseline.feature_evidence.entries.map((e) => e.path));
    for (const excluded of PROFILES.feature_evidence.exclusions) {
      checks.ok(`profiles/declared-exclusion-is-excluded/${excluded}`, !observedPaths.has(excluded));
      checks.ok(`profiles/declared-exclusion-exists-on-disk/${excluded}`,
        new Set(baseline.origin_complete.entries.map((e) => e.path)).has(excluded),
        'an exclusion that names nothing present proves nothing');
    }

    checks.ok('immutability/move-plan-is-deeply-frozen', isDeeplyFrozen(movePlan));
    checks.ok('immutability/move-result-is-deeply-frozen', isDeeplyFrozen(moveResult));
    checks.ok('immutability/projection-is-deeply-frozen', isDeeplyFrozen(projected));

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
      checks.ok('immutability/file-move-plan-is-deeply-frozen', isDeeplyFrozen(fileMove.plan));
      checks.ok('immutability/file-move-result-is-deeply-frozen', isDeeplyFrozen(fileMove.result));
      checks.rejects('move/genuine-plan-wrong-capability',
        () => projectExpectedAfterMove({
          observedSource: source,
          movePlan: fileMove.plan,
          moveResult: fileMove.result,
          targetSubject: movePlan.target,
        }),
        'move_projection_unsupported_operation');
    }

    // ---- the content and endpoint rules, exercised directly ---------------
    //
    // A provider builds well-formed plans by construction, so every branch below is
    // unreachable through the normal path. Reached only through the exported
    // helpers, they would otherwise be code no test can execute — which is how a
    // typed code ends up bound to nothing.
    const subj = (logical, resolved, device = 1) => ({
      logical_root: logical, resolved_root: resolved, device_id: device,
    });
    const srcSubject = subj('a/F-1', '/src');
    const tgtSubject = subj('b/F-1', '/tgt');
    const goodQualification = {
      provider_id: 'p', build_digest: `sha256:${'1'.repeat(64)}`,
      selector_digest: `sha256:${'2'.repeat(64)}`, result_ref: 'r',
      result_digest: `sha256:${'3'.repeat(64)}`,
    };
    const basePlan = {
      operation: 'atomic_directory_noreplace',
      qualification: goodQualification,
      source: srcSubject,
      target: tgtSubject,
    };
    const baseResult = {
      operation: 'atomic_directory_noreplace',
      outcome: 'succeeded',
      qualification: goodQualification,
      source: srcSubject,
      target: tgtSubject,
    };

    checks.accepts('content/well-formed-plan-and-result',
      () => assertMoveContent(basePlan, baseResult));

    for (const [label, plan, result, code] of [
      ['wrong-operation', { ...basePlan, operation: 'atomic_file_noreplace' }, baseResult,
        'move_projection_unsupported_operation'],
      ['no-qualification', { ...basePlan, qualification: undefined }, baseResult,
        'move_projection_qualification_incomplete'],
      ['qualification-not-an-object', { ...basePlan, qualification: 'yes' }, baseResult,
        'move_projection_qualification_incomplete'],
      ['qualification-missing-field',
        { ...basePlan, qualification: { ...goodQualification, result_ref: undefined } }, baseResult,
        'move_projection_qualification_incomplete'],
      ['qualification-empty-field',
        { ...basePlan, qualification: { ...goodQualification, provider_id: '' } }, baseResult,
        'move_projection_qualification_incomplete'],
      ['qualification-bad-digest-form',
        { ...basePlan, qualification: { ...goodQualification, build_digest: 'nope' } }, baseResult,
        'move_projection_qualification_incomplete'],
      ['result-operation-differs', basePlan, { ...baseResult, operation: 'atomic_file_noreplace' },
        'move_projection_result_mismatch'],
      ['result-not-succeeded', basePlan, { ...baseResult, outcome: 'failed' },
        'move_projection_failed_operation'],
      ['result-qualification-differs', basePlan,
        { ...baseResult, qualification: { ...goodQualification, provider_id: 'other' } },
        'move_projection_qualification_mismatch'],
      ['result-source-differs', basePlan, { ...baseResult, source: subj('x', '/x') },
        'move_projection_result_mismatch'],
      ['result-target-differs', basePlan, { ...baseResult, target: subj('y', '/y') },
        'move_projection_result_mismatch'],
    ]) {
      checks.rejects(`content/${label}`, () => assertMoveContent(plan, result), code);
    }

    const observedShape = (subject) => ({ subject });
    checks.accepts('endpoints/well-formed',
      () => assertProjectionEndpoints({
        observedSource: observedShape(srcSubject), movePlan: basePlan, targetSubject: tgtSubject,
      }));

    for (const [label, args, code] of [
      ['plan-source-is-not-the-observed-subject',
        { observedSource: observedShape(subj('other', '/other')), movePlan: basePlan, targetSubject: tgtSubject },
        'move_projection_source_mismatch'],
      ['plan-target-is-not-the-intended-target',
        {
          observedSource: observedShape(srcSubject),
          movePlan: { ...basePlan, target: subj('z', '/z') },
          targetSubject: tgtSubject,
        },
        'move_projection_source_mismatch'],
      ['target-on-another-filesystem',
        {
          observedSource: observedShape(srcSubject),
          movePlan: { ...basePlan, target: subj('b/F-1', '/tgt', 2) },
          targetSubject: subj('b/F-1', '/tgt', 2),
        },
        'move_projection_cross_device'],
      ['target-identity-equals-source',
        {
          observedSource: observedShape(srcSubject),
          movePlan: { ...basePlan, target: srcSubject },
          targetSubject: srcSubject,
        },
        'move_projection_same_identity'],
    ]) {
      checks.rejects(`endpoints/${label}`, () => assertProjectionEndpoints(args), code);
    }

    // ---- observeTree's own preconditions ----------------------------------
    checks.rejects('observe/unknown-profile',
      () => observeTree({
        logicalRoot: 'x', resolvedRootPath: baseRoot, profile: 'everything_please',
      }), 'schema_invalid');
    checks.rejects('observe/root-is-a-file',
      () => observeTree({
        logicalRoot: 'x',
        resolvedRootPath: join(baseRoot, 'index.md'),
        profile: 'origin_complete',
      }), 'root_not_directory');

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
