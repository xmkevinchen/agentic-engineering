// Policy bundle materialization and the activation/replay split.
//
// Two decisions that look like one and are not:
//
//   materialization — plugin policy sources are verified against the bundle
//     manifest and copied byte-for-byte into the project's own `.ae/policies/**`
//     snapshot. After this, the Gate reads the project snapshot, never the
//     plugin tree that may have since been upgraded.
//
//   selection — which activation base bundle a *new* candidate may bind. That is
//     the exact singleton of the currently active verified release, and nothing
//     else. An old bundle that the project still holds is retained to replay
//     history, not to be selected.

import { lstatSync, readFileSync } from 'node:fs';
import { isAbsolute, join, resolve, sep } from 'node:path';
import { isVerifiedActiveRelease } from './active-release.mjs';
import { canonicalDigest, digestBytes, parseStrict } from './canonical-json.mjs';
import { fail } from './errors.mjs';
import { NoReplaceError, atomicFileNoReplace } from './fs-noreplace.mjs';

const PROJECT_POLICY_ROOT = '.ae/policies';

export function bundleProjectRef(bundleBytes) {
  return `${PROJECT_POLICY_ROOT}/bundles/${digestBytes(bundleBytes).replace('sha256:', '')}.json`;
}

// Lexical safety, applied identically to plugin sources and project refs. A ref
// that is not in canonical form is refused rather than normalized: normalizing
// would let two spellings name one file, which is how duplicate detection and
// no-clobber both get defeated.
function assertCanonicalRef(ref, escapeCode, label) {
  if (typeof ref !== 'string' || ref.length === 0) {
    fail('ref_non_canonical', `${label} is empty`);
  }
  if (isAbsolute(ref)) fail(escapeCode, `${label} ${ref} is absolute`);
  const parts = ref.split('/');
  // `..` is a canonicality failure, not an escape: `.ae/policies/../policies/x`
  // resolves inside the root, so the containment check below cannot see it. They
  // previously shared one code, which made each half untestable — every fixture
  // violated both at once.
  if (parts.some((part) => part === '' || part === '.' || part === '..')) {
    fail('ref_non_canonical', `${label} ${ref} is not in canonical form`);
  }
  return parts;
}

// Resolved safety: every existing component of the path must be a real directory
// or file, never a symlink. Checking only the resolved string is not enough — a
// `.ae/policies` symlink pointing outside the project passes every lexical test
// and still lands the bytes somewhere else entirely.
function assertNoSymlinkComponents(root, parts, label) {
  let current = root;
  for (const part of parts) {
    current = join(current, part);
    let stat;
    try {
      stat = lstatSync(current);
    } catch (error) {
      // Only "does not exist" means there is nothing below to check. Any other
      // errno is a real problem with the ref — an embedded NUL byte, for
      // instance, raises ERR_INVALID_ARG_VALUE here, and swallowing it would
      // classify a malformed path as safe-because-absent.
      if (error.code === 'ENOENT') return;
      fail('ref_non_canonical',
        `${label} could not be resolved: ${error.code ?? error.name}`,
        { component: current, cause: error.code ?? error.name });
    }
    if (stat.isSymbolicLink()) {
      fail('ref_symlink_component', `${label} traverses a symlink at ${current}`, { component: current });
    }
  }
}

// Exported for the same reason the launcher's containment guard is: once `..` is
// refused lexically, no canonical ref can resolve outside its root, so this branch
// is unreachable end to end and would be a guard no test could execute.
export function resolveInside(root, ref, escapeCode, label) {
  const abs = resolve(root, ref);
  if (abs !== join(root, ref) || !abs.startsWith(root + sep)) {
    fail(escapeCode, `${ref} does not resolve inside ${root}`);
  }
  return abs;
}

