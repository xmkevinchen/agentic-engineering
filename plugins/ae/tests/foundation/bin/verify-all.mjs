// Runs the whole v1 foundation freeze corpus.
//
//   node plugins/ae/tests/foundation/bin/verify-all.mjs [--verbose]
//
// Exit 0 = every check reproduced its expected result.

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Checks, report } from './harness.mjs';
import { run as canonicalBytes } from './verify-canonical-bytes.mjs';
import { run as validator } from './verify-validator.mjs';
import { run as treeSnapshot } from './verify-tree-snapshot.mjs';
import { run as releaseBootstrap } from './verify-release-bootstrap.mjs';
import { run as policyBundle } from './verify-policy-bundle.mjs';
import { run as semanticBlind } from './verify-semantic-blind.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const FLOOR = JSON.parse(readFileSync(
  join(HERE, '..', '..', 'fixtures', 'v1-foundation', 'coverage-floor.json'), 'utf8',
));

const sections = [
  canonicalBytes(),
  validator(),
  treeSnapshot(),
  await releaseBootstrap(),
  policyBundle(),
  semanticBlind(),
];

// ---------------------------------------------------------------------------
// Coverage floor
//
// A green suite says nothing about how much of it ran. Emptying the tree-snapshot
// mutation table deleted 48 checks and still reported ALL PASSED — louder-looking
// than before, because the failures went with them. Every case table in this
// corpus was deletable that way.
//
// The floor is a checked-in constant, so shrinking coverage is a visible edit to a
// fixture rather than a silent consequence of editing a test.
// ---------------------------------------------------------------------------

const floorChecks = new Checks('coverage-floor');
let totalRan = 0;

// The floor section is scored against itself on the following run's totals; it is
// listed in the table so that deleting it is also a failure.
const scored = [...sections, { section: 'coverage-floor', results: [] }];

for (const [name, minimum] of Object.entries(FLOOR.min_checks_per_section)) {
  const section = scored.find((s) => s.section === name);
  if (!section) {
    floorChecks.ok(`section-present/${name}`, false, 'section did not run at all');
    continue;
  }
  const ran = name === 'coverage-floor'
    // Counted from the table itself: one check per listed section, plus the two
    // summary checks below.
    ? Object.keys(FLOOR.min_checks_per_section).length + 2
    : section.results.filter((r) => !r.skipped).length;
  totalRan += ran;
  floorChecks.ok(`section/${name}`, ran >= minimum,
    `${ran} checks ran, floor is ${minimum}`);
}

floorChecks.equal('every-section-accounted-for',
  scored.length, Object.keys(FLOOR.min_checks_per_section).length);
floorChecks.ok('total', totalRan >= FLOOR.min_total_checks,
  `${totalRan} checks ran, floor is ${FLOOR.min_total_checks}`);

sections.push(floorChecks);

process.exit(report(sections, { verbose: process.argv.includes('--verbose') }) === 0 ? 0 : 1);
