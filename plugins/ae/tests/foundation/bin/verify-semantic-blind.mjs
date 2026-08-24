// D18 / G0.13 — the mechanisms know versioned protocol, not business semantics.
//
// Two halves, because either alone is weak:
//
//   behavioural  run the same engine over two features that differ only in
//                feature ID and business path, and require every decision to
//                correspond under the declared rename mapping;
//   structural   resolve the mechanism modules' actual import graph, then check
//                exactly that closed set for feature IDs and one-off business
//                paths. Resolving the graph first is what makes this more than a
//                grep: it establishes which files are production code rather than
//                assuming it.

import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { canonicalDigest, digestBytes, parseNdjson, parseStrict } from '../lib/canonical-json.mjs';
import { FoundationError } from '../lib/errors.mjs';
import { PROFILE_NAMES, entriesProjectionDigest, observeTree } from '../lib/tree-snapshot.mjs';
import { CASE_A_FILES, RENAME_MAPPING, materializeCase, rename } from '../corpus/semantic-blind-corpus.mjs';
import { Checks } from './harness.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const LIB = join(HERE, '..', 'lib');

// Everything in lib/ is a mechanism module and gets scanned — enumerated from the
// directory rather than listed by hand, so a new lib/ file cannot be added and
// silently escape the scan by not happening to be imported from a curated root.
//
// release-build.mjs is the sole exclusion: it assembles fixture releases and is
// expected to reference fixture paths. It is named here rather than inferred, so
// removing it from the exclusion list is a visible edit.
const NOT_A_MECHANISM = ['release-build.mjs'];

function mechanismEntryPoints() {
  return readdirSync(LIB)
    .filter((name) => name.endsWith('.mjs'))
    .filter((name) => !NOT_A_MECHANISM.includes(name))
    .sort();
}

// Business vocabulary and fixture identity. Protocol constants (`.ae/policies`,
// `contract/`, `ledger/events.ndjson`) are injected by the versioned protocol and
// are legitimately present — these are not.
const FORBIDDEN_TOKENS = [
  'billing', 'checkout', 'F-100', 'F-742', 'billing-export', 'checkout-ledger',
  'AE_FIXTURE', '.ae/features', 'fixtures/',
];
const FEATURE_ID_PATTERN = /\bF-\d{3,}\b/;

// ---------------------------------------------------------------------------
// The engine under test: every decision the foundation mechanisms make about a
// feature tree, collected into one comparable object.
// ---------------------------------------------------------------------------

function runEngine(root, logicalRoot, transform) {
  const snapshots = {};
  for (const profile of PROFILE_NAMES) {
    const snapshot = observeTree({ logicalRoot, resolvedRootPath: root, profile });
    snapshots[profile] = {
      entries: snapshot.entries.map((e) => ({
        path: e.path, type: e.type, mode: e.mode, length: e.length ?? null, digest: e.digest ?? null,
      })),
      projection_digest: entriesProjectionDigest(snapshot),
      logical_root: snapshot.subject.logical_root,
    };
  }

  // Canonical digests of every JSON document in the tree. Keys stay in case A's
  // namespace so the two runs are directly comparable.
  const canonical = {};
  for (const rel of CASE_A_FILES.map(([r]) => r).filter((r) => r.endsWith('.json'))) {
    canonical[rel] = canonicalDigest(parseStrict(readFileSync(join(root, transform(rel)))));
  }

  const ledger = parseNdjson(readFileSync(join(root, transform('ledger/events.ndjson'))));

  // Typed outcomes for a malformed-input battery built from this case's own bytes.
  const contractBytes = readFileSync(join(root, transform('contract/contract-v1.json')));
  const battery = {
    duplicate_key: codeOf(() => parseStrict(
      Buffer.from(`{"feature_id":"x",${contractBytes.toString('utf8').slice(1)}`, 'utf8'),
    )),
    bom: codeOf(() => parseStrict(Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), contractBytes]))),
    float: codeOf(() => parseStrict(
      Buffer.from(`{"progress":0.5,${contractBytes.toString('utf8').slice(1)}`, 'utf8'),
    )),
    crlf_ndjson: codeOf(() => parseNdjson(
      Buffer.from(
        readFileSync(join(root, transform('ledger/events.ndjson'))).toString('utf8').replace(/\n/g, '\r\n'),
        'utf8',
      ),
    )),
    invalid_utf8: codeOf(() => parseStrict(Buffer.concat([Buffer.from('{"a":"'), Buffer.from([0x80]), Buffer.from('"}')]))),
  };

  return {
    snapshots,
    canonical,
    ledger_record_count: ledger.length,
    ledger_digest: canonicalDigest(ledger),
    battery,
  };
}

