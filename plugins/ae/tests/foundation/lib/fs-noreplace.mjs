// The no-replace write boundary.
//
// This exists as its own module so that "no-clobber" names one explicit
// operation rather than an existence check followed by a write. Those are not the
// same thing: between `statSync` and `writeFileSync` another writer can create
// the file, and the write then destroys it.
//
// The operation here is a single `open(O_CREAT|O_EXCL)`. The kernel decides,
// atomically, whether this call created the file — and O_EXCL additionally
// refuses to follow a symlink at the final component, which is why the target
// path cannot be redirected between the safety check and the write.
//
// This is NOT a qualification result. The provider below declares
// `qualified: false` on purpose: a real `atomic_file_noreplace` provider must
// carry an immutable passed result bound to OS/filesystem/mount selectors, and
// earning that is P0.8. Nothing in this package may read it as qualified.

import { closeSync, fsyncSync, lstatSync, mkdirSync, openSync, readFileSync, writeSync } from 'node:fs';
import { dirname } from 'node:path';

export const FIXTURE_PROVIDER = Object.freeze({
  provider_id: 'fixture-fs-noreplace-v1',
  capability: 'atomic_file_noreplace',
  mechanism: 'open(O_CREAT|O_EXCL) + fsync(file) + fsync(parent)',
  // Deliberately false. See the note above.
  qualified: false,
  qualification_result_ref: null,
});

export class NoReplaceError extends Error {
  constructor(code, message, detail = {}) {
    super(message);
    this.name = 'NoReplaceError';
    this.code = code;
    this.detail = detail;
  }
}

// Returns 'created' when this call made the file, 'exists' when something was
// already there. It never overwrites, and it never reports 'created' for a file
// it did not create.
export function atomicFileNoReplace({ path, bytes, mode = 0o644 }) {
  mkdirSync(dirname(path), { recursive: true });

  let fd;
  try {
    fd = openSync(path, 'wx', mode);
  } catch (error) {
    if (error.code === 'EEXIST') {
      // O_EXCL reports EEXIST for a dangling symlink too, so the existing entry
      // is inspected without following it before anyone reads through it.
      const stat = lstatSync(path);
      if (stat.isSymbolicLink()) {
        throw new NoReplaceError('ref_symlink_component',
          `${path} exists as a symlink; policy snapshots are never written through links`);
      }
      if (!stat.isFile()) {
        throw new NoReplaceError('integrity_error', `${path} exists and is not a regular file`);
      }
      return { outcome: 'exists', existing: readFileSync(path) };
    }
    throw error;
  }

  try {
    writeSync(fd, bytes);
    fsyncSync(fd);
  } finally {
    closeSync(fd);
  }
  // The parent directory entry has to reach disk too, or the file can survive as
  // an unreferenced inode. Durability across a real crash is not claimed — that
  // is P0.7/P0.8.
  const dirFd = openSync(dirname(path), 'r');
  try {
    fsyncSync(dirFd);
  } finally {
    closeSync(dirFd);
  }
  return { outcome: 'created' };
}
