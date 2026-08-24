// Runs the whole v1 foundation freeze corpus.
//
//   node plugins/ae/tests/foundation/bin/verify-all.mjs [--verbose]
//
// Exit 0 = every check reproduced its expected result.

import { report } from './harness.mjs';
import { run as canonicalBytes } from './verify-canonical-bytes.mjs';
import { run as validator } from './verify-validator.mjs';
import { run as treeSnapshot } from './verify-tree-snapshot.mjs';
import { run as releaseBootstrap } from './verify-release-bootstrap.mjs';
import { run as policyBundle } from './verify-policy-bundle.mjs';
import { run as semanticBlind } from './verify-semantic-blind.mjs';

const sections = [
  canonicalBytes(),
  validator(),
  treeSnapshot(),
  await releaseBootstrap(),
  policyBundle(),
  semanticBlind(),
];

process.exit(report(sections, { verbose: process.argv.includes('--verbose') }) === 0 ? 0 : 1);
