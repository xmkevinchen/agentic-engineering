// runtime/ae-gate-core.mjs — manifest member.
//
// FIXTURE SCOPE. The real core owns Gate truth: reducer, ledger, finalize. None
// of that is here — P0.1 freezes the bootstrap contract around the core, not the
// core. What this file demonstrates is the two properties the DAG must give it:
//
//   - it has no supported standalone CLI;
//   - every entry point independently re-verifies the capability and the exact
//     bootstrap result through the bridge, so importing the module directly buys
//     nothing. The verification is delegated to the already-verified bridge
//     precisely because the bridge holds the issue-time brand; a check the core
//     could perform on its own from the capability's own fields would be a check
//     a forger could satisfy.

import { appendFileSync, realpathSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { verifyOperationCapability } from './active-release-bridge.mjs';

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

function requireCapability(capability, bootstrapResultDigest, scope, now) {
  try {
    verifyOperationCapability(capability, { bootstrapResultDigest, requiredScope: scope, now });
  } catch (error) {
    throw new CoreError(error.code ?? 'release_not_active', error.message);
  }
}

export function run({ capability, bootstrapResultDigest, scope, now }) {
  requireCapability(capability, bootstrapResultDigest, scope, now);
  return {
    ok: true,
    fixture_only: true,
    active_release_manifest_digest: capability.active_release_manifest_digest,
    scope: capability.scope,
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
