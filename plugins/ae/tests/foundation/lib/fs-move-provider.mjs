// The directory-move provider boundary.
//
// FIXTURE SCOPE. This provider is not qualified and says so: `qualified: false`,
// no immutable passed result, no platform selector matrix. Earning those is P0.8.
//
// What it does establish — and what P0.1 owes regardless of P0.8 — is the shape of
// the boundary. A move plan and a move result are values a PRODUCER makes by
// doing the work, not fields a caller writes:
//
//   - `planDirectoryMove` probes the real filesystem: the source must exist and be
//     a directory, the target must not exist, and both must be on one device;
//   - `executeDirectoryMove` performs an actual rename and reports what happened,
//     including failure;
//   - both results are branded, so a plain object with `qualified: true` and a
//     `provider_id` of the caller's choosing is not a qualification.
//
// A boolean the caller sets can never be qualification. That is why there is no
// `qualified` field on the result at all: the consumer asks whether a provider
// produced the value, not whether the value says it was produced.

import { lstatSync, renameSync, statSync } from 'node:fs';
import { canonicalDigest, digestBytes } from './canonical-json.mjs';
import { fail } from './errors.mjs';
import { deepFreeze } from './freeze.mjs';

export const FIXTURE_MOVE_PROVIDER = Object.freeze({
  provider_id: 'fixture-fs-directory-move-v1',
  capability: 'atomic_directory_noreplace',
  mechanism: 'lstat probe of source and target, then rename(2) on one device',
  // Deliberately false. A real provider needs an immutable passed result bound to
  // OS/kernel/filesystem/mount selectors, plus a genuine same-filesystem race
  // test. Nothing here may be read as qualified.
  qualified: false,
  qualification_result_ref: null,
});

const PLANS = new WeakSet();
const RESULTS = new WeakSet();

export function isQualifiedMovePlan(value) {
  return typeof value === 'object' && value !== null && PLANS.has(value);
}

export function isProviderMoveResult(value) {
  return typeof value === 'object' && value !== null && RESULTS.has(value);
}

// The qualification binding identifies which provider, built how, under which
// observed selector, and against which recorded result. For the fixture the
// "result" is this descriptor itself — honest, and still a real digest chain.
function qualificationFor(selector) {
  const record = {
    provider: FIXTURE_MOVE_PROVIDER,
    selector,
  };
  return deepFreeze({
    provider_id: FIXTURE_MOVE_PROVIDER.provider_id,
    build_digest: canonicalDigest(FIXTURE_MOVE_PROVIDER),
    selector_digest: canonicalDigest(selector),
    result_ref: `fixture:qualifications/filesystem/${FIXTURE_MOVE_PROVIDER.provider_id}`,
    result_digest: canonicalDigest(record),
  });
}

// A second capability, so that "this projection is only defined for a DIRECTORY
// no-replace move" is a rule the consumer can actually be caught not enforcing.
// A file move is a real, provider-produced plan that the projection must still
// refuse.
export function planFileMove({ sourceSubject, targetSubject }) {
  const plan = deepFreeze({
    operation: 'atomic_file_noreplace',
    qualification: qualificationFor({ platform: process.platform, kind: 'file' }),
    source: Object.freeze({ ...sourceSubject }),
    target: Object.freeze({ ...targetSubject }),
  });
  PLANS.add(plan);
  const result = deepFreeze({
    operation: plan.operation,
    outcome: 'succeeded',
    diagnostic: null,
    qualification: plan.qualification,
    source: plan.source,
    target: plan.target,
    plan_digest: digestBytes(Buffer.from(canonicalDigest(plan), 'utf8')),
  });
  RESULTS.add(result);
  return { plan, result };
}

export function planDirectoryMove({ sourceSubject, targetSubject }) {
  let sourceStat;
  try {
    sourceStat = lstatSync(sourceSubject.resolved_root);
  } catch {
    fail('move_projection_plan_not_qualified',
      `move source ${sourceSubject.resolved_root} does not exist`);
  }
  if (!sourceStat.isDirectory()) {
    fail('move_projection_plan_not_qualified', 'move source is not a directory');
  }

  let targetExists = true;
  try {
    lstatSync(targetSubject.resolved_root);
  } catch {
    targetExists = false;
  }
  if (targetExists) {
    fail('move_projection_plan_not_qualified',
      `move target ${targetSubject.resolved_root} already exists; this operation never replaces`);
  }

  // Same filesystem, observed rather than declared: the target's nearest existing
  // parent is what the rename will actually land on.
  const parentDevice = statSync(nearestExistingParent(targetSubject.resolved_root)).dev;
  if (parentDevice !== sourceStat.dev) {
    fail('move_projection_cross_device',
      'source and target are on different filesystems');
  }

  const selector = {
    platform: process.platform,
    source_device: sourceStat.dev,
    target_device: parentDevice,
  };

  const plan = deepFreeze({
    operation: FIXTURE_MOVE_PROVIDER.capability,
    qualification: qualificationFor(selector),
    source: Object.freeze({ ...sourceSubject, device_id: sourceStat.dev }),
    target: Object.freeze({ ...targetSubject, device_id: parentDevice }),
  });
  PLANS.add(plan);
  return plan;
}

function nearestExistingParent(path) {
  let current = path;
  for (;;) {
    const parent = current.slice(0, current.lastIndexOf('/')) || '/';
    try {
      lstatSync(parent);
      return parent;
    } catch {
      if (parent === '/') return '/';
      current = parent;
    }
  }
}

// Performs the move and reports the outcome. A failure is a legitimate provider
// result: it is branded exactly like a success, and the consumer refuses it on the
// outcome rather than on whether it came from a provider.
export function executeDirectoryMove(plan) {
  if (!isQualifiedMovePlan(plan)) {
    fail('move_projection_plan_not_qualified', 'move plan was not produced by a move provider');
  }
  let outcome = 'succeeded';
  let diagnostic = null;
  try {
    // The exists-probe in planDirectoryMove plus this rename is NOT an atomic
    // no-replace on every platform; that is precisely what P0.8 must qualify.
    renameSync(plan.source.resolved_root, plan.target.resolved_root);
  } catch (error) {
    outcome = 'failed';
    diagnostic = error.code ?? 'unknown';
  }
  const result = deepFreeze({
    operation: plan.operation,
    outcome,
    diagnostic,
    qualification: plan.qualification,
    source: plan.source,
    target: plan.target,
    plan_digest: digestBytes(Buffer.from(canonicalDigest(plan), 'utf8')),
  });
  RESULTS.add(result);
  return result;
}