function assertProjectRef(ref) {
  const parts = assertCanonicalRef(ref, 'ref_escapes_project_root', 'policy project ref');
  if (ref !== PROJECT_POLICY_ROOT && !ref.startsWith(`${PROJECT_POLICY_ROOT}/`)) {
    fail('ref_escapes_project_root', `policy project ref ${ref} is outside ${PROJECT_POLICY_ROOT}`);
  }
  return parts;
}

// Plugin sources were previously unchecked, which let a bundle name bytes outside
// the installed plugin root as long as the digest matched.
function resolvePluginSource(pluginRoot, ref) {
  const parts = assertCanonicalRef(ref, 'plugin_source_escapes_plugin_root', 'bundle plugin_source');
  const abs = resolveInside(pluginRoot, ref, 'plugin_source_escapes_plugin_root', 'plugin_source');
  assertNoSymlinkComponents(pluginRoot, parts, `plugin_source ${ref}`);
  return abs;
}

function resolveProjectRef(projectRoot, ref) {
  const parts = assertProjectRef(ref);
  const abs = resolveInside(projectRoot, ref, 'ref_escapes_project_root', 'project ref');
  assertNoSymlinkComponents(projectRoot, parts, `project ref ${ref}`);
  return abs;
}

// ---------------------------------------------------------------------------
// Bundle verification
// ---------------------------------------------------------------------------

export function readBundle(pluginRoot) {
  const bundlePath = join(pluginRoot, 'policies', 'bundle-v1.json');
  let bytes;
  try {
    bytes = readFileSync(bundlePath);
  } catch {
    fail('bundle_source_missing', 'policies/bundle-v1.json is not installed');
  }
  const bundle = parseStrict(bytes);
  return { bundle, bundleBytes: bytes, bundleDigest: digestBytes(bytes) };
}

export function verifyBundleSources(pluginRoot) {
  const { bundle, bundleBytes, bundleDigest } = readBundle(pluginRoot);

  // Two entries naming one destination is not an ordering question to be settled
  // by whichever is written first — it is a malformed bundle. Rejecting it here,
  // before any destination is touched, is what lets materialization promise that a
  // refused bundle leaves nothing behind.
  const seenDestinations = new Set();
  for (const entry of bundle.entries) {
    if (seenDestinations.has(entry.project_ref)) {
      fail('duplicate_project_ref',
        `bundle names ${entry.project_ref} more than once`, { project_ref: entry.project_ref });
    }
    seenDestinations.add(entry.project_ref);
  }

  for (const entry of bundle.entries) {
    assertProjectRef(entry.project_ref);
    const sourceAbs = resolvePluginSource(pluginRoot, entry.plugin_source);
    let bytes;
    try {
      bytes = readFileSync(sourceAbs);
    } catch {
      fail('bundle_source_missing', `bundle entry ${entry.plugin_source} is not installed`, { entry });
    }
    const digest = digestBytes(bytes);
    if (digest !== entry.raw_digest) {
      fail('bundle_source_digest_mismatch',
        `bundle entry ${entry.plugin_source} digest ${digest} != declared ${entry.raw_digest}`, { entry });
    }
  }
  return { bundle, bundleBytes, bundleDigest };
}

// ---------------------------------------------------------------------------
// Materialization
// ---------------------------------------------------------------------------

// What a planned destination already holds. Exported so the rule can be exercised
// directly: through the public path every call is a preflight, so its rejecting
// branches would otherwise only be reachable by losing a race.
//
// Returns 'absent' or 'identical'; anything else is a typed rejection.
export function classifyDestination(abs, bytes, ref = abs) {
  let stat;
  try {
    stat = lstatSync(abs);
  } catch {
    return 'absent';
  }
  // Through `materializePolicies` this cannot fire — `resolveProjectRef` walks
  // every component of the ref, final one included, while the target list is
  // built. It is kept and typed because this function is exported: a direct
  // caller has no such walk in front of it, and answering "what does this
  // destination already hold" with a generic integrity error would be wrong.
  if (stat.isSymbolicLink()) {
    fail('ref_symlink_component',
      `${ref} exists as a symlink; policy snapshots are never written through links`,
      { project_ref: ref });
  }
  if (!stat.isFile()) {
    fail('integrity_error', `${ref} exists and is not a regular file`, { project_ref: ref });
  }
  const existing = readFileSync(abs);
  if (!existing.equals(bytes)) {
    fail('integrity_error',
      `project policy ${ref} already exists with different bytes; an upgrade requires a new versioned path`,
      { ref, existing_digest: digestBytes(existing), incoming_digest: digestBytes(bytes) });
  }
  return 'identical';
}