function codeOf(fn) {
  try {
    fn();
    return 'accepted';
  } catch (error) {
    return error instanceof FoundationError ? error.code : `unexpected:${error.name}`;
  }
}

// Projects case A's engine output into case B's namespace, using only the
// declared mapping. Digests are recomputed from the renamed BYTES — a digest is
// not a renameable string, and pretending otherwise would hide exactly the bug
// this test looks for.
function projectOntoCaseB(output, rootA) {
  const bytesFor = (relA) => Buffer.from(rename(readFileSync(join(rootA, relA)).toString('utf8')), 'utf8');

  const snapshots = {};
  for (const [profile, snapshot] of Object.entries(output.snapshots)) {
    snapshots[profile] = {
      entries: snapshot.entries.map((entry) => {
        if (entry.type === 'directory') {
          return { ...entry, path: rename(entry.path) };
        }
        const renamedBytes = bytesFor(entry.path);
        return {
          ...entry,
          path: rename(entry.path),
          length: renamedBytes.length,
          digest: digestBytes(renamedBytes),
        };
      }),
      projection_digest: null, // recomputed by the caller from the projected entries
      logical_root: rename(snapshot.logical_root),
    };
  }

  const canonical = {};
  for (const [rel] of Object.entries(output.canonical)) {
    canonical[rel] = canonicalDigest(parseStrict(bytesFor(rel)));
  }

  return {
    snapshots,
    canonical,
    ledger_record_count: output.ledger_record_count,
    ledger_digest: canonicalDigest(parseNdjson(bytesFor('ledger/events.ndjson'))),
    battery: output.battery,
  };
}

// ---------------------------------------------------------------------------
// Structural half: resolve the mechanism import graph
// ---------------------------------------------------------------------------

