// Executes the validator toolchain freeze.
//
// The load-bearing claim is a division of labour:
//
//   lib/canonical-json.mjs  decides what BYTES may become a value  (lexical)
//   the Ajv standalone build decides what SHAPE a value may have   (structural)
//
// Neither can cover for the other, and this file proves it in both directions:
// a duplicate-key document that Ajv happily accepts, and a structurally wrong
// document the lexical layer happily admits.

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { canonicalize, digestBytes, parseStrict } from '../lib/canonical-json.mjs';
import { Checks } from './harness.mjs';
import { validateReleaseManifest } from '../../fixtures/v1-foundation/validator/release-manifest-v1.validator.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const VALIDATOR_DIR = join(HERE, '..', '..', 'fixtures', 'v1-foundation', 'validator');
const BUILD_DIR = join(HERE, '..', 'build');

// JSON-Schema keywords. If any of these appear in the mechanism modules, a second
// approximate validator has grown up beside Ajv.
const SCHEMA_KEYWORDS = [
  'additionalProperties', 'unevaluatedProperties', 'patternProperties', 'propertyNames',
  'anyOf', 'allOf', 'oneOf', 'minProperties', 'maxProperties', 'exclusiveMinimum',
  'exclusiveMaximum', 'multipleOf', 'minItems', 'maxItems', 'uniqueItems',
];

function applyMutation(base, mutation) {
  const next = structuredClone(base);
  if (mutation.set) Object.assign(next, mutation.set);
  if (mutation.delete) delete next[mutation.delete];
  if (mutation.setNested) {
    next[mutation.setNested.path][mutation.setNested.key] = mutation.setNested.value;
  }
  if (mutation.setMemberField) {
    const { index, key, value } = mutation.setMemberField;
    next.members[index][key] = value;
  }
  if (mutation.deleteMemberField) {
    const { index, key } = mutation.deleteMemberField;
    delete next.members[index][key];
  }
  return next;
}