// Byte-for-byte, no-clobber. Same path with the same bytes is idempotent; same
// path with different bytes is an integrity error and never a silent upgrade.
// An upgrade ships new content at a new versioned path.
export function materializePolicies({ pluginRoot, projectRoot }) {
  const { bundle, bundleBytes } = verifyBundleSources(pluginRoot);

  const planned = bundle.entries.map((entry) => ({
    ref: entry.project_ref,
    bytes: readFileSync(resolvePluginSource(pluginRoot, entry.plugin_source)),
  }));
  // The bundle manifest is materialized alongside the files it lists; it cannot
  // be one of its own entries. Its project path is content-addressed, because a
  // fixed path would make every legitimate bundle upgrade collide with the
  // previous bundle — and the old bundle has to stay readable for replay.
  planned.push({ ref: bundleProjectRef(bundleBytes), bytes: bundleBytes });

  // Every destination is validated before ANY byte is written, so a rejected
  // bundle cannot leave a half-materialized policy set behind. That includes the
  // generated bundle-manifest ref, which is not one of the bundle's own entries and
  // so would otherwise escape the entry-level uniqueness check above.
  const targets = planned.map(({ ref, bytes }) => ({ ref, bytes, abs: resolveProjectRef(projectRoot, ref) }));

  // Compared on the RESOLVED path, which subsumes exact-duplicate refs and also
  // catches distinct refs that name one file — a `.`-free, symlink-free pair can
  // still collide through case folding.
  const plannedAbs = new Map();
  for (const { ref, abs } of targets) {
    const key = process.platform === 'darwin' ? abs.toLowerCase() : abs;
    if (plannedAbs.has(key)) {
      fail('duplicate_project_ref',
        `${ref} and ${plannedAbs.get(key)} resolve to the same destination`, { project_ref: ref });
    }
    plannedAbs.set(key, ref);
  }

  // Planned uniqueness is not enough. A destination that already holds different
  // bytes is equally fatal, and it used to be discovered only when its own turn
  // came round in the write loop below — by which point earlier targets had been
  // created and fsynced. The set was half materialized and the bundle rejected.
  for (const { ref, bytes, abs } of targets) {
    classifyDestination(abs, bytes, ref);
  }

  const written = [];
  const unchanged = [];
  for (const { ref, bytes, abs } of targets) {
    let result;
    try {
      result = atomicFileNoReplace({ path: abs, bytes });
    } catch (error) {
      if (error instanceof NoReplaceError) fail(error.code, error.message, error.detail);
      throw error;
    }

    if (result.outcome === 'created') {
      written.push(ref);
      continue;
    }
    // The destination existed. Preflight already classified every target, so
    // reaching here with different bytes means they changed underneath us —
    // re-asking the same question rather than restating the rule, so there is
    // exactly one place that decides what an existing destination means.
    classifyDestination(abs, bytes, ref);
    unchanged.push(ref);
  }
  return {
    written,
    unchanged,
    bundle_digest: digestBytes(bundleBytes),
    bundle_project_ref: bundleProjectRef(bundleBytes),
  };
}

// ---------------------------------------------------------------------------
// Base bundle selection for a NEW candidate
// ---------------------------------------------------------------------------

