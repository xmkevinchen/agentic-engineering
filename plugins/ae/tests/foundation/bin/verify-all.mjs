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

// The floor covers the corpus sections; its own section is scored separately below
// so that its count is observed rather than derived from this table.
const CORPUS_SECTIONS = Object.entries(FLOOR.min_checks_per_section)
  .filter(([name]) => name !== 'coverage-floor');

for (const [name, minimum] of CORPUS_SECTIONS) {
  const section = sections.find((s) => s.section === name);
  if (!section) {
    floorChecks.ok(`section-present/${name}`, false, 'section did not run at all');
    continue;
  }
  // Skips count. A skip is not a deletion: the check still exists and still
  // reported. Excluding them made skipping impossible instead of merely visible,
  // and turned the documented toolchain-absent skip into a hard failure on any
  // clone that has not run `npm ci` — the exact state the suite header promises to
  // support.
  const present = section.results.length;
  totalRan += present;
  floorChecks.ok(`section/${name}`, present >= minimum,
    `${present} checks present, floor is ${minimum}`);
}

floorChecks.equal('every-corpus-section-accounted-for', sections.length, CORPUS_SECTIONS.length);
floorChecks.ok('total', totalRan >= FLOOR.min_total_checks,
  `${totalRan} checks present, floor is ${FLOOR.min_total_checks}`);

// Scored from its own observed results. Deriving this count from the table made the
// one section whose job is detecting deletion the one section whose deletion was
// invisible: removing the `total` check above left the suite green and silently
// stopped min_total_checks being consulted at all. The self-check is added after
// the measurement, so the floor for this section counts everything before it.
const ownChecks = floorChecks.results.length;
floorChecks.ok('section/coverage-floor',
  ownChecks >= FLOOR.min_checks_per_section['coverage-floor'],
  `${ownChecks} floor checks ran, floor is ${FLOOR.min_checks_per_section['coverage-floor']}`);

sections.push(floorChecks);

process.exit(report(sections, { verbose: process.argv.includes('--verbose') }) === 0 ? 0 : 1);
