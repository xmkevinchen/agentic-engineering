// The completion write — AC-11.
//
// Exactly one component writes completion. It does not overwrite, its destination
// cannot be moved outside the allowed location, a failed write is detectable
// rather than silently partial, and it does not stage through a temporary
// location.
//
// That last one is a mechanism-level requirement rather than an outcome, and the
// Contract says so: the settled disposition keeps the frozen no-replace primitive
// as it is, and staging would change that mechanism rather than repair it.

import { lstatSync, realpathSync } from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { atomicFileNoReplace } from './fs-noreplace.mjs';
import { validate } from './schema.mjs';
import { ACCEPTANCE } from '../schema/objects.mjs';
import { fail } from './codes.mjs';

// `O_EXCL` refuses a symlink at the final component and nowhere else, so the
// parents are the caller's problem. Walking them is not belt-and-braces: a parent
// swapped for a symlink redirects the write, and the primitive cannot see it.
function assertNoSymlinkComponents(root, target) {
  // The root too. `realpathSync(root)` resolves a symlinked root silently and
  // then treats wherever it points as the allowed destination, so a link used as
  // the nominal root moved the whole location without tripping anything.
  try {
    if (lstatSync(root).isSymbolicLink()) {
      fail('write_through_symlink', 'the allowed root is itself a symlink', { root });
    }
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  const rel = relative(root, target);
  if (rel.startsWith('..') || isAbsolute(rel)) {
    fail('write_escapes_location', 'the target lies outside the allowed location', { root, target });
  }
  let current = root;
  for (const part of rel.split('/').slice(0, -1)) {
    current = join(current, part);
    let stat;
    try {
      stat = lstatSync(current);
    } catch (error) {
      if (error.code === 'ENOENT') continue; // nothing below to check yet
      throw error;
    }
    if (stat.isSymbolicLink()) {
      fail('write_through_symlink', 'a path component is a symlink', { component: current });
    }
  }
}

// Traversal, not only symlinks: `a/../../b` resolves outside without any link
// being involved. Both are checked because both redirect the write.
function assertInsideLocation(root, target) {
  const resolvedRoot = realpathSync(root);
  const resolvedParent = (() => {
    let dir = dirname(target);
    for (;;) {
      try { return realpathSync(dir); } catch (e) {
        if (e.code !== 'ENOENT') throw e;
        const up = dirname(dir);
        if (up === dir) return dir;
        dir = up;
      }
    }
  })();
  const rel = relative(resolvedRoot, resolvedParent);
  if (rel.startsWith('..') || isAbsolute(rel)) {
    fail('write_escapes_location', 'the resolved target escapes the allowed location', {
      root: resolvedRoot, resolved: resolvedParent,
    });
  }
}

// The sole writer. Named as a single exported function because "exactly one
// component writes completion" is a property a test can check by enumerating
// callers, and a second entry point would make that enumeration a lie.
//
// It takes the Acceptance and the verdicts it rests on, not arbitrary bytes. An
// earlier draft accepted any path and any content with no Gate input at all,
// which made "the completion write" a file write that happened to be called that.
export function commitCompletion({
  root, path, acceptance, recordedVerdicts, obligations, run, revision,
}) {
  // The Acceptance must be the shape the schema states, not merely truthy. An
  // earlier version checked `if (!acceptance)` and wrote `{}`.
  if (!acceptance) {
    fail('not_all_passed', 'completion writes an Acceptance, not arbitrary bytes', { path });
  }
  const problems = validate(ACCEPTANCE, acceptance);
  if (problems.length > 0) {
    fail('format_open', 'the Acceptance does not match its closed shape', { problems });
  }
  if (acceptance.decision.run !== run || acceptance.contract_revision !== revision) {
    fail('signoff_wrong_run', 'the Acceptance belongs to another run or revision', {
      run, revision, acceptance: acceptance.decision.run,
    });
  }

  // Verdicts come from recorded `gate_result`s for this run and revision, and
  // every obligation the Contract states must be among them. A caller map was
  // previously enough, so `{invented: 'passed'}` reached the write.
  // Required, not defaulted. Omitting it would make every obligation fail for
  // want of a verdict — closed, but for the wrong reason, and a caller could not
  // tell "the Gate said no" from "nobody asked the Gate".
  if (!Array.isArray(recordedVerdicts)) {
    fail('record_not_appended', 'completion reads recorded verdicts, and none were given', { run });
  }
  const forRun = recordedVerdicts.filter(
    (v) => v.run === run && v.contract_revision === revision,
  );
  const byObligation = new Map(forRun.map((v) => [v.obligation, v.status]));
  if (obligations.length === 0) {
    fail('not_all_passed', 'a Contract that promised nothing cannot complete', { run });
  }
  for (const obligation of obligations) {
    const status = byObligation.get(obligation);
    if (status === undefined) {
      fail('record_not_appended', 'no recorded verdict for an obligation', { obligation, run });
    }
    if (status !== 'passed') {
      fail('not_all_passed', 'completion requires every obligation to be passed', {
        obligation, status,
      });
    }
  }

  const bytes = Buffer.from(JSON.stringify(acceptance));

  const target = resolve(path);
  // Symlink first: it is the more specific reason, and a link pointing outside
  // would otherwise be reported as plain traversal, losing what actually happened.
  assertNoSymlinkComponents(resolve(root), target);
  assertInsideLocation(root, target);

  // What the preflight does not close: it walks the parents, then `O_EXCL` opens
  // the final component, and those are separate syscalls. A parent swapped for a
  // symlink between them redirects the write, and nothing here detects it. Closing
  // that needs directory handles held across both operations — `openat` relative
  // to a held fd — which Node does not expose.
  //
  // Under §2's boundary this is expected: swapping a parent mid-write requires
  // the same OS access that could edit the log directly. It is stated because the
  // preflight otherwise reads as a guarantee it is not.

  const result = atomicFileNoReplace({ path: target, bytes });
  if (result.outcome === 'exists') {
    fail('write_would_clobber', 'completion does not overwrite an existing target', { path: target });
  }
  return result;
}
