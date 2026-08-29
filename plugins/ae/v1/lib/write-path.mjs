// Where the completion write may land — AC-11's destination half.
//
// The write itself is a private method of the Kernel. It was an exported
// `commitCompletion` taking a root, a path, an Acceptance and a verdict array,
// which made it a second completion entry point however carefully the Kernel
// called it: importing the module was enough to write an Acceptance with no
// Gate, no sign-off and no record. There is nothing to import now.
//
// These two remain a module because they are about paths and say nothing about
// completion; the Kernel calls them, and so does nothing else.

import { lstatSync, realpathSync } from 'node:fs';
import { dirname, isAbsolute, join, relative, sep } from 'node:path';
import { fail } from './codes.mjs';

// `O_EXCL` refuses a symlink at the final component and nowhere else, so the
// parents are the caller's problem. Walking them is not belt-and-braces: a parent
// swapped for a symlink redirects the write, and the primitive cannot see it.
export function assertNoSymlinkComponents(root, target) {
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
  // No lexical "is it outside" refusal here. `assertInsideLocation` asks the same
  // question of the resolved path, which is strictly the stronger form and runs on
  // every path this one does; a target this would have caught is caught there, with
  // the same code. What is left here is the part that check cannot do — see below.
  const rel = relative(root, target);
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
export function assertInsideLocation(root, target) {
  // A root that is not there is refused, not thrown at. Resolving it is how
  // containment is decided, so when it does not resolve there is no location to be
  // inside of — and the caller got a raw ENOENT out of a path check, for an
  // escaping lineage and an ordinary one alike.
  let resolvedRoot;
  try {
    resolvedRoot = realpathSync(root);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    fail('writer_not_sole', 'the allowed location does not exist', { root });
  }
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
  // `..` as a whole component, not as a prefix: a directory legitimately named
  // `..inside` is inside the root, and reading the two dots as an escape refused a
  // destination that never left.
  const rel = relative(resolvedRoot, resolvedParent);
  if (rel === '..' || rel.startsWith(`..${sep}`) || isAbsolute(rel)) {
    fail('write_escapes_location', 'the resolved target escapes the allowed location', {
      root: resolvedRoot, resolved: resolvedParent,
    });
  }
}
