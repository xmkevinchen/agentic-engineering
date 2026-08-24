// runtime/active-release-bridge.mjs — manifest member.
//
// FIXTURE SCOPE. This bridge answers "which AE root does the host consider
// active" from a fixture-supplied host record, not from a real Claude Code plugin
// registry. Everything it issues is marked `fixture_only` and no production path
// accepts it. Qualifying a real active-release provider is P0.7/P0.8 work; the
// P0.G-lite spike established only that the host emits a session-correlated
// record on one arm.
//
// What this file does carry from the frozen design is the authority shape:
//
//   - attestation and capability are two separate, non-reorderable steps;
//   - neither can be constructed from plain caller data. Both are branded on
//     issue and checked against that brand, so a structurally perfect object
//     literal is not a capability;
//   - minting requires a bootstrap result the bridge can independently re-check
//     against the attested identity, not a caller-supplied digest;
//   - a capability binds an exact scope, a nonce and an expiry, so replay into a
//     different operation fails even with the right bootstrap result;
//   - the bearer never leaves the bridge.
//
// Honest boundary: this defends against a caller that holds only public data. It
// does not, and cannot, defend against code running as the same OS user that
// simply calls these functions itself — that remains inside the threat boundary
// finalized/design.md declares, and is not papered over with a fake signature.

import { appendFileSync, readFileSync, realpathSync } from 'node:fs';
import { createHash, randomBytes } from 'node:crypto';

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

// Module-private brands. Membership cannot be forged from outside this module,
// and a fresh process starts with both empty — which is what makes a direct
// `import(core)` unable to present a capability.
const ATTESTED = new WeakSet();
const MINTED = new WeakSet();

const SCOPE_KEYS = ['repo', 'feature_id', 'purpose', 'host_operation'];
const DEFAULT_TTL_MS = 60_000;

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
  let identity;
  try {
    identity = realpathSync(record.active_root);
  } catch {
    throw new BridgeError('active_release_unavailable', 'host active root does not resolve');
  }
  // No bearer here, and minting is a separate call that cannot be folded in.
  const attestation = Object.freeze({
    schema_version: 'ae.active-release-attestation.v1',
    fixture_only: true,
    active_root: record.active_root,
    active_root_identity: identity,
    active_release_manifest_digest: record.active_release_manifest_digest,
    observed_release_root: observedReleaseRoot,
    provider_build: 'fixture-bridge-v1',
  });
  ATTESTED.add(attestation);
  return attestation;
}

export function mintOperationCapability({ attestation, bootstrapResult, scope, issuedAt, ttlMs }) {
  if (!attestation || typeof attestation !== 'object' || !ATTESTED.has(attestation)) {
    throw new BridgeError('capability_not_minted',
      'capability requires an attestation this bridge produced; a caller-supplied one is not authority');
  }
  if (!bootstrapResult || typeof bootstrapResult !== 'object') {
    // The capability may not precede the bootstrap result it is supposed to bind.
    throw new BridgeError('capability_not_minted', 'capability requires an already-computed bootstrap result');
  }

  const { manifest_digest: manifestDigest, root_identity: rootIdentity } = bootstrapResult;
  const bootstrapResultDigest = bootstrapResult.bootstrap_result_digest;
  if (!manifestDigest || !rootIdentity || !bootstrapResultDigest) {
    throw new BridgeError('capability_not_minted', 'bootstrap result is incomplete');
  }

  // Re-checked here rather than trusted: both halves of the active identity must
  // agree with what the host attested, so a fabricated bootstrap result cannot
  // name a release this host is not running.
  if (attestation.active_release_manifest_digest !== manifestDigest) {
    throw new BridgeError('release_not_active', 'attested digest does not match the verified manifest digest');
  }
  if (attestation.active_root_identity !== rootIdentity) {
    throw new BridgeError('release_not_active', 'attested active root is not the verified release root');
  }

  for (const key of SCOPE_KEYS) {
    if (!scope || !Object.prototype.hasOwnProperty.call(scope, key)) {
      throw new BridgeError('capability_scope_mismatch', `capability scope is missing ${key}`);
    }
  }

  const now = issuedAt ?? Date.now();
  const capability = Object.freeze({
    schema_version: 'ae.active-release-operation.v1',
    fixture_only: true,
    active_release_manifest_digest: manifestDigest,
    active_root_identity: rootIdentity,
    bootstrap_result_digest: bootstrapResultDigest,
    scope: Object.freeze(Object.fromEntries(SCOPE_KEYS.map((k) => [k, scope[k]]))),
    nonce: randomBytes(16).toString('hex'),
    issued_at: now,
    expires_at: now + (ttlMs ?? DEFAULT_TTL_MS),
  });
  MINTED.add(capability);
  return capability;
}

// Every core entry point calls this independently. Membership in MINTED is the
// part that cannot be reconstructed from public data; the remaining checks make a
// genuine capability inert outside the bootstrap result and scope it was issued for.
export function verifyOperationCapability(capability, { bootstrapResultDigest, requiredScope, now }) {
  if (!capability || typeof capability !== 'object' || !MINTED.has(capability)) {
    throw new BridgeError('capability_not_minted', 'capability was not minted by this bridge');
  }
  if (capability.bootstrap_result_digest !== bootstrapResultDigest) {
    throw new BridgeError('capability_bootstrap_mismatch',
      'capability is not bound to this bootstrap result');
  }
  const at = now ?? Date.now();
  if (at > capability.expires_at) {
    throw new BridgeError('capability_expired', 'capability has expired');
  }
  for (const key of SCOPE_KEYS) {
    if (!requiredScope || capability.scope[key] !== requiredScope[key]) {
      throw new BridgeError('capability_scope_mismatch',
        `capability scope ${key} does not match the requested operation`);
    }
  }
  return true;
}

// Exported so the fixture can build a capability that is genuinely minted but for
// a different scope or bootstrap result — the replay and wrong-scope negatives.
export const CAPABILITY_SCOPE_KEYS = Object.freeze([...SCOPE_KEYS]);

export function attestationDigest(attestation) {
  return `sha256:${createHash('sha256').update(JSON.stringify(attestation)).digest('hex')}`;
}
