// ae.tree-snapshot.v1 — closed tree snapshot algorithm.
//
// A snapshot binds a profile, the algorithm identity, a projection kind, the
// subject root, and a sorted entry list. Consumers do not get to pick an
// algorithm or supply globs; the three profiles below are the whole surface.

import { lstatSync, readdirSync, readFileSync, realpathSync } from 'node:fs';
import { join } from 'node:path';
import { DIGEST_PATTERN, canonicalDigest, digestBytes } from './canonical-json.mjs';
import { fail } from './errors.mjs';
import { deepFreeze } from './freeze.mjs';
import { isProviderMoveResult, isQualifiedMovePlan } from './fs-move-provider.mjs';

// ---------------------------------------------------------------------------
// Profiles
//
// Include sets are closed exact paths and exact prefixes. Two frozen reading
// rules, because `contract/**` alone does not settle them:
//
//   - a prefix root is itself an entry (the `contract` directory's own mode is
//     part of the evidence);
//   - the parent of an exact included file is NOT an entry (`ledger/events.ndjson`
//     is covered, the `ledger` directory is not).
// ---------------------------------------------------------------------------

const FEATURE_EVIDENCE_PREFIXES = ['authority', 'contract', 'runs'];
const FEATURE_EVIDENCE_EXACT = ['ledger/events.ndjson', 'ledger/head.json', 'origin-marker.json'];

// Named only so the corpus can assert the boundary explicitly. Anything not in
// the include set is excluded; these are the paths that exist in practice and
// must be proven excluded.
const FEATURE_EVIDENCE_NAMED_EXCLUSIONS = [
  'index.md',
  'plan.md',
  'ledger/telemetry.ndjson',
  'state/status.json',
];

const ALL_DESCENDANTS = {
  includes: () => true,
  mayContain: () => true,
  exclusions: [],
};

function underPrefix(rel, prefix) {
  return rel === prefix || rel.startsWith(`${prefix}/`);
}

const FEATURE_EVIDENCE = {
  includes: (rel) =>
    FEATURE_EVIDENCE_PREFIXES.some((p) => underPrefix(rel, p)) || FEATURE_EVIDENCE_EXACT.includes(rel),
  mayContain: (rel) => {
    if (rel === '') return true;
    if (FEATURE_EVIDENCE_PREFIXES.some((p) => underPrefix(rel, p))) return true;
    return FEATURE_EVIDENCE_EXACT.some((exact) => exact.startsWith(`${rel}/`));
  },
  exclusions: FEATURE_EVIDENCE_NAMED_EXCLUSIONS,
};

export const PROFILES = Object.freeze({
  origin_complete: ALL_DESCENDANTS,
  rollout_inventory: ALL_DESCENDANTS,
  feature_evidence: FEATURE_EVIDENCE,
});

export const PROFILE_NAMES = Object.freeze(Object.keys(PROFILES));

// ---------------------------------------------------------------------------
// Algorithm identity
//
// build_digest is the digest of the algorithm *contract*, not of this file, so
// that a comment edit does not invalidate every checked-in snapshot while a
// change to the include set or the entry shape does.
// ---------------------------------------------------------------------------

const ALGORITHM_SPEC = {
  id: 'ae.tree-snapshot.v1',
  version: 1,
  path_sort: 'raw-utf8-bytes-ascending',
  path_encoding: 'repo-relative logical UTF-8, forward slash separated',
  entry_fields: {
    directory: ['path', 'type', 'mode'],
    file: ['path', 'type', 'mode', 'length', 'digest'],
  },
  mode_form: 'four octal digits of the low 12 mode bits, zero-padded',
  file_digest: 'sha256 over raw file bytes',
  rejections: [
    'invalid_utf8_path',
    'path_collision',
    'symlink_entry',
    'hardlink_entry',
    'special_file_entry',
  ],
  profiles: {
    origin_complete: { include: ['**'], exclude: [] },
    rollout_inventory: { include: ['**'], exclude: [] },
    feature_evidence: {
      include_prefixes: FEATURE_EVIDENCE_PREFIXES,
      include_exact: FEATURE_EVIDENCE_EXACT,
      exclude_named: FEATURE_EVIDENCE_NAMED_EXCLUSIONS,
      prefix_root_is_entry: true,
      exact_file_parent_is_entry: false,
    },
  },
};

