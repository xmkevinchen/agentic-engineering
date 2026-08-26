// One writer, started alongside others against the same log.
//
// The interleave these exercise is not producible in one process: every check
// that reads the log and then appends is two operations, and the window between
// them only exists when another process is running. Three rounds of review found
// bugs in that window — a shared sequence number, a minted attempt id, a second
// Assignment — so it is exercised with real processes rather than argued about.

import { Kernel } from '../lib/kernel.mjs';

const [, , logPath, sourceRoot, what, index, startAt, outPath] = process.argv;

const RENDERED = (bytes) => `--- rendered ---\n${bytes}\n`;
const k = new Kernel(logPath, { sourceRoot, render: RENDERED });

// Spin until the agreed instant, so the writers collide rather than queue.
while (Date.now() < Number(startAt)) { /* wait */ }

const out = { index: Number(index), ok: true };
try {
  if (what === 'assignment') {
    const doc = JSON.parse(process.env.ASSIGNMENT_BYTES);
    const bytes = JSON.stringify({ ...doc, id: `A${index}` });
    const { identify } = await import('../lib/identity.mjs');
    k.issueAssignment({
      lineage: 'L', run: 'run1', bytes, identity: identify(bytes), actor: 'Human Owner',
    });
  } else if (what === 'revision') {
    // Every writer names the genesis as its predecessor. Each one's own check
    // passes — the genesis really is the prior approval it saw — and the result
    // is a fan rather than a chain.
    const doc = JSON.parse(process.env.CONTRACT_BYTES);
    const bytes = JSON.stringify({ ...doc, revision: `r${index}`, predecessor: process.env.GENESIS });
    const { identify } = await import('../lib/identity.mjs');
    k.approve({
      lineage: 'L', revision: `r${index}`, bytes, identity: identify(bytes),
      predecessor: process.env.GENESIS, actor: 'Human Owner', rendered: RENDERED(bytes),
    });
  } else if (what === 'attempt') {
    const opened = k.openAttempt({
      lineage: 'L', run: 'run1', producer: 'P', obligations: ['O'], submitter: 'P',
    });
    out.attempt = opened.attempt;
  }
} catch (error) {
  out.ok = false;
  out.code = error.code || error.message;
}
const { writeFileSync } = await import('node:fs');
writeFileSync(outPath, JSON.stringify(out));
