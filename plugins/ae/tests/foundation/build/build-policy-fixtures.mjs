// Generator for fixtures/v1-foundation/policy-bundle.
//
// Three plugin policy trees:
//
//   release-a          the baseline bundle
//   release-b          a legitimate upgrade: new content at a NEW versioned path,
//                      every retained file byte-identical to release-a
//   release-c-bad      an illegitimate upgrade: same path, different bytes
//
// release-b is what makes the "upgrades require new content/versioned paths" rule
// testable in the affirmative; release-c-bad is the rejection.
//
//   node plugins/ae/tests/foundation/build/build-policy-fixtures.mjs

import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { canonicalize, digestBytes } from '../lib/canonical-json.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, '..', '..', 'fixtures', 'v1-foundation', 'policy-bundle');

// Policy content is deliberately inert. These files exist to be copied, digested
// and refused, not to be interpreted: the Gate reads the *bytes*, and P0.2 owns
// the authoritative schema for what is inside them.
const RUNNER_V1 = {
  schema_version: 'ae.runner-policy.v1',
  policy_version: '1.0.0',
  providers: [],
};
const RUNNER_V2 = {
  schema_version: 'ae.runner-policy.v1',
  policy_version: '2.0.0',
  providers: [],
};
const ADAPTERS_V1 = {
  schema_version: 'ae.adapter-registry.v1',
  policy_version: '1.0.0',
  adapters: [],
};
const FLOOR_V1 = {
  schema_version: 'ae.floor-policy.v1',
  id: 'code-regression-v1',
  policy_version: '1.0.0',
};

function bundleFor(files) {
  return {
    schema_version: 'ae.policy-bundle.v1',
    bundle_version: '1.0.0',
    entries: files.map(({ source, ref, bytes }) => ({
      plugin_source: source,
      project_ref: ref,
      raw_digest: digestBytes(bytes),
      length: bytes.length,
    })),
  };
}

function writeTree(name, files) {
  const root = join(OUT, name);
  rmSync(root, { recursive: true, force: true });
  for (const file of files) {
    const abs = join(root, file.source);
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, file.bytes);
  }
  const bundleBytes = canonicalize(bundleFor(files));
  writeFileSync(join(root, 'policies', 'bundle-v1.json'), bundleBytes);
  return { root, bundleDigest: digestBytes(bundleBytes) };
}

const file = (source, ref, value) => ({ source, ref, bytes: canonicalize(value) });

const RELEASE_A = [
  file('policies/runner-v1.json', '.ae/policies/runner-v1.json', RUNNER_V1),
  file('policies/adapters-v1.json', '.ae/policies/adapters-v1.json', ADAPTERS_V1),
  file('policies/floors/code-regression-v1.json', '.ae/policies/floors/code-regression-v1.json', FLOOR_V1),
];

// Upgrade done correctly: runner-v1 keeps its exact bytes, the new policy arrives
// as runner-v2 at its own path.
const RELEASE_B = [
  file('policies/runner-v1.json', '.ae/policies/runner-v1.json', RUNNER_V1),
  file('policies/runner-v2.json', '.ae/policies/runner-v2.json', RUNNER_V2),
  file('policies/adapters-v1.json', '.ae/policies/adapters-v1.json', ADAPTERS_V1),
  file('policies/floors/code-regression-v1.json', '.ae/policies/floors/code-regression-v1.json', FLOOR_V1),
];

// Upgrade done wrongly: v2 content published over the v1 path.
const RELEASE_C_BAD = [
  file('policies/runner-v1.json', '.ae/policies/runner-v1.json', RUNNER_V2),
  file('policies/adapters-v1.json', '.ae/policies/adapters-v1.json', ADAPTERS_V1),
  file('policies/floors/code-regression-v1.json', '.ae/policies/floors/code-regression-v1.json', FLOOR_V1),
];

const a = writeTree('release-a', RELEASE_A);
const b = writeTree('release-b', RELEASE_B);
const c = writeTree('release-c-bad', RELEASE_C_BAD);

const index = {
  schema_version: 'ae.fixture.policy-bundle.v1',
  trees: {
    'release-a': { bundle_digest: a.bundleDigest, entry_count: RELEASE_A.length },
    'release-b': { bundle_digest: b.bundleDigest, entry_count: RELEASE_B.length },
    'release-c-bad': { bundle_digest: c.bundleDigest, entry_count: RELEASE_C_BAD.length },
  },
};
writeFileSync(join(OUT, 'index.json'), `${JSON.stringify(index, null, 2)}\n`);
process.stdout.write(`wrote 3 policy trees\n`);
