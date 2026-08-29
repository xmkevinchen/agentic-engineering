// AC-13's replay, run as a separate process.
//
// Reconstructing in the same process that wrote the log proves the objects in
// memory agree with themselves. The criterion asks whether the *records* rebuild
// the state, so this reads the log from disk in a fresh process and reports what
// it finds; the caller compares that with what the original run reached.

import { copyFileSync } from 'node:fs';
import { Kernel } from '../lib/kernel.mjs';
import { SOURCE_ROOT, RENDERED, OWNER } from './fixtures.mjs';

const [, , path, lineage, run] = process.argv;

const state = new Kernel(path).reconstruct({ lineage, run });

// And the verdicts, recomputed rather than read back. `status` records what it
// decides, so the reduction runs against a copy: replaying must not write into
// the log it is replaying, and a check that mutates its own subject is not a
// check. What it recomputes must equal what the original run recorded.
const copy = `${path}.replay`;
copyFileSync(path, copy);
const k = new Kernel(copy, { sourceRoot: SOURCE_ROOT, render: RENDERED, owner: OWNER });
let recomputed = {};
try { recomputed = k.status({ lineage, run }).byObligation; } catch { recomputed = {}; }

process.stdout.write(JSON.stringify({
  approvedRevision: state.approvedRevision,
  boundRevision: state.boundRevision,
  unavailable: state.unavailable,
  requested: state.requested,
  unavailableDecision: state.unavailableDecision,
  attempts: state.attempts,
  gateVerdicts: state.gateVerdicts,
  signoffPresent: state.signoff !== null,
  completion: state.completion,
  reviews: state.reviews,
  dispositions: state.dispositions,
  recomputed: Object.fromEntries(
    Object.entries(recomputed).map(([o, v]) => [o, v.status]),
  ),
}));
