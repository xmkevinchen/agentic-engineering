// The active-release observation boundary.
//
// FIXTURE SCOPE. This is not the real host/package provider — that is P0.7/P0.8,
// along with the live interactive/`-p`/SDK mode matrix, old caches, old sessions
// and reload behaviour. Nothing here is a qualification result.
//
// What it establishes is the consumer contract P0.1 owes now: every field is
// DERIVED from observed state, and none is accepted from the caller.
//
// The distinction that matters: the host record says which root the host
// considers active — that is genuinely the host's answer, and the only thing the
// fixture stands in for. It does NOT say what that root's manifest digest is.
// That is read off the root itself. A caller who controls the record can
// therefore choose which installed release is active; they cannot invent a
// release, or claim a digest the bytes on disk do not have.

import { lstatSync, readFileSync, readdirSync, realpathSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { canonicalize, digestBytes, parseStrict } from './canonical-json.mjs';
import { fail } from './errors.mjs';
import { deepFreeze } from './freeze.mjs';

const ATTESTATIONS = new WeakSet();
const BOOTSTRAP_RESULTS = new WeakSet();

export function isObservedAttestation(value) {
  return typeof value === 'object' && value !== null && ATTESTATIONS.has(value);
}

export function isVerifiedBootstrapResult(value) {
  return typeof value === 'object' && value !== null && BOOTSTRAP_RESULTS.has(value);
}

function readManifest(releaseRoot) {
  const manifestPath = join(releaseRoot, 'release-manifest-v1.json');
  let bytes;
  try {
    bytes = readFileSync(manifestPath);
  } catch {
    fail('active_release_unavailable', `no release manifest at ${releaseRoot}`);
  }
  const manifest = parseStrict(bytes);
  const canonicalBytes = canonicalize(manifest);
  if (!canonicalBytes.equals(bytes)) {
    // The installed manifest must already be in canonical form; otherwise its raw
    // bytes and its authoritative digest disagree and nothing downstream is stable.
    fail('active_release_unavailable', 'installed release manifest is not canonical');
  }
  return { manifest, digest: digestBytes(canonicalBytes) };
}

// Observes which root the host considers active, then derives that root's identity
// and manifest digest from the root itself.
export function observeActiveRoot({ hostRecordPath }) {
  let record;
  try {
    record = JSON.parse(readFileSync(hostRecordPath, 'utf8'));
  } catch {
    fail('active_release_unavailable', 'no host active-release record available');
  }
  if (!record.active_root) {
    fail('active_release_unavailable', 'host record does not identify a unique active root');
  }

  let identity;
  try {
    identity = realpathSync(record.active_root);
  } catch {
    fail('active_release_unavailable', 'host active root does not resolve');
  }
  if (!lstatSync(identity).isDirectory()) {
    fail('active_release_unavailable', 'host active root is not a directory');
  }

  // Derived, never read from the record. Any digest the record happens to carry is
  // ignored on purpose.
  const { digest } = readManifest(identity);

  const attestation = deepFreeze({
    schema_version: 'ae.active-release-attestation.v1',
    fixture_only: true,
    active_root_identity: identity,
    active_release_manifest_digest: digest,
    provider_build: 'fixture-active-release-provider-v1',
  });
  ATTESTATIONS.add(attestation);
  return attestation;
}

// Verifies an installed release and derives its bootstrap result. Every member's
// raw digest is recomputed, so a "bootstrap result" cannot be produced for a
// release whose bytes do not match its manifest.
export function verifyBootstrap({ releaseRoot }) {
  let identity;
  try {
    identity = realpathSync(releaseRoot);
  } catch {
    fail('active_release_unavailable', `release root ${releaseRoot} does not resolve`);
  }
  const { manifest, digest } = readManifest(identity);

  for (const member of manifest.members ?? []) {
    const abs = join(identity, member.ref);
    let bytes;
    try {
      bytes = readFileSync(abs);
    } catch {
      fail('bootstrap_result_not_derived', `member ${member.ref} is not installed`);
    }
    if (digestBytes(bytes) !== member.raw_digest) {
      fail('bootstrap_result_not_derived', `member ${member.ref} does not match its declared digest`);
    }
  }

  // The activation base bundle must BE one of the members just rehashed. The
  // launcher enforces this at its step 7b; without the same check here, `lib/` —
  // the code slated for promotion into plugins/ae/runtime/ — would hand out a
  // bootstrap result whose base digest names nothing on disk, and every policy
  // decision downstream would bind to a number no bytes produced.
  const baseMembers = (manifest.members ?? [])
    .filter((m) => m.ref === manifest.activation_base_bundle_ref);
  if (baseMembers.length !== 1) {
    fail('activation_base_member_mismatch',
      `activation_base_bundle_ref ${manifest.activation_base_bundle_ref} matches ${baseMembers.length} members`);
  }
  if (baseMembers[0].role !== 'policy') {
    fail('activation_base_member_mismatch',
      `activation base bundle member has role ${baseMembers[0].role}, expected policy`);
  }
  if (baseMembers[0].raw_digest !== manifest.activation_base_bundle_digest) {
    fail('activation_base_member_mismatch',
      'activation_base_bundle_digest does not match its member raw digest',
      { declared: manifest.activation_base_bundle_digest, member: baseMembers[0].raw_digest });
  }

  // A directory holding a manifest and matching members is not yet a release: the
  // release's own launcher must have been built against this exact manifest. This
  // is the DAG invariant, checked rather than assumed.
  //
  // It does NOT establish that the release is trustworthy — a caller who can build
  // a release can build a matching launcher. See the trust-class note in the freeze
  // record; anchoring a root to the running process is the launcher's property and
  // cannot be reproduced by an in-process helper.
  let launcherSource;
  try {
    launcherSource = readFileSync(join(identity, 'runtime', 'ae-gate.mjs'), 'utf8');
  } catch {
    fail('release_launcher_not_bound', 'release root has no bootstrap launcher');
  }
  const embedded = launcherSource.match(/EXPECTED_RELEASE_MANIFEST_DIGEST = '(sha256:[0-9a-f]{64})'/);
  if (!embedded) {
    fail('release_launcher_not_bound', 'launcher carries no embedded manifest digest');
  }
  if (embedded[1] !== digest) {
    fail('release_launcher_not_bound',
      'launcher was built for a different manifest than the one installed here',
      { embedded: embedded[1], installed: digest });
  }

  const result = deepFreeze({
    schema_version: 'ae.bootstrap-result.v1',
    fixture_only: true,
    manifest,
    manifest_digest: digest,
    root_identity: identity,
    member_count: (manifest.members ?? []).length,
    bootstrap_result_digest: digestBytes(
      Buffer.from(`${digest}|${identity}|${(manifest.members ?? []).length}`, 'utf8'),
    ),
  });
  BOOTSTRAP_RESULTS.add(result);
  return result;
}

// Exported for the corpus: proves the provider reads the tree rather than a
// caller's description of it.
export function countInstalledFiles(releaseRoot) {
  const walk = (dir) => readdirSync(dir).flatMap((name) => {
    const abs = join(dir, name);
    return statSync(abs).isDirectory() ? walk(abs) : [abs];
  });
  return walk(realpathSync(releaseRoot)).length;
}