const RELATIVE_IMPORT = /^\s*(?:import|export)\s+(?:[^'"]*\s+from\s+)?['"](\.[^'"]*)['"]/gm;

function resolveImportGraph(entryPoints) {
  const seen = new Set();
  const queue = entryPoints.map((name) => join(LIB, name));
  while (queue.length > 0) {
    const current = queue.shift();
    if (seen.has(current)) continue;
    seen.add(current);
    const source = readFileSync(current, 'utf8');
    for (const match of source.matchAll(RELATIVE_IMPORT)) {
      queue.push(resolve(dirname(current), match[1]));
    }
  }
  return [...seen].sort();
}

export function run() {
  const checks = new Checks('semantic-blind');
  const work = mkdtempSync(join(tmpdir(), 'ae-blind-'));

  try {
    // ---- behavioural half -------------------------------------------------
    const caseA = materializeCase(work, (t) => t);
    const caseB = materializeCase(work, rename);

    checks.notEqual('cases-are-distinct', caseA.root, caseB.root);
    checks.ok('case-b-renames-the-root', caseB.root.endsWith('F-742-checkout-ledger'));

    const outputA = runEngine(caseA.root, caseA.logicalRoot, (t) => t);
    const outputB = runEngine(caseB.root, caseB.logicalRoot, rename);

    // Sanity: the two runs really are over different bytes. Without this, an
    // isomorphism check could pass by comparing a tree with itself.
    checks.notEqual('outputs-are-not-trivially-equal',
      outputA.snapshots.feature_evidence.projection_digest,
      outputB.snapshots.feature_evidence.projection_digest);

    const projected = projectOntoCaseB(outputA, caseA.root);

    for (const profile of PROFILE_NAMES) {
      checks.equal(`isomorphic/${profile}/entries`,
        JSON.stringify(projected.snapshots[profile].entries),
        JSON.stringify(outputB.snapshots[profile].entries));
      checks.equal(`isomorphic/${profile}/logical-root`,
        projected.snapshots[profile].logical_root,
        outputB.snapshots[profile].logical_root);
      // Include/exclude decisions must correspond path for path.
      checks.equal(`isomorphic/${profile}/entry-count`,
        projected.snapshots[profile].entries.length,
        outputB.snapshots[profile].entries.length);
      // The sort order must survive renaming: ordering is over path bytes, and
      // the engine must not have memorised case A's sequence.
      checks.equal(`isomorphic/${profile}/order`,
        projected.snapshots[profile].entries.map((e) => e.path).join('|'),
        outputB.snapshots[profile].entries.map((e) => e.path).join('|'));
    }

    for (const rel of Object.keys(outputA.canonical)) {
      checks.equal(`isomorphic/canonical/${rel}`, projected.canonical[rel], outputB.canonical[rel]);
    }

    checks.equal('isomorphic/ledger-record-count',
      projected.ledger_record_count, outputB.ledger_record_count);
    checks.equal('isomorphic/ledger-digest', projected.ledger_digest, outputB.ledger_digest);

    // Decisions, not just outputs: every typed rejection must be the same code.
    for (const key of Object.keys(outputA.battery)) {
      checks.equal(`isomorphic/battery/${key}`, outputA.battery[key], outputB.battery[key]);
      checks.notEqual(`battery-not-vacuous/${key}`, outputA.battery[key], 'accepted');
    }

    // ---- structural half --------------------------------------------------
    const entryPoints = mechanismEntryPoints();
    const graph = resolveImportGraph(entryPoints);

    // Completeness, asserted rather than assumed: the scanned set is exactly the
    // mechanism files on disk. `graph.length >= entryPoints.length` would be
    // satisfied trivially and would not notice a file that no root imports.
    const scanned = graph.map((m) => relative(LIB, m)).sort();
    checks.equal('graph/scans-every-mechanism-module', scanned.join(','), entryPoints.join(','));
    checks.ok('graph/is-not-empty', entryPoints.length > 0);
    checks.ok('graph/excludes-the-fixture-release-builder',
      !scanned.includes('release-build.mjs'));

    // The closed mechanism set must not reach fixture, corpus, or harness code.
    for (const modulePath of graph) {
      const rel = relative(join(HERE, '..'), modulePath);
      checks.ok(`graph/production-only/${rel}`,
        rel.startsWith('lib/'),
        `mechanism graph reaches non-library module ${rel}`);
      checks.ok(`graph/excludes-fixture-harness/${rel}`,
        !rel.includes('release-build'),
        'a mechanism module imports the fixture release builder');
    }

    // Now scan exactly the resolved set — not a directory glob, and not the
    // whole repository.
    for (const modulePath of graph) {
      const rel = relative(join(HERE, '..'), modulePath);
      const source = readFileSync(modulePath, 'utf8');
      const hits = FORBIDDEN_TOKENS.filter((token) => source.includes(token));
      checks.ok(`graph/no-business-vocabulary/${rel}`, hits.length === 0,
        `found ${hits.join(', ')}`);
      const idMatch = source.match(FEATURE_ID_PATTERN);
      checks.ok(`graph/no-feature-ids/${rel}`, idMatch === null,
        idMatch ? `found feature ID ${idMatch[0]}` : '');
    }

    // The scan is only meaningful if the tokens it looks for are actually present
    // somewhere — otherwise it would pass against an empty vocabulary.
    const corpusSource = readFileSync(join(HERE, '..', 'corpus', 'semantic-blind-corpus.mjs'), 'utf8');
    checks.ok('scan-not-vacuous',
      FORBIDDEN_TOKENS.filter((t) => corpusSource.includes(t)).length >= 4,
      'the forbidden-token list must match real vocabulary used by the corpus');

    checks.equal('rename-mapping-declared', RENAME_MAPPING.length, 5);


    return checks;
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { report } = await import('./harness.mjs');
  process.exit(report([run()], { verbose: process.argv.includes('--verbose') }) === 0 ? 0 : 1);
}
