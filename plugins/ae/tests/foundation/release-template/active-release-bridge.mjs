// runtime/active-release-bridge.mjs — manifest member.
//
// FIXTURE SCOPE. This bridge answers "which AE root does the host consider
// active" from a fixture-supplied host record, not from a real Claude Code
// plugin registry. It mints a capability marked `fixture_only` that no production
// path accepts. Qualifying a real active-release provider is P0.7/P0.8 work; the
// P0.G-lite spike established only that the host emits a session-correlated
// record on one arm.
//
// What this file does carry from the frozen design is the *shape*: attestation
// and capability are two separate, non-reorderable steps, the bearer never
// returns to a caller, and the capability binds an already-computed bootstrap
// result.

import { appendFileSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

if (process.env.AE_FIXTURE_IMPORT_LOG) {
  appendFileSync(process.env.AE_FIXTURE_IMPORT_LOG, 'import:active-release-bridge\n');
}

class BridgeError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'BridgeError';
    this.code = code;
  }
}

// The host record stands in for the plugin registry / invocation correlation the
// real provider must observe. It is deliberately NOT derived from
// CLAUDE_PLUGIN_ROOT, argv, or this module's own location.
function readHostRecord() {
  const path = process.env.AE_FIXTURE_HOST_RECORD;
  if (!path) {
    throw new BridgeError('active_release_unavailable', 'no host active-release record available');
  }
  return JSON.parse(readFileSync(path, 'utf8'));
}

export function attestActiveRoot({ observedReleaseRoot }) {
  const record = readHostRecord();
  if (!record.active_root || !record.active_release_manifest_digest) {
    throw new BridgeError('active_release_unavailable', 'host record does not identify a unique active root');
  }
  // Note what is returned: an attestation, with no bearer token in it. Minting is
  // a separate call that cannot be folded into this one.
  return {
    schema_version: 'ae.active-release-attestation.v1',
    fixture_only: true,
    active_root: record.active_root,
    active_release_manifest_digest: record.active_release_manifest_digest,
    observed_release_root: observedReleaseRoot,
    provider_build: 'fixture-bridge-v1',
  };
}

export function mintOperationCapability({ attestation, bootstrap_result_digest, active_release_manifest_digest }) {
  if (!attestation || attestation.schema_version !== 'ae.active-release-attestation.v1') {
    throw new BridgeError('invalid', 'capability requires a bridge-produced attestation');
  }
  if (!bootstrap_result_digest) {
    // The capability may not precede the bootstrap result it is supposed to bind.
    throw new BridgeError('invalid', 'capability requires an already-computed bootstrap result');
  }
  if (attestation.active_release_manifest_digest !== active_release_manifest_digest) {
    throw new BridgeError('release_not_active', 'attested digest does not match the verified manifest digest');
  }
  const bearer = createHash('sha256')
    .update(`${attestation.active_release_manifest_digest}|${bootstrap_result_digest}`)
    .digest('hex');
  return {
    schema_version: 'ae.active-release-operation.v1',
    fixture_only: true,
    active_release_manifest_digest,
    bootstrap_result_digest,
    // Internal channel only. A real bridge never hands this to a model, seat or
    // caller; here it exists so the core can independently re-verify.
    __bearer: bearer,
  };
}