export function run() {
  const checks = new Checks('validator');
  const pin = JSON.parse(readFileSync(join(VALIDATOR_DIR, 'toolchain-pin.json'), 'utf8'));
  const cases = JSON.parse(readFileSync(join(VALIDATOR_DIR, 'manifest-cases.json'), 'utf8'));

  // ---- the frozen toolchain ------------------------------------------------
  checks.equal('pin/node-range', pin.node_range, '>=22.12.0 <23.0.0');
  checks.equal('pin/ajv-version', pin.ajv_version, '8.20.0');
  checks.equal('pin/dialect', pin.json_schema_dialect, 'https://json-schema.org/draft/2020-12/schema');

  // The frozen minimum is a choice, not an observation of whatever this host
  // happens to run. Assert only that the running host satisfies it.
  const [major, minor] = process.versions.node.split('.').map(Number);
  checks.ok('host/node-inside-frozen-range',
    major === 22 && minor >= 12,
    `frozen range is ${pin.node_range}; this host runs ${process.versions.node}`);

  // ---- the checked-in artifacts match the pin ------------------------------
  const validatorBytes = readFileSync(join(VALIDATOR_DIR, 'release-manifest-v1.validator.mjs'));
  const schemaBytes = readFileSync(join(VALIDATOR_DIR, 'release-manifest-v1.schema.json'));
  const output = pin.outputs['release-manifest-v1.validator.mjs'];
  checks.equal('pin/validator-digest', digestBytes(validatorBytes), output.validator_digest);
  checks.equal('pin/schema-digest', digestBytes(schemaBytes), output.schema_digest);

  // ---- the runtime path resolves nothing -----------------------------------
  const validatorSource = validatorBytes.toString('utf8');
  checks.ok('runtime/no-require', !/\brequire\s*\(/.test(validatorSource));
  checks.ok('runtime/no-bare-import',
    !/^\s*import\s+[^'"]*from\s+['"][^.\/][^'"]*['"]/m.test(validatorSource));
  checks.ok('runtime/vendored-helpers-declared',
    Array.isArray(output.vendored_runtime) && output.vendored_runtime.includes('ajv/dist/runtime/ucs2length'));
  checks.ok('runtime/no-node-modules-in-tree',
    !existsSync(join(VALIDATOR_DIR, 'node_modules')));

  // ---- positive control ----------------------------------------------------
  checks.ok('schema/valid-manifest-accepted', validateReleaseManifest(cases.valid),
    JSON.stringify(validateReleaseManifest.errors?.[0] ?? {}));

  // The vendored ucs2length helper is only reached through minLength/maxLength, so
  // exercising a ref that is too long proves the vendoring actually works rather
  // than merely compiling.
  const longRef = applyMutation(cases.valid, {
    setMemberField: { index: 0, key: 'ref', value: `runtime/${'a'.repeat(600)}.mjs` },
  });
  checks.ok('schema/maxlength-enforced-by-vendored-helper', !validateReleaseManifest(longRef));

  // ---- negative controls ---------------------------------------------------
  for (const invalid of cases.invalid) {
    const mutated = applyMutation(cases.valid, invalid.mutate);
    checks.ok(`schema/rejects/${invalid.id}`, !validateReleaseManifest(mutated), invalid.why);
  }

  // ---- the responsibility split, in both directions ------------------------
  // A duplicate key is invisible to a schema validator: by the time Ajv sees a
  // value, JSON.parse has already kept the last occurrence. Only the lexical
  // layer can refuse it.
  const canonicalText = canonicalize(cases.valid).toString('utf8');
  const duplicateKeyBytes = Buffer.from(`{"release_id":"impostor",${canonicalText.slice(1)}`, 'utf8');

  const viaJsonParse = JSON.parse(duplicateKeyBytes.toString('utf8'));
  checks.equal('split/json-parse-silently-collapses', viaJsonParse.release_id, cases.valid.release_id);
  checks.ok('split/ajv-alone-accepts-duplicate-key', validateReleaseManifest(viaJsonParse));
  checks.rejects('split/lexical-layer-refuses-duplicate-key',
    () => parseStrict(duplicateKeyBytes), 'duplicate_key');

  // And the converse: the lexical layer admits a document that is structurally
  // wrong, because shape is not its job.
  const structurallyWrong = Buffer.from('{"schema_version":"ae.release-manifest.v1","members":[]}', 'utf8');
  const admitted = checks.accepts('split/lexical-layer-admits-wrong-shape',
    () => parseStrict(structurallyWrong));
  checks.ok('split/schema-layer-refuses-wrong-shape', !validateReleaseManifest(admitted));

  // ---- no second, approximate validator ------------------------------------
  for (const dir of ['lib', 'oracle']) {
    for (const name of readdirSync(join(HERE, '..', dir)).filter((f) => f.endsWith('.mjs'))) {
      const text = readFileSync(join(HERE, '..', dir, name), 'utf8');
      const found = SCHEMA_KEYWORDS.filter((keyword) => text.includes(keyword));
      checks.ok(`no-second-validator/${dir}/${name}`, found.length === 0,
        `mechanism module references JSON-Schema keywords: ${found.join(', ')}`);
    }
  }

  // ---- regeneration is byte-identical --------------------------------------
  // This is the one check that needs the build toolchain. It is skipped loudly
  // rather than passed quietly when node_modules is absent, because a silent pass
  // here would be a claim the run did not earn.
  if (!existsSync(join(BUILD_DIR, 'node_modules', 'ajv'))) {
    checks.skip('regeneration/byte-identical',
      'build toolchain absent (run `npm ci` in tests/foundation/build to check regeneration)');
  } else {
    let ok = true;
    let detail = '';
    try {
      execFileSync('node', ['build-validators.mjs', '--check'], { cwd: BUILD_DIR, encoding: 'utf8' });
    } catch (error) {
      ok = false;
      detail = `${error.stdout ?? ''}${error.stderr ?? ''}`.trim();
    }
    checks.ok('regeneration/byte-identical', ok, detail);
  }

  return checks;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { report } = await import('./harness.mjs');
  process.exit(report([run()], { verbose: process.argv.includes('--verbose') }) === 0 ? 0 : 1);
}
