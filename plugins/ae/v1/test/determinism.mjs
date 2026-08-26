// AC-4's determinism, checked the way the criterion states it: the same facts in
// a *different process* must produce the same result. Two calls inside one
// process share module state, a warmed cache and a single random seed, so they
// establish repeatability and not determinism.

import { reduce } from '../lib/gate.mjs';

const records = JSON.parse(process.argv[2]);
// The same readers the in-process cases use, so the two are comparing the same
// reduction. They are stated here rather than defaulted in `reduce`, because a
// default would be the optional check the review found.
const out = reduce({
  records, lineage: 'L', run: 'run1', obligation: 'O', currentRevision: 'r1',
  admit: () => null,
  inputsChanged: () => false,
  outcomeOf: (r) => r.command_result === 'green',
});
process.stdout.write(JSON.stringify(out));
