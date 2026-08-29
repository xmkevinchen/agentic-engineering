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

// AC-4 — the reduction does not read when a record landed.
//
// Records carry `at`, observed by the writer, because AC-9 asks a question about
// the world and nothing else can answer it. A verdict that read it would be a
// verdict that depends on how long something took.
//
// The noninterference cases cannot catch that: they replay one log with the
// environment varied, and a stored timestamp is the same on every replay. So this
// is checked where it can be — the reduction's own source.
export function auditReductionIgnoresTime({ readFileSync, dir, files = ['gate.mjs', 'admissibility.mjs'] }) {
  const found = [];
  for (const name of files) {
    const text = readFileSync(`${dir}/${name}`, 'utf8');
    if (/\.at\b/.test(text)) found.push({ file: name, source: '.at' });
    if (/Date\.now/.test(text)) found.push({ file: name, source: 'Date.now' });
  }
  return found;
}

// AC-12 — the closed set of record kinds, read off the source.
//
// This is an early warning, not the enforcement. What enforces the set is the
// read boundary in `kernel.mjs`, which checks every line of the log against it and
// which the suite can reach. This one runs over the program instead of over a log,
// so it catches a kind that is written but never read back by any test, and it
// catches the set and the schemas drifting apart — neither of which a correct log
// would ever show.
//
// Being a reader of source, it sees only kinds spelled as a literal. A record
// assembled some other way — a shorthand property, a computed key, a name held in
// a variable — is invisible here and refused at the read boundary instead.
// Membership, not lookup. `kinds.constructor` is a function on every object, so a
// record kind spelled `constructor`, `__proto__` or `toString` would be found in
// a set that does not contain it.
const own = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key);

export function auditRecordKinds({ readdirSync, readFileSync, dir, kinds, schemas }) {
  const found = [];
  // Every source that writes records, which is every source but the one holding
  // the set itself. Naming the writers here instead would be a second list to keep
  // in step with the first.
  for (const name of readdirSync(dir).filter((f) => f.endsWith('.mjs') && f !== 'ledger.mjs')) {
    const text = readFileSync(`${dir}/${name}`, 'utf8');
    // The property form, which is how a record states its kind. Comparisons read
    // `.kind === '...'` and case labels read `case '...'`, so neither is caught.
    for (const m of text.matchAll(/\bkind\s*:\s*['"`]([a-z_]+)['"`]/g)) {
      if (!own(kinds, m[1])) {
        found.push({ kind: m[1], file: name, why: 'written but outside the closed set' });
      }
    }
  }
  for (const kind of Object.keys(kinds)) {
    if (!own(schemas, kind)) found.push({ kind, why: 'in the closed set with no schema' });
  }
  for (const kind of Object.keys(schemas)) {
    if (!own(kinds, kind)) found.push({ kind, why: 'has a schema but is not in the closed set' });
  }
  return found;
}
