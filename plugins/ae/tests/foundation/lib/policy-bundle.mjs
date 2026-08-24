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

import { closeSync, fsyncSync, mkdirSync, openSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, join, resolve, sep } from 'node:path';
import { canonicalDigest, digestBytes, parseStrict } from './canonical-json.mjs';
import { fail } from './errors.mjs';

const PROJECT_POLICY_ROOT = '.ae/policies';

export function bundleProjectRef(bundleBytes) {
  return `${PROJECT_POLICY_ROOT}/bundles/${digestBytes(bundleBytes).replace('sha256:', '')}.json`;
}

function assertProjectRef(ref) {
  if (isAbsolute(ref)) fail('ref_escapes_project_root', `policy project ref ${ref} is absolute`);
  if (ref.split('/').includes('..')) fail('ref_escapes_project_root', `policy project ref ${ref} contains '..'`);
  if (ref !== PROJECT_POLICY_ROOT && !ref.startsWith(`${PROJECT_POLICY_ROOT}/`)) {
    fail('ref_escapes_project_root', `policy project ref ${ref} is outside ${PROJECT_POLICY_ROOT}`);
  }
  return ref;
}

function resolveInside(root, ref) {
  const abs = resolve(root, ref);
  if (abs !== join(root, ref) || !abs.startsWith(root + sep)) {
    fail('ref_escapes_project_root', `${ref} does not resolve inside ${root}`);
  }
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
  for (const entry of bundle.entries) {
    assertProjectRef(entry.project_ref);
    let bytes;
    try {
      bytes = readFileSync(join(pluginRoot, entry.plugin_source));
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

function writeDurable(absPath, bytes) {
  mkdirSync(dirname(absPath), { recursive: true });
  writeFileSync(absPath, bytes);
  const fd = openSync(absPath, 'r');
  try { fsyncSync(fd); } finally { closeSync(fd); }
  // The parent directory entry has to reach disk too, or the file can survive
  // as an unreferenced inode.
  const dirFd = openSync(dirname(absPath), 'r');
  try { fsyncSync(dirFd); } finally { closeSync(dirFd); }
}

// Byte-for-byte, no-clobber. Same path with the same bytes is idempotent; same
// path with different bytes is an integrity error and never a silent upgrade.
// An upgrade ships new content at a new versioned path.
export function materializePolicies({ pluginRoot, projectRoot }) {
  const { bundle, bundleBytes } = verifyBundleSources(pluginRoot);

  const planned = bundle.entries.map((entry) => ({
    ref: assertProjectRef(entry.project_ref),
    bytes: readFileSync(join(pluginRoot, entry.plugin_source)),
  }));
  // The bundle manifest is materialized alongside the files it lists; it cannot
  // be one of its own entries. Its project path is content-addressed, because a
  // fixed path would make every legitimate bundle upgrade collide with the
  // previous bundle — and the old bundle has to stay readable for replay.
  planned.push({ ref: assertProjectRef(bundleProjectRef(bundleBytes)), bytes: bundleBytes });

  const written = [];
  const unchanged = [];
  for (const { ref, bytes } of planned) {
    const abs = resolveInside(projectRoot, ref);
    let existing = null;
    try {
      if (statSync(abs).isFile()) existing = readFileSync(abs);
    } catch { /* absent */ }

    if (existing === null) {
      writeDurable(abs, bytes);
      written.push(ref);
      continue;
    }
    if (existing.equals(bytes)) {
      unchanged.push(ref);
      continue;
    }
    fail('integrity_error',
      `project policy ${ref} already exists with different bytes; an upgrade requires a new versioned path`,
      { ref, existing_digest: digestBytes(existing), incoming_digest: digestBytes(bytes) });
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

// Only a verified, host-attested active release can name the current epoch. The
// rollout lock records the epoch at cutover for audit; the launcher's own claim
// and any caller-supplied value are not authority.
const AUTHORITATIVE_SOURCE = 'verified_active_release';

export function selectActivationBaseBundle({
  activeReleaseManifest,
  requestedBaseBundleDigest,
  declaredBy = AUTHORITATIVE_SOURCE,
  retainedHistoricalBundleDigests = [],
}) {
  if (declaredBy !== AUTHORITATIVE_SOURCE) {
    fail('current_release_not_selectable_by_declaration',
      `${declaredBy} cannot select the current release`, { declared_by: declaredBy });
  }
  const singleton = activeReleaseManifest.activation_base_bundle_digest;
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
export function candidateEpochStatus({ candidate, currentEpoch }) {
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
    assertProjectRef(snapshot.project_ref);
    const abs = resolveInside(projectRoot, snapshot.project_ref);
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
