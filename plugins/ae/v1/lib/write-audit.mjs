// AC-11's staging property, checked against the write path's own source.
//
// Separate from the write path on purpose: an audit is not a writer, and the
// enumeration of what writes completion has to stay short enough to read.
// AC-11 — "written in place, never staged and moved", checked against the write
// path's own source rather than against a flag.
//
// The earlier version of this check took an `allowStaging` parameter that existed
// only so a fixture could set it and be refused. That proves a `fail` fires when
// asked to fire; it says nothing about whether the writer stages. This reads the
// call sites, the way the kind audit does: if a move, link or copy ever appears on
// the write path, it is found here whether or not anyone thought to test for it.
const STAGING_CALLS = [
  'rename', 'renameSync', 'link', 'linkSync', 'symlink', 'symlinkSync',
  'copyFile', 'copyFileSync', 'cp', 'cpSync',
];

export function auditWritePath({ readFileSync, dir, files = ['kernel.mjs', 'write-path.mjs', 'fs-noreplace.mjs'] }) {
  const found = [];
  for (const name of files) {
    // Strip this audit's own list, or the check reports itself.
    const text = readFileSync(`${dir}/${name}`, 'utf8').replace(/const STAGING_CALLS[\s\S]*?\];/, '');
    for (const call of STAGING_CALLS) {
      if (new RegExp(`\\b${call}\\s*\\(`).test(text)) found.push({ file: name, call });
    }
  }
  return found;
}
