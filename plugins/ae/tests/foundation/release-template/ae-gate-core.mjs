// runtime/ae-gate-core.mjs — manifest member.
//
// FIXTURE SCOPE. The real core owns Gate truth: reducer, ledger, finalize. None
// of that is here — P0.1 freezes the bootstrap contract around the core, not the
// core. What this file demonstrates is the two properties the DAG must give it:
//
//   - it has no supported standalone CLI;
//   - every entry point independently re-verifies the capability and the exact
//     bootstrap result, so importing the module directly buys nothing.

import { appendFileSync, realpathSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';

if (process.env.AE_FIXTURE_IMPORT_LOG) {
  appendFileSync(process.env.AE_FIXTURE_IMPORT_LOG, 'import:ae-gate-core\n');
}

class CoreError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'CoreError';
    this.code = code;
  }
}

function requireCapability(capability, bootstrapResultDigest) {
  if (!capability || capability.schema_version !== 'ae.active-release-operation.v1') {
    throw new CoreError('release_not_active', 'core entry point requires an active-release capability');
  }
  if (capability.bootstrap_result_digest !== bootstrapResultDigest) {
    throw new CoreError('release_not_active', 'capability is not bound to this bootstrap result');
  }
  const expected = createHash('sha256')
    .update(`${capability.active_release_manifest_digest}|${capability.bootstrap_result_digest}`)
    .digest('hex');
  if (capability.__bearer !== expected) {
    throw new CoreError('release_not_active', 'capability bearer does not verify');
  }
}

export function run({ capability, bootstrap_result_digest }) {
  requireCapability(capability, bootstrap_result_digest);
  return {
    ok: true,
    fixture_only: true,
    active_release_manifest_digest: capability.active_release_manifest_digest,
  };
}

// Direct invocation is unsupported, and says so rather than doing something
// partial. `node runtime/ae-gate-core.mjs` is not a way into the Gate.
function invokedDirectly() {
  if (!process.argv[1]) return false;
  try {
    return pathToFileURL(realpathSync(process.argv[1])).href === import.meta.url;
  } catch {
    return false;
  }
}

if (invokedDirectly()) {
  process.stdout.write(`${JSON.stringify({ error: 'unsupported_direct_invocation' })}\n`);
  process.exit(1);
}
