// The verified-active-release value.
//
// Selecting the current release is an authority decision, so its input cannot be
// a string a caller chooses, a plain object a caller writes, or a set of plain
// objects a caller makes agree with each other. Internal consistency is not
// provenance: an attestation and a bootstrap result that a caller authored will
// always agree if the caller wants them to.
//
// So this module seals nothing it did not receive from a producer. Both inputs
// must carry the provenance brand of lib/active-release-provider.mjs, which
// derives every field by reading the installed release rather than accepting it.
// There is no parameter here for the manifest, the root identity, or the
// bootstrap digest — they come from the bootstrap result, which had to be earned.
//
// Honest boundary: the fixture provider stands in for a real host/package
// provider, and P0.7/P0.8 own that. What is established now is the consumer
// contract — that plain caller data cannot become `verified` — not that the
// fixture provider's observation is trustworthy for release.

import { isObservedAttestation, isVerifiedBootstrapResult } from './active-release-provider.mjs';
import { fail } from './errors.mjs';

const VERIFIED = new WeakSet();

export function sealVerifiedActiveRelease({ attestation, bootstrapResult }) {
  if (!isObservedAttestation(attestation)) {
    fail('attestation_not_observed',
      'the active-release attestation was not produced by an active-release provider');
  }
  if (!isVerifiedBootstrapResult(bootstrapResult)) {
    fail('bootstrap_result_not_derived',
      'the bootstrap result was not derived by verifying an installed release');
  }

  // Both were derived independently — from the host's answer and from the release
  // root respectively — so requiring them to agree is a real cross-check rather
  // than a restatement of one caller input.
  if (attestation.active_release_manifest_digest !== bootstrapResult.manifest_digest) {
    fail('current_release_not_selectable_by_declaration',
      'the attested active release is not the release that was verified',
      {
        attested: attestation.active_release_manifest_digest,
        verified: bootstrapResult.manifest_digest,
      });
  }
  if (attestation.active_root_identity !== bootstrapResult.root_identity) {
    fail('current_release_not_selectable_by_declaration',
      'the attested active root is not the root that was verified',
      { attested: attestation.active_root_identity, verified: bootstrapResult.root_identity });
  }

  const activationBaseBundleDigest = bootstrapResult.manifest?.activation_base_bundle_digest;
  if (typeof activationBaseBundleDigest !== 'string') {
    fail('current_release_not_selectable_by_declaration',
      'the verified release manifest carries no activation base bundle digest');
  }

  const sealed = Object.freeze({
    schema_version: 'ae.verified-active-release.v1',
    release_manifest_digest: bootstrapResult.manifest_digest,
    activation_base_bundle_digest: activationBaseBundleDigest,
    root_identity: bootstrapResult.root_identity,
    bootstrap_result_digest: bootstrapResult.bootstrap_result_digest,
  });
  VERIFIED.add(sealed);
  return sealed;
}

export function isVerifiedActiveRelease(value) {
  return typeof value === 'object' && value !== null && VERIFIED.has(value);
}
