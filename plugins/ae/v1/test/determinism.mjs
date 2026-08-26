// AC-4's determinism, checked the way the criterion states it: the same facts in
// a *different process* must produce the same result. Two calls inside one
// process share module state, a warmed cache and a single random seed, so they
// establish repeatability and not determinism.

import { reduce } from '../lib/gate.mjs';

const records = JSON.parse(process.argv[2]);
const out = reduce({
  records, lineage: 'L', obligation: 'O', currentRevision: 'r1',
});
process.stdout.write(JSON.stringify(out));
