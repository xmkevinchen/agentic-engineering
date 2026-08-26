// Criterion coverage — the Contract's own landing check, turned on the suite.
//
// AC-6 requires that a disposition naming a landing actually be carried by it.
// The same failure is available here: a suite can claim to cover a criterion by
// naming it in a group title while asserting something else entirely. This checks
// that every criterion the Contract states has at least one group naming it, and
// — the part that matters — that no group names a criterion the Contract does not
// have, which is how a renamed criterion leaves a test orphaned and still green.

import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { group, ok, eq } from './harness.mjs';

const here = dirname(fileURLToPath(import.meta.url));
// `AE_REPO_ROOT` for the mutation check, which runs this suite from a copy.
const REPO = process.env.AE_REPO_ROOT || join(here, '..', '..', '..', '..');
const CONTRACT = join(REPO, '.ae', 'features', 'active',
  'F-086-v1-minimal-kernel', 'contract.md');

// Criteria the Contract states, read from the Contract rather than restated here.
// Restating them would be the second source the Contract itself refuses.
function contractCriteria() {
  const text = readFileSync(CONTRACT, 'utf8');
  return [...text.matchAll(/^### (AC-\d+) —/gm)].map((m) => m[1]);
}

function groupsNamed() {
  const named = new Set();
  for (const f of readdirSync(here).filter((f) => f.endsWith('.test.mjs'))) {
    const text = readFileSync(join(here, f), 'utf8');
    for (const m of text.matchAll(/group\('(AC-\d+)/g)) named.add(m[1]);
  }
  return named;
}

// Criteria whose *substance* cannot be exercised without a human decision, and
// why. Listed rather than silently absent: an uncovered criterion should say
// whether it is waiting on a person or on the implementer.
//
// Being human-gated does not mean nothing about it can be tested. The judgement
// is the Human Owner's; the operations that record it are the implementer's, and
// leaving those untested because the judgement is reserved is how a criterion
// ends up with the machinery to receive an answer missing entirely.
const HUMAN_GATED = {
  'AC-9': 'the real dogfood run — the Human Owner chooses the change and judges its worth (Q-02)',
};

export function coverageTests() {
  group('AC-6 · every criterion is covered or declared human-gated', () => {
    const criteria = contractCriteria();
    ok('the Contract was read', criteria.length > 0);

    const covered = groupsNamed();
    const uncovered = criteria.filter((c) => !covered.has(c) && !HUMAN_GATED[c]);
    eq('no criterion is silently uncovered', uncovered.join(','), '');

    for (const [criterion, why] of Object.entries(HUMAN_GATED)) {
      ok(`${criterion} is declared human-gated: ${why}`, criteria.includes(criterion));
    }
  });

  group('AC-6 · no test claims a criterion the Contract does not state', () => {
    // The orphan case: a criterion is renamed or merged, its test keeps the old
    // name, and the suite stays green while covering nothing.
    const criteria = new Set(contractCriteria());
    const orphans = [...groupsNamed()].filter((c) => !criteria.has(c));
    eq('no orphaned test group', orphans.join(','), '');
  });
}
