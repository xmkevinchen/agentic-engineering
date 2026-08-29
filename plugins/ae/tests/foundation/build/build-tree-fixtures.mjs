// Freezes the expected entry projections for fixtures/v1-foundation/tree-snapshot.
//
// The *snapshot* digest binds the subject root, which is an absolute path and a
// device id — machine-dependent, so it cannot be a checked-in constant. The
// *entry projection* digest is machine-independent and is what gets frozen here,
// along with the explicit path list per profile so the include/exclude boundary
// is reviewable by reading the fixture rather than by running it.
//
//   node plugins/ae/tests/foundation/build/build-tree-fixtures.mjs

import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ALGORITHM, PROFILE_NAMES, entriesProjectionDigest, observeTree } from '../lib/tree-snapshot.mjs';
import { LOGICAL_ROOT, materializeTree } from '../corpus/tree-corpus.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, '..', '..', 'fixtures', 'v1-foundation', 'tree-snapshot');

const work = mkdtempSync(join(tmpdir(), 'ae-tree-build-'));
try {
  const root = materializeTree(join(work, 'F-100-billing-export'));
  const profiles = {};
  for (const profile of PROFILE_NAMES) {
    const snapshot = observeTree({ logicalRoot: LOGICAL_ROOT, resolvedRootPath: root, profile });
    profiles[profile] = {
      entry_count: snapshot.entries.length,
      entries_projection_digest: entriesProjectionDigest(snapshot),
      paths: snapshot.entries.map((e) => `${e.type === 'directory' ? 'd' : 'f'} ${e.path}`),
    };
  }

  const expected = {
    schema_version: 'ae.fixture.tree-snapshot.v1',
    algorithm: ALGORITHM,
    logical_root: LOGICAL_ROOT,
    profiles,
  };
  writeFileSync(join(OUT, 'expected.json'), `${JSON.stringify(expected, null, 2)}\n`);
  process.stdout.write(`wrote expected.json for ${PROFILE_NAMES.length} profiles\n`);
} finally {
  rmSync(work, { recursive: true, force: true });
}
