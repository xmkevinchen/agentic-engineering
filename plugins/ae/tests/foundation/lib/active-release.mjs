// The verified-active-release value.
//
// Selecting the current release is an authority decision, so its input cannot be
// a string a caller chooses or a plain object a caller writes. `sealVerifiedActiveRelease`
// is the only way to produce one, and it will not seal anything it cannot
// re-derive:
//
//   - the manifest must actually canonicalize to the digest claimed for it;
//   - the host attestation must agree on BOTH the manifest digest and the
//     resolved root identity;
//   - the activation base bundle digest must be the one the manifest carries.
//
// The result is frozen and branded. A structurally perfect object literal is not
// a verified active release, and `isVerifiedActiveRelease` says so.
//
// Honest boundary: like the bridge brand, this stops a caller holding only public
// data. Code running as the same OS user can call the sealer itself, and
// finalized/design.md already places that inside the accepted threat boundary.

import { canonicalDigest } from './canonical-json.mjs';
import { fail } from './errors.mjs';

const VERIFIED = new WeakSet();

export function sealVerifiedActiveRelease({ manifest, attestation, rootIdentity, bootstrapResultDigest }) {
  if (!manifest || typeof manifest !== 'object') {
    fail('current_release_not_selectable_by_declaration', 'no release manifest to verify');
  }
  if (!attestation || typeof attestation !== 'object') {
    fail('current_release_not_selectable_by_declaration', 'no host attestation to verify against');
  }

  const manifestDigest = canonicalDigest(manifest);
  if (attestation.active_release_manifest_digest !== manifestDigest) {
    fail('current_release_not_selectable_by_declaration',
      'attested manifest digest does not match the manifest bytes',
      { attested: attestation.active_release_manifest_digest, computed: manifestDigest });
  }
  if (!rootIdentity || attestation.active_root_identity !== rootIdentity) {
    fail('current_release_not_selectable_by_declaration',
      'attested active root is not the verified release root');
  }
  if (typeof bootstrapResultDigest !== 'string' || bootstrapResultDigest.length === 0) {
    fail('current_release_not_selectable_by_declaration', 'no bootstrap result to bind');
  }
  if (typeof manifest.activation_base_bundle_digest !== 'string') {
    fail('current_release_not_selectable_by_declaration', 'manifest carries no activation base bundle digest');
  }

  const sealed = Object.freeze({
    schema_version: 'ae.verified-active-release.v1',
    release_manifest_digest: manifestDigest,
    activation_base_bundle_digest: manifest.activation_base_bundle_digest,
    root_identity: rootIdentity,
    bootstrap_result_digest: bootstrapResultDigest,
  });
  VERIFIED.add(sealed);
  return sealed;
}

export function isVerifiedActiveRelease(value) {
  return typeof value === 'object' && value !== null && VERIFIED.has(value);
}