export const ALGORITHM = Object.freeze({
  id: ALGORITHM_SPEC.id,
  version: ALGORITHM_SPEC.version,
  build_digest: canonicalDigest(ALGORITHM_SPEC),
});

// ---------------------------------------------------------------------------
// Entries
// ---------------------------------------------------------------------------

// Four octal digits, always. Padding to three and prefixing a literal `0` would
// widen to five characters as soon as setuid/setgid/sticky is set, silently
// breaking the fixed-width form the contract declares.
function modeOf(stat) {
  return (stat.mode & 0o7777).toString(8).padStart(4, '0');
}

// Sorting is over raw UTF-8 bytes, not code units: paths are byte strings on the
// wire and two implementations must not disagree because one sorted UTF-16.
export function finalizeEntries(entries) {
  const seen = new Set();
  for (const entry of entries) {
    if (seen.has(entry.path)) {
      fail('path_collision', `two entries resolve to the logical path ${entry.path}`, { path: entry.path });
    }
    seen.add(entry.path);
  }
  return entries
    .slice()
    .sort((a, b) => Buffer.compare(Buffer.from(a.path, 'utf8'), Buffer.from(b.path, 'utf8')));
}

// Provenance brand for observed snapshots.
//
// `projection_kind: 'observed'` is a field, and a field is something a caller
// writes. Only a snapshot that actually enumerated its subject gets into this
// set, so a plain object claiming to be observed — over paths that need not even
// exist — cannot be used to derive an expected_after_move projection.
const OBSERVED = new WeakSet();

function sealObserved(snapshot) {
  // Frozen before branding, and deeply: `subject` and `entries` are where a
  // caller would otherwise rewrite what this snapshot claims to have seen, and
  // the brand would survive because the identity never changed.
  deepFreeze(snapshot);
  OBSERVED.add(snapshot);
  return snapshot;
}

export function isObservedSnapshot(value) {
  return typeof value === 'object' && value !== null && OBSERVED.has(value);
}

const PATH_DECODER = new TextDecoder('utf-8', { fatal: true });

