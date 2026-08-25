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
// The same standalone validator the launcher embeds. The launcher cannot import
// it — that is the cycle the DAG breaks — but this provider can, and must: a
// producer that brands releases the launcher would refuse is a second, weaker
// definition of "verified release" living in the tree slated for promotion.
import { validateReleaseManifest } from './release-manifest-v1.validator.mjs';
import { canonicalize, digestBytes, parseStrict } from './canonical-json.mjs';
import { fail } from './errors.mjs';
import { deepFreeze } from './freeze.mjs';

// Roles the launcher requires exactly one of. Kept beside the launcher's own list
// deliberately: agreement between the two is asserted by the corpus, not assumed.
const SINGLETON_ROLES = Object.freeze(['standalone_validator', 'active_release_bridge', 'runtime_core']);
const LAUNCHER_REF = 'runtime/ae-gate.mjs';

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

// Launcher step 6, reproduced. A ref must be plugin-relative, canonical, inside
// the root, and free of symlink components at every existing level.
function resolveMemberRef(releaseRoot, ref) {
  if (typeof ref !== 'string' || ref === '' || ref.startsWith('/')
    || ref.split('/').some((part) => part === '' || part === '.' || part === '..')) {
    fail('member_ref_non_canonical', `member ref ${ref} is not a canonical plugin-relative ref`);
  }
  // Containment follows from canonicality: a ref with no leading slash and no
  // `.`, `..` or empty component cannot resolve outside the root, so a separate
  // escape check here could never fire.
  const abs = join(releaseRoot, ref);
  const parts = ref.split('/');
  for (let i = 0; i < parts.length; i += 1) {
    const partial = join(releaseRoot, ...parts.slice(0, i + 1));
    let stat;
    try {
      stat = lstatSync(partial);
    } catch {
      fail('bootstrap_result_not_derived', `member ${ref} is not installed`);
    }
    if (stat.isSymbolicLink()) {
      fail('member_ref_symlink', `member ref ${ref} traverses a symlink`);
    }
  }
  return abs;
}

// Everything the launcher establishes about a manifest before it will import a
// single member, minus the digest comparison against its own embedded constant —
// that one is the launcher's alone, because only the launcher was built for one
// specific manifest.
//
// This exists because the two paths disagreed: the launcher refused an
// unknown-field manifest with `schema_invalid` while this provider branded the
// same tree and let it be sealed as the verified current release. `lib/` is the
// tree slated for promotion into the runtime, so the weaker definition was the
// one that would have shipped.
function assertClosedManifest(manifest, releaseRoot) {
  if (Object.prototype.hasOwnProperty.call(manifest, 'self_digest')) {
    fail('manifest_has_self_digest', 'release manifest carries a self_digest field');
  }
  if (!validateReleaseManifest(manifest)) {
    const first = (validateReleaseManifest.errors ?? [])[0];
    fail('schema_invalid',
      `release manifest failed closed validation: ${first ? `${first.instancePath} ${first.message}` : 'unknown'}`);
  }

  // Uniqueness is over the resolved identity, not the ref string: a `.` alias or
  // case folding on a case-insensitive volume would otherwise let one member's
  // bytes satisfy two declared digests.
  const seenRefs = new Set();
  const seenIdentities = new Map();
  const resolved = [];
  // Repeated ref strings are covered by the identity check below rather than by a
  // separate string comparison: two spellings of one ref resolve to one inode, and
  // so does the same spelling twice.
  for (const member of manifest.members) {
    seenRefs.add(member.ref);
    const abs = resolveMemberRef(releaseRoot, member.ref);
    const st = statSync(abs);
    const identity = `${st.dev}:${st.ino}`;
    if (seenIdentities.has(identity)) {
      fail('member_ref_duplicate',
        `member refs ${seenIdentities.get(identity)} and ${member.ref} resolve to the same file`);
    }
    seenIdentities.set(identity, member.ref);
    resolved.push({ member, abs });
  }
  if (seenRefs.has(LAUNCHER_REF)) {
    fail('launcher_is_member', 'the bootstrap launcher is listed as a manifest member');
  }
  for (const role of SINGLETON_ROLES) {
    const found = manifest.members.filter((m) => m.role === role);
    if (found.length !== 1) {
      fail('schema_invalid', `expected exactly one ${role} member, found ${found.length}`);
    }
  }
  return resolved;
}

// Observes which root the host considers active, then derives that root's identity
// and manifest digest from the root itself.
export function observeActiveRoot({ hostRecordPath }) {
  let record;
  try {
    record = JSON.parse(readFileSync(hostRecordPath, 'utf8'));
  } catch {
    // `guard` names which rule refused, because the next one shares this code and
    // would otherwise stand in for it. The message is a diagnostic and the
    // taxonomy allows it to gain detail, so nothing asserts on the prose.
    fail('active_release_unavailable', 'no host active-release record available',
      { guard: 'no_host_record' });
  }
  if (!record.active_root) {
    fail('active_release_unavailable', 'host record does not identify a unique active root',
      { guard: 'no_unique_active_root' });
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

  // Closed validation first, on the same terms the launcher applies it. Nothing
  // below may run against a manifest the launcher would have refused.
  const resolved = assertClosedManifest(manifest, identity);

  for (const { member, abs } of resolved) {
    let bytes;
    try {
      bytes = readFileSync(abs);
    } catch {
      fail('bootstrap_result_not_derived', `member ${member.ref} is not installed`);
    }
    // Declared length carries its own code. Folding it into the digest branch
    // would make it unobservable — the digest comparison catches the same inputs
    // a moment later, so the check could be deleted while the suite stayed green.
    if (bytes.length !== member.length) {
      fail('member_length_mismatch',
        `member ${member.ref} length ${bytes.length} != declared ${member.length}`);
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
