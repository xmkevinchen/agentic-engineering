// The feature tree the tree-snapshot corpus is computed over.
//
// Shared by build/build-tree-fixtures.mjs (which freezes the expected entry
// projections) and bin/verify-tree-snapshot.mjs (which reproduces them). Modes
// are set explicitly on every node: an inherited umask would otherwise make the
// frozen digests machine-dependent.
//
// The layout deliberately contains one file of every interesting kind relative to
// the feature_evidence include set:
//
//   authority/**, contract/**, runs/**   included prefix roots
//   ledger/events.ndjson, head.json      included exact files
//   origin-marker.json                   the feature-internal origin marker
//   ledger/telemetry.ndjson              excluded, sibling of included files
//   index.md, plan.md, state/status.json excluded

import { chmodSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

const FILE_MODE = 0o644;
const DIR_MODE = 0o755;

export const FILES = [
  ['index.md', '# F-100 Billing Export\n'],
  ['plan.md', '## Plan\n'],
  ['origin-marker.json', '{"feature_id":"F-100","origin_nonce":"n-0001"}'],
  ['contract/contract-v1.json', '{"feature_id":"F-100","revision":"R0001"}'],
  ['contract/policies/extensions/abc/ext.json', '{"floor_id":"ext-abc"}'],
  ['authority/current.json', '{"pointer":"EV-000007"}'],
  ['authority/releases/deadbeef.json', '{"release_id":"ae-gate-fixture"}'],
  ['ledger/events.ndjson', '{"event_id":"EV-000001"}\n{"event_id":"EV-000002"}\n'],
  ['ledger/head.json', '{"ledger_seq":2}'],
  ['ledger/telemetry.ndjson', '{"metric":"tokens","value":1234}\n'],
  ['runs/RUN-001/events/EV-000002.json', '{"payload":"observed"}'],
  ['runs/RUN-001/stdout.txt', 'ok\n'],
  ['state/status.json', '{"status":"active"}'],
];

// Directories are entries too, so they are created explicitly rather than left
// to whatever order the file writes happen to imply.
export const DIRECTORIES = [
  'authority',
  'authority/releases',
  'contract',
  'contract/policies',
  'contract/policies/extensions',
  'contract/policies/extensions/abc',
  'ledger',
  'runs',
  'runs/RUN-001',
  'runs/RUN-001/events',
  'state',
];

export function materializeTree(root) {
  mkdirSync(root, { recursive: true });
  chmodSync(root, DIR_MODE);
  for (const rel of DIRECTORIES) {
    const abs = join(root, rel);
    mkdirSync(abs, { recursive: true });
  }
  for (const [rel, content] of FILES) {
    const abs = join(root, rel);
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, content);
    chmodSync(abs, FILE_MODE);
  }
  // Applied after the files so a mkdirSync -p along the way cannot leave a
  // parent at the process umask.
  for (const rel of DIRECTORIES) chmodSync(join(root, rel), DIR_MODE);
  return root;
}

export const LOGICAL_ROOT = '.ae/features/active/F-100-billing-export';