export function validatePathBytes(nameBytes) {
  try {
    return PATH_DECODER.decode(nameBytes);
  } catch {
    fail('invalid_utf8_path', 'directory entry name is not well-formed UTF-8', {
      bytes: Buffer.from(nameBytes).toString('hex'),
    });
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// Observed enumeration
// ---------------------------------------------------------------------------

function walk(rootAbs, rel, profile, out) {
  const dirAbs = rel === '' ? rootAbs : join(rootAbs, rel);
  const names = readdirSync(dirAbs, { encoding: 'buffer' });
  for (const nameBytes of names) {
    const name = validatePathBytes(nameBytes);
    const childRel = rel === '' ? name : `${rel}/${name}`;
    const included = profile.includes(childRel);
    const traversable = profile.mayContain(childRel);
    if (!included && !traversable) continue;

    const stat = lstatSync(join(rootAbs, childRel));
    if (stat.isSymbolicLink()) {
      fail('symlink_entry', `symlink at ${childRel} is not admissible in a tree snapshot`, { path: childRel });
    }
    if (stat.isDirectory()) {
      if (included) out.push({ path: childRel, type: 'directory', mode: modeOf(stat) });
      if (traversable) walk(rootAbs, childRel, profile, out);
      continue;
    }
    if (stat.isFile()) {
      if (!included) continue;
      if (stat.nlink > 1) {
        fail('hardlink_entry', `${childRel} has link count ${stat.nlink}`, { path: childRel, nlink: stat.nlink });
      }
      const bytes = readFileSync(join(rootAbs, childRel));
      out.push({
        path: childRel,
        type: 'file',
        mode: modeOf(stat),
        length: bytes.length,
        digest: digestBytes(bytes),
      });
      continue;
    }
    if (!included) continue;
    fail('special_file_entry', `${childRel} is neither a regular file nor a directory`, { path: childRel });
  }
}

export function observeTree({ logicalRoot, resolvedRootPath, profile }) {
  if (!PROFILE_NAMES.includes(profile)) {
    fail('schema_invalid', `unknown tree-snapshot profile ${profile}`, { profile });
  }
  const rootStat = lstatSync(resolvedRootPath);
  if (!rootStat.isDirectory()) {
    fail('root_not_directory', `${resolvedRootPath} is not a directory`);
  }
  const entries = [];
  walk(resolvedRootPath, '', PROFILES[profile], entries);
  return sealObserved({
    schema_version: 'ae.tree-snapshot.v1',
    profile,
    algorithm: ALGORITHM,
    projection_kind: 'observed',
    subject: {
      logical_root: logicalRoot,
      resolved_root: realpathSync(resolvedRootPath),
      device_id: rootStat.dev,
    },
    enumeration_source: null,
    move: null,
    entries: finalizeEntries(entries),
  });
}

// ---------------------------------------------------------------------------
// expected_after_move projection
//
// Derivable from exactly three things: the observed source snapshot, a QUALIFIED
// same-filesystem atomic directory move plan/result, and the intended target
// identity. It does not assert that the target exists.
//
// "Qualified" is load-bearing and is checked, not assumed. The projection is the
// only place a snapshot may describe a tree that was never enumerated, so a plan
// that names an ordinary overwriting rename, a result that failed, or a helper
// that self-reports without a qualification binding must not be able to mint one.
// ---------------------------------------------------------------------------

// The one operation the projection is defined for. An overwriting rename can
// destroy an existing target, so it can never stand in for this.
export const QUALIFIED_MOVE_OPERATION = 'atomic_directory_noreplace';

const QUALIFICATION_FIELDS = ['provider_id', 'build_digest', 'selector_digest', 'result_ref', 'result_digest'];

function sameSubject(a, b) {
  return Boolean(a) && Boolean(b)
    && a.logical_root === b.logical_root
    && a.resolved_root === b.resolved_root
    && a.device_id === b.device_id;
}

// Provenance before content. Whether these values came from a move provider is
// not something their own fields can answer: `qualified: true` and a
// `provider_id` of "caller" agree with each other perfectly.
export function assertMoveProvenance(movePlan, moveResult) {
  if (!isQualifiedMovePlan(movePlan)) {
    fail('move_projection_plan_not_qualified',
      'move plan was not produced by a move provider');
  }
  if (!isProviderMoveResult(moveResult)) {
    fail('move_projection_unqualified_helper',
      'move result was not produced by a move provider');
  }
}

// The content rules, separated from the provenance check so they can be exercised
// directly. A provider makes well-formed plans by construction, so through the
// normal path these branches are unreachable and would be dead code no test could
// reach — the split is what keeps them honest, the same way resolveMemberRef is
// exported in the launcher.
export function assertMoveContent(movePlan, moveResult) {
  if (movePlan.operation !== QUALIFIED_MOVE_OPERATION) {
    fail('move_projection_unsupported_operation',
      `expected_after_move requires operation ${QUALIFIED_MOVE_OPERATION}`,
      { observed: movePlan?.operation ?? null });
  }

  const qualification = movePlan.qualification;
  if (!qualification || typeof qualification !== 'object') {
    fail('move_projection_qualification_incomplete', 'move plan carries no qualification binding');
  }
  for (const field of QUALIFICATION_FIELDS) {
    const value = qualification[field];
    if (typeof value !== 'string' || value.length === 0) {
      fail('move_projection_qualification_incomplete',
        `move plan qualification is missing ${field}`, { field });
    }
  }
  for (const field of ['build_digest', 'selector_digest', 'result_digest']) {
    if (!DIGEST_PATTERN.test(qualification[field])) {
      fail('move_projection_qualification_incomplete',
        `move plan qualification ${field} is not a sha256 digest`, { field });
    }
  }

  if (moveResult?.operation !== movePlan.operation) {
    fail('move_projection_result_mismatch',
      'move result describes a different operation than the plan',
      { plan: movePlan.operation, result: moveResult?.operation ?? null });
  }
  if (moveResult.outcome !== 'succeeded') {
    fail('move_projection_failed_operation',
      'expected_after_move requires a successful move', { outcome: moveResult.outcome ?? null });
  }
  // The result must be the result *of this plan*: same qualification identity and
  // the same endpoints. Otherwise a real success elsewhere could be replayed here.
  if (canonicalDigest(qualification) !== canonicalDigest(moveResult.qualification ?? null)) {
    fail('move_projection_qualification_mismatch',
      'move result qualification identity does not match the plan');
  }
  if (!sameSubject(moveResult.source, movePlan.source) || !sameSubject(moveResult.target, movePlan.target)) {
    fail('move_projection_result_mismatch', 'move result endpoints do not match the plan');
  }
}

// Endpoint rules, likewise exported so each branch has a reachable test.
//
// Order matters here: the device comparison has to precede the plan-target/intended-
// target equality check, because sameSubject compares device_id too. Behind that
// check a cross-device plan is indistinguishable from a mismatched one, and the
// dedicated code could never fire.
export function assertProjectionEndpoints({ observedSource, movePlan, targetSubject }) {
  if (!sameSubject(observedSource.subject, movePlan.source)) {
    fail('move_projection_source_mismatch',
      'move plan source identity does not match the enumerated snapshot subject');
  }
  if (movePlan.source.device_id !== targetSubject.device_id) {
    fail('move_projection_cross_device',
      'expected_after_move is only defined for a same-filesystem move');
  }
  if (!sameSubject(movePlan.target, targetSubject)) {
    fail('move_projection_source_mismatch',
      'move plan target identity does not match the intended target identity');
  }
  if (sameSubject(observedSource.subject, targetSubject)) {
    fail('move_projection_same_identity', 'move target identity equals the source identity');
  }
}

export function projectExpectedAfterMove({ observedSource, movePlan, moveResult, targetSubject }) {
  // An observation is something enumeration produced, not something a snapshot
  // says about itself. Without this a caller could project from a hand-written
  // "observed" snapshot over paths that never existed.
  if (!isObservedSnapshot(observedSource)) {
    fail('move_projection_requires_observed_source',
      'expected_after_move may only be derived from a snapshot produced by observeTree');
  }
  assertMoveProvenance(movePlan, moveResult);
  assertMoveContent(movePlan, moveResult);
  assertProjectionEndpoints({ observedSource, movePlan, targetSubject });
  return deepFreeze({
    schema_version: 'ae.tree-snapshot.v1',
    profile: observedSource.profile,
    algorithm: ALGORITHM,
    projection_kind: 'expected_after_move',
    subject: targetSubject,
    enumeration_source: {
      snapshot_digest: canonicalDigest(observedSource),
      projection_kind: 'observed',
    },
    move: {
      operation: movePlan.operation,
      qualification: movePlan.qualification,
      plan_digest: canonicalDigest(movePlan),
      result_digest: canonicalDigest(moveResult),
      source: observedSource.subject,
      target: targetSubject,
    },
    // Verbatim: the projection asserts the same content under a new subject.
    entries: observedSource.entries,
  });
}

export function snapshotDigest(snapshot) {
  return canonicalDigest(snapshot);
}

// The entry projection is what must survive a move; the snapshot digest must not.
export function entriesProjectionDigest(snapshot) {
  return canonicalDigest(snapshot.entries);
}
