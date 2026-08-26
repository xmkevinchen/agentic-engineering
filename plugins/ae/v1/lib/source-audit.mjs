// Properties read off the source, where reading the program is the only way to
// check them.
//
// AC-11's staging property: the write path performs no move, link or copy.
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

// AC-5 — no public operation takes an origin.
//
// `origin` is stamped by the Kernel and by nothing else. That used to be backed
// by a guard inside the stamper, which became unreachable once the stamper went
// private: every call site is internal and none passes one. What is left to check
// is the surface itself, and the surface is a fact about the source.
export function auditOriginSurface({ readFileSync, dir, file = 'kernel.mjs' }) {
  const text = readFileSync(`${dir}/${file}`, 'utf8');
  const found = [];
  // Public methods only: a name that does not begin with `#`, at class-member
  // indentation, whose destructured parameters name `origin`.
  for (const m of text.matchAll(/^ {2}([A-Za-z][\w]*)\(\{([^}]*)\}/gm)) {
    if (/\borigin\b/.test(m[2])) found.push(m[1]);
  }
  return found;
}

// AC-13 — the reduction reads records and nothing else.
//
// This is the completeness half stated as a property of the program rather than
// as a list of record kinds to look for. If the Gate can only see what was
// written down, then whatever it relied on was written down, and a replay from
// the log alone reaches the same verdict — which the fresh-process cases assert
// for both arms.
//
// A list of kinds cannot say this: it is satisfied by whatever the author
// happened to enumerate, and says nothing about an input arriving from somewhere
// else. Reading the world — a file, the clock, the environment — is what would
// break it, so that is what is checked.
const AMBIENT = [
  "from 'node:fs'", "from 'node:child_process'", "from 'node:os'",
  'process.env', 'Date.now', 'Math.random', 'new Date',
];

export function auditReductionPurity({ readFileSync, dir, files = ['gate.mjs', 'admissibility.mjs'] }) {
  const found = [];
  for (const name of files) {
    const text = readFileSync(`${dir}/${name}`, 'utf8').replace(/const AMBIENT[\s\S]*?\];/, '');
    for (const source of AMBIENT) {
      if (text.includes(source)) found.push({ file: name, source });
    }
  }
  return found;
}