// Only a verified, host-attested active release can name the current epoch.
//
// The input is the sealed value from lib/active-release.mjs, never a string
// naming a source and never a plain manifest object. A string parameter would
// mean the authoritative branch is whatever the caller types — and with a default
// applied, whatever the caller omits.
export function selectActivationBaseBundle({
  verifiedActiveRelease,
  requestedBaseBundleDigest,
  retainedHistoricalBundleDigests = [],
}) {
  if (!isVerifiedActiveRelease(verifiedActiveRelease)) {
    fail('current_release_not_selectable_by_declaration',
      'the current release can only be named by a sealed verified-active-release value',
      { received: verifiedActiveRelease === undefined ? 'undefined' : typeof verifiedActiveRelease });
  }
  const singleton = verifiedActiveRelease.activation_base_bundle_digest;
  if (requestedBaseBundleDigest !== singleton) {
    fail('base_bundle_not_current',
      'a new candidate may select only the activation base bundle of the currently active release',
      {
        requested: requestedBaseBundleDigest,
        current: singleton,
        retained_for_replay_only: retainedHistoricalBundleDigests.includes(requestedBaseBundleDigest),
      });
  }
  return { activation_base_bundle_digest: singleton };
}

export function policyEpoch({ releaseManifestDigest, activationBaseBundleDigest }) {
  return canonicalDigest({
    release_manifest_digest: releaseManifestDigest,
    activation_base_bundle_digest: activationBaseBundleDigest,
  });
}

// A current-release change makes an *unactivated* candidate stale. It does not
// reach back into an existing activation and rewrite its questions.
//
// NOT AN AUTHORITY BOUNDARY, deliberately. `activated` and `policy_epoch` below
// are read straight off a caller-supplied object with no provenance check, which
// everywhere else in this package would be the banned pattern — a boolean the
// caller sets can never be evidence.
//
// The reason it is admissible here and nowhere else: whether a candidate is
// activated is established by the Ledger from a hash-chained `contract_activated`
// event, and the Ledger is P1. This function does not decide activation, it
// classifies an epoch given an activation state someone else established. Wiring
// it to a real consumer without that upstream check would be the defect; the
// corpus asserts the limitation so it cannot be mistaken for a guarantee.
//
// The parameter is named for what it is.
export function candidateEpochStatus({ declaredCandidateState, currentEpoch }) {
  const candidate = declaredCandidateState;
  if (candidate.activated) {
    return { status: 'activated', epoch: candidate.policy_epoch, rewritten: false };
  }
  if (candidate.policy_epoch !== currentEpoch) {
    return { status: 'policy_epoch_stale', epoch: candidate.policy_epoch, rewritten: false };
  }
  return { status: 'current', epoch: candidate.policy_epoch, rewritten: false };
}

// ---------------------------------------------------------------------------
// Historical replay
// ---------------------------------------------------------------------------

// Replays an already activated or committed feature from the snapshots that
// feature holds locally. It reads no plugin path at all — that is what makes the
// answer stable after the plugin is upgraded or removed outright.
export function replayFromLocalSnapshots({ projectRoot, activation }) {
  const resolved = [];
  for (const snapshot of activation.policy_snapshots) {
    const abs = resolveProjectRef(projectRoot, snapshot.project_ref);
    let bytes;
    try {
      bytes = readFileSync(abs);
    } catch {
      fail('snapshot_missing', `local policy snapshot ${snapshot.project_ref} is missing`, { snapshot });
    }
    const digest = digestBytes(bytes);
    if (digest !== snapshot.raw_digest) {
      fail('snapshot_tampered',
        `local policy snapshot ${snapshot.project_ref} digest ${digest} != activation-bound ${snapshot.raw_digest}`,
        { snapshot });
    }
    resolved.push({ project_ref: snapshot.project_ref, raw_digest: digest });
  }
  return {
    activation_base_bundle_digest: activation.activation_base_bundle_digest,
    policy_epoch: activation.policy_epoch,
    resolved_snapshots: resolved,
    effective_digest: canonicalDigest(resolved),
  };
}
