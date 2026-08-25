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

// The floor scores `results.length`, so the harness's uniqueness promise is what
// keeps a count from being paddable. Asserted here, beside the thing that depends
// on it, using a throwaway harness instance.
const probe = new Checks('probe');
probe.ok('same-id', true);
probe.ok('same-id', true);
floorChecks.ok('harness-refuses-duplicate-ids',
  probe.results.length === 2 && probe.results[0].ok === true && probe.results[1].ok === false,
  'a repeated check ID was accepted, so any section floor can be padded with no-ops');

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

// A count is not an inventory: deleting one floor check and adding an unrelated
// one nets to zero, and the harness guarantees only that IDs are unique, not that
// they are the intended ones. The expected set is checked in and enforced by
// `report`, not from inside this section — a check cannot observe its own
// deletion, so the observer has to sit outside the thing it observes.

// The inventories `report` enforces live in a fixture, so an empty or absent one
// would disable enforcement while every check still passed — the guard would be
// switched off by editing the file that describes it. Both are required to exist
// and to name what actually ran, derived from the section table rather than from
// a second checked-in list.
// Every check this section always emits, not a subset of them. A subset left the
// cycle breakable: a floor check and its fixture entry could be deleted together,
// and nothing named the check that was supposed to be there. `section-present/*`
// is deliberately absent — it is emitted only when a section fails to run at all.
const requiredFloorIds = [
  'coverage-floor/harness-refuses-duplicate-ids',
  'coverage-floor/every-corpus-section-accounted-for',
  'coverage-floor/total',
  'coverage-floor/section/coverage-floor',
  'coverage-floor/report-scores-a-withheld-section',
  'coverage-floor/report-scores-a-withheld-check',
  'coverage-floor/fixture-declares-every-section',
  'coverage-floor/fixture-declares-every-required-floor-check',
  ...CORPUS_SECTIONS.map(([name]) => `coverage-floor/section/${name}`),
];
floorChecks.ok('fixture-declares-every-section',
  Array.isArray(FLOOR.expected_sections)
    && sections.every((s) => FLOOR.expected_sections.includes(s.section))
    && FLOOR.expected_sections.includes('coverage-floor')
    && new Set(FLOOR.expected_sections).size === FLOOR.expected_sections.length,
  `expected_sections is ${JSON.stringify(FLOOR.expected_sections)}`);
floorChecks.ok('fixture-declares-every-required-floor-check',
  Array.isArray(FLOOR.expected_floor_check_ids)
    && requiredFloorIds.every((id) => FLOOR.expected_floor_check_ids.includes(id))
    && new Set(FLOOR.expected_floor_check_ids).size === FLOOR.expected_floor_check_ids.length,
  `expected_floor_check_ids is missing ${JSON.stringify(
    requiredFloorIds.filter((id) => !(FLOOR.expected_floor_check_ids ?? []).includes(id)))}`);

sections.push(floorChecks);

// The inventory rules are themselves guards, so they are exercised rather than
// trusted: a section withheld and a required check withheld must both be scored
// as failures. The sink is swallowed so the probe's output stays out of the run's.
const swallow = () => {};
const probeSection = new Checks('probe-report');
probeSection.ok('present', true);
floorChecks.ok('report-scores-a-withheld-section',
  report([], { expectedSections: ['probe-report'], write: swallow }) === 1,
  'report accepted a suite with an expected section missing');
floorChecks.ok('report-scores-a-withheld-check',
  report([probeSection], {
    expectedSections: ['probe-report'],
    requiredIds: { 'probe-report': ['probe-report/present', 'probe-report/absent'] },
    write: swallow,
  }) === 1,
  'report accepted a section with a required check missing');

process.exit(report(sections, {
  verbose: process.argv.includes('--verbose'),
  expectedSections: FLOOR.expected_sections,
  // Both lists, not just the fixture's. The code-derived enumeration is what
  // keeps the check that compares them from deleting itself: its own ID is in
  // `requiredFloorIds`, so removing the check and its fixture entry together
  // still leaves the report asking for it.
  requiredIds: {
    'coverage-floor': [...new Set([...requiredFloorIds, ...(FLOOR.expected_floor_check_ids ?? [])])],
  },
}) === 0 ? 0 : 1);
