// Executes the checked-in canonical-byte corpus.
//
// Three independent parties must agree with the checked-in constants:
//
//   runtime  lib/canonical-json.mjs   (strict parser + serializer)
//   oracle   JSON.parse + oracle/canonical-oracle.mjs (table-driven serializer)
//   shasum   the system sha256 binary — a second implementation of SHA-256 over
//            the same expected files. It confirms our digest function, NOT that
//            the expected bytes themselves are right; that comes from their being
//            hand-authored constants.
//
// The runtime and the oracle are never compared to each other as the primary
// assertion — both are compared to expected/*.bin.

import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  canonicalDigest, canonicalize, digestBytes, isDigest, parseNdjson, parseStrict,
} from '../lib/canonical-json.mjs';
import { oracleCanonicalize, oracleDigest } from '../oracle/canonical-oracle.mjs';
import { Checks } from './harness.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const CORPUS = join(HERE, '..', '..', 'fixtures', 'v1-foundation', 'canonical-bytes');
const FLOOR = JSON.parse(readFileSync(
  join(HERE, '..', '..', 'fixtures', 'v1-foundation', 'coverage-floor.json'), 'utf8',
)).min_corpus_sizes;


export function run() {
  const checks = new Checks('canonical-bytes');
  const manifest = JSON.parse(readFileSync(join(CORPUS, 'cases.json'), 'utf8'));

  checks.equal('manifest-schema', manifest.schema_version, 'ae.fixture.canonical-bytes.v1');
  // Self-referential on its own — both operands live in cases.json — so it is
  // paired with the floor below, which is a separate checked-in constant.
  checks.equal('manifest-case-count', manifest.cases.length, manifest.case_count);

  const byKind = (kind) => manifest.cases.filter((c) => c.kind === kind).length;
  checks.ok('floor/total-cases', manifest.cases.length >= FLOOR.canonical_bytes_cases,
    `${manifest.cases.length} cases, floor is ${FLOOR.canonical_bytes_cases}`);
  checks.ok('floor/reject-cases', byKind('reject') >= FLOOR.canonical_bytes_reject_cases,
    `${byKind('reject')} reject cases, floor is ${FLOOR.canonical_bytes_reject_cases}`);
  checks.ok('floor/canonical-cases', byKind('canonical') >= FLOOR.canonical_bytes_canonical_cases,
    `${byKind('canonical')} canonical cases, floor is ${FLOOR.canonical_bytes_canonical_cases}`);
  checks.ok('floor/ndjson-cases',
    byKind('ndjson_accept') + byKind('ndjson_reject') >= FLOOR.canonical_bytes_ndjson_cases,
    `floor is ${FLOOR.canonical_bytes_ndjson_cases}`);
  // The checked-in expected bytes are the whole point of this section — runtime
  // and oracle are compared against them rather than against each other — and
  // this floor was declared without anything reading it.
  const expectedOutputs = readdirSync(join(CORPUS, 'expected')).filter((f) => f.endsWith('.bin')).length;
  checks.ok('floor/expected-outputs',
    expectedOutputs >= FLOOR.canonical_bytes_expected_outputs,
    `${expectedOutputs} expected outputs, floor is ${FLOOR.canonical_bytes_expected_outputs}`);

  // ---- our sha256 agrees with the system's over the expected files
  const expectedRefs = [...new Set(
    manifest.cases.filter((c) => c.expected_ref).map((c) => c.expected_ref),
  )].sort();
  const shasumOut = execFileSync('shasum', ['-a', '256', ...expectedRefs], { cwd: CORPUS, encoding: 'utf8' });
  const shasumByRef = new Map(
    shasumOut.trim().split('\n').map((line) => {
      const [hex, ref] = line.split(/\s+/);
      return [ref, `sha256:${hex}`];
    }),
  );
  for (const ref of expectedRefs) {
    const bytes = readFileSync(join(CORPUS, ref));
    checks.equal(`shasum-agrees/${ref}`, digestBytes(bytes), shasumByRef.get(ref));
  }

  const canonicalDigestsByGroup = new Map();
  const rawDigestsByGroup = new Map();

  for (const testCase of manifest.cases) {
    const input = readFileSync(join(CORPUS, testCase.input_ref));
    checks.equal(`input-raw-digest/${testCase.id}`, digestBytes(input), testCase.input_raw_digest);

    if (testCase.kind === 'canonical') {
      const expected = readFileSync(join(CORPUS, testCase.expected_ref));

      // Runtime: strict parse, then canonical serialize.
      const runtimeValue = checks.accepts(`runtime-admits/${testCase.id}`, () => parseStrict(input));
      if (runtimeValue !== undefined) {
        checks.equalBytes(`runtime-bytes/${testCase.id}`, canonicalize(runtimeValue), expected);
        checks.equal(`runtime-digest/${testCase.id}`, canonicalDigest(runtimeValue), testCase.expected_canonical_digest);
      }

      // Oracle: a different parser and a different serializer, same constants.
      const oracleValue = JSON.parse(input.toString('utf8'));
      checks.equalBytes(`oracle-bytes/${testCase.id}`, oracleCanonicalize(oracleValue), expected);
      checks.equal(`oracle-digest/${testCase.id}`, oracleDigest(oracleValue), testCase.expected_canonical_digest);

      checks.ok(`digest-form/${testCase.id}`, isDigest(testCase.expected_canonical_digest),
        `${testCase.expected_canonical_digest} is not sha256: + 64 lowercase hex`);

      // Canonical bytes must be a fixed point: canonicalizing them again is a no-op.
      checks.equalBytes(`idempotent/${testCase.id}`, canonicalize(parseStrict(expected)), expected);

      const group = testCase.equivalence_group;
      if (!canonicalDigestsByGroup.has(group)) {
        canonicalDigestsByGroup.set(group, new Set());
        rawDigestsByGroup.set(group, []);
      }
      canonicalDigestsByGroup.get(group).add(testCase.expected_canonical_digest);
      rawDigestsByGroup.get(group).push(testCase.input_raw_digest);
      continue;
    }

    if (testCase.kind === 'admit') {
      checks.accepts(`admit/${testCase.id}`, () => parseStrict(input));
      continue;
    }

    if (testCase.kind === 'reject') {
      checks.rejects(`reject/${testCase.id}`, () => parseStrict(input), testCase.expected_code);
      continue;
    }

    if (testCase.kind === 'ndjson_accept') {
      const records = checks.accepts(`ndjson-admits/${testCase.id}`, () => parseNdjson(input));
      if (records !== undefined) {
        checks.equal(`ndjson-record-count/${testCase.id}`, records.length, testCase.expected_record_count);
      }
      continue;
    }

    if (testCase.kind === 'ndjson_reject') {
      checks.rejects(`ndjson-reject/${testCase.id}`, () => parseNdjson(input), testCase.expected_code);
      continue;
    }

    checks.ok(`unknown-case-kind/${testCase.id}`, false, `unhandled case kind ${testCase.kind}`);
  }

  // ---- semantic equivalence vs raw-byte identity
  //
  // Members of an equivalence group are semantically one value and byte-wise
  // several. Identities over artifacts/sources/members use the raw bytes; only the
  // semantic JSON digest collapses the group.
  //
  // Grouped by the digest the IMPLEMENTATION computes, not by the group label in
  // cases.json. Comparing the manifest's declared grouping against itself is a
  // tautology — breaking canonicalize() outright would leave it green.
  const observedGrouping = new Map();
  for (const testCase of manifest.cases.filter((c) => c.kind === 'canonical')) {
    const value = parseStrict(readFileSync(join(CORPUS, testCase.input_ref)));
    const digest = canonicalDigest(value);
    if (!observedGrouping.has(digest)) observedGrouping.set(digest, []);
    observedGrouping.get(digest).push(testCase);
  }
  for (const [digest, members] of observedGrouping) {
    const declared = new Set(members.map((m) => m.equivalence_group));
    checks.equal(`group/one-declared-group-per-computed-digest/${members[0].equivalence_group}`,
      declared.size, 1,
      `digest ${digest} spans declared groups ${[...declared].join(', ')}`);
  }
  for (const [group, digests] of canonicalDigestsByGroup) {
    const computed = new Set(
      manifest.cases
        .filter((c) => c.equivalence_group === group)
        .map((c) => canonicalDigest(parseStrict(readFileSync(join(CORPUS, c.input_ref))))),
    );
    checks.equal(`group/computed-digest-is-single/${group}`, computed.size, 1);
    checks.equal(`group/computed-matches-declared/${group}`, [...computed][0], [...digests][0]);
    const raws = rawDigestsByGroup.get(group);
    checks.equal(`group/distinct-raw-digests/${group}`, new Set(raws).size, raws.length);
  }

  // At least one group must have more than one member, or "several byte sequences,
  // one canonical form" is a claim no fixture makes.
  const largestGroup = Math.max(...[...rawDigestsByGroup.values()].map((r) => r.length));
  checks.ok('group/at-least-one-multi-member-group', largestGroup > 1,
    `largest equivalence group has ${largestGroup} member(s)`);

  // Pretty printing and platform line endings are outside the semantic digest;
  // this is the same claim the group above makes, asserted directly.
  const compact = readFileSync(join(CORPUS, 'inputs/p01-compact-reordered.bin'));
  const prettyCrlf = readFileSync(join(CORPUS, 'inputs/p03-pretty-crlf.bin'));
  checks.notEqual('crlf-raw-differs', digestBytes(compact), digestBytes(prettyCrlf));
  checks.equal('crlf-semantic-identical',
    canonicalDigest(parseStrict(compact)), canonicalDigest(parseStrict(prettyCrlf)));

  // ---- these take raw bytes, not strings ---------------------------------
  // Passing a string would decode as UTF-16 and silently change what is hashed.
  for (const [label, value] of [
    ['string', '{"a":1}'],
    ['null', null],
    ['object', { a: 1 }],
    ['array-of-bytes', [0x7b, 0x7d]],
  ]) {
    checks.rejects(`accepts-bytes-only/parseStrict/${label}`, () => parseStrict(value), 'malformed_json');
    checks.rejects(`accepts-bytes-only/parseNdjson/${label}`, () => parseNdjson(value), 'malformed_json');
  }

  // ---- the digest text form, from both sides -----------------------------
  //
  // Only positive assertions existed, so DIGEST_PATTERN could be replaced with /^/
  // and every one would still pass.
  for (const [label, text] of [
    ['uppercase-hex', `sha256:${'A'.repeat(64)}`],
    ['too-short', `sha256:${'a'.repeat(63)}`],
    ['too-long', `sha256:${'a'.repeat(65)}`],
    ['no-prefix', 'a'.repeat(64)],
    ['wrong-algorithm', `sha512:${'a'.repeat(64)}`],
    ['non-hex', `sha256:${'g'.repeat(64)}`],
    ['leading-space', ` sha256:${'a'.repeat(64)}`],
    ['trailing-newline', `sha256:${'a'.repeat(64)}\n`],
    ['empty', ''],
  ]) {
    checks.equal(`digest-form/rejects/${label}`, isDigest(text), false);
  }
  checks.equal('digest-form/accepts-well-formed', isDigest(`sha256:${'0123456789abcdef'.repeat(4)}`), true);

  // ---- the serializer's own admission rules ------------------------------
  //
  // Every case above reaches the serializer through parseStrict, which refuses
  // these first — so the serializer's guards are never exercised by that path and
  // could be deleted with the corpus still green. They are not redundant, though:
  // canonicalize() is called on in-memory values all over this package (algorithm
  // identity, policy epochs, snapshot digests), and there the serializer is the
  // only thing between a bad value and a silently wrong digest.
  const inMemory = [
    ['float', { a: 1.5 }, 'non_integer_number'],
    ['float-whole', { a: 2.0000000001 }, 'non_integer_number'],
    ['negative-zero', { a: -0 }, 'negative_zero'],
    ['infinity', { a: Infinity }, 'non_finite_number'],
    ['negative-infinity', { a: -Infinity }, 'non_finite_number'],
    ['nan', { a: NaN }, 'non_finite_number'],
    ['above-safe-integer', { a: 2 ** 53 }, 'number_out_of_range'],
    ['below-safe-integer', { a: -(2 ** 53) }, 'number_out_of_range'],
    ['lone-high-surrogate', { a: '\ud800' }, 'lone_surrogate'],
    ['lone-low-surrogate', { a: '\udc00' }, 'lone_surrogate'],
    ['undefined-value', { a: undefined }, 'malformed_json'],
    ['function-value', { a: () => 1 }, 'malformed_json'],
    ['bigint-value', { a: 1n }, 'malformed_json'],
    ['symbol-value', { a: Symbol('x') }, 'malformed_json'],
    // Nested, to prove the whole value is walked rather than just its top level.
    ['float-in-array', { a: [1, 2.5] }, 'non_integer_number'],
    ['float-deep', { a: { b: { c: [{ d: 0.5 }] } } }, 'non_integer_number'],
    ['lone-surrogate-in-key', { '\ud800': 1 }, 'lone_surrogate'],
  ];
  for (const [id, value, code] of inMemory) {
    checks.rejects(`serializer-admission/${id}`, () => canonicalize(value), code);
  }

  // Positive control: the same path accepts a well-formed in-memory value, so the
  // rejections above are not a serializer that refuses everything.
  checks.equalBytes('serializer-admission/accepts-valid-in-memory-value',
    canonicalize({ b: [1, -1, 0], a: 'ok' }),
    Buffer.from('{"a":"ok","b":[1,-1,0]}', 'utf8'));

  // NFC and NFD are distinct values: no private normalization anywhere.
  const nfc = readFileSync(join(CORPUS, 'expected/nfc-precomposed.bin'));
  const nfd = readFileSync(join(CORPUS, 'expected/nfd-decomposed.bin'));
  checks.notEqual('no-unicode-normalization',
    canonicalDigest(parseStrict(nfc)), canonicalDigest(parseStrict(nfd)));

  return checks;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { report } = await import('./harness.mjs');
  process.exit(report([run()], { verbose: process.argv.includes('--verbose') }) === 0 ? 0 : 1);
}
