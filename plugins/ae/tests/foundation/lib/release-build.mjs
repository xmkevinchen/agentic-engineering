// Builds an installed release in the frozen, acyclic order:
//
//   core + standalone validator + active-release bridge + schemas + policy members
//     -> closed release manifest with raw member digests and no self_digest
//     -> SHA-256(JCS(complete manifest object)) held externally
//     -> minimal launcher with the expected manifest digest and bootstrap
//        validator embedded
//
// The launcher is built last and is not a member, so no step depends on a digest
// that does not exist yet. Nothing here mints a real active-release capability:
// the bridge and core it installs are the fixture-scoped templates.

import { copyFileSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { canonicalize, digestBytes } from './canonical-json.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const TEMPLATES = join(HERE, '..', 'release-template');
const FIXTURES = join(HERE, '..', '..', 'fixtures', 'v1-foundation');

// ---------------------------------------------------------------------------
// Source inlining
//
// The launcher embeds rather than imports, so its dependencies are lifted in as
// text. Any import/export the lifter cannot remove is a hard error: a surviving
// import would be exactly the cycle the DAG forbids.
// ---------------------------------------------------------------------------

const IMPORT_LINE = /^\s*import\s+(?:[^'"]+\s+from\s+)?['"][^'"]+['"];?\s*$/;
const EXPORT_PREFIX = /^export\s+(?=(?:const|let|var|function|class|async)\b)/;

export function inlineModuleSource(text, label) {
  const out = text
    .split('\n')
    .filter((line) => !IMPORT_LINE.test(line))
    .map((line) => line.replace(EXPORT_PREFIX, ''))
    .join('\n');
  const leftover = out.split('\n').find((line) => /^\s*(?:import|export)\s/.test(line));
  if (leftover) {
    throw new Error(`${label}: could not inline, module-level statement survives: ${leftover.trim()}`);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Member set
// ---------------------------------------------------------------------------

function copyTree(sourceDir, targetDir, refPrefix, role, members) {
  for (const name of readdirSync(sourceDir).sort()) {
    const sourcePath = join(sourceDir, name);
    const targetPath = join(targetDir, name);
    if (statSync(sourcePath).isDirectory()) {
      mkdirSync(targetPath, { recursive: true });
      copyTree(sourcePath, targetPath, `${refPrefix}/${name}`, role, members);
      continue;
    }
    mkdirSync(targetDir, { recursive: true });
    copyFileSync(sourcePath, targetPath);
    members.push({ role, ref: `${refPrefix}/${name}` });
  }
}

export function assembleMembers(releaseRoot, { policySourceDir }) {
  const members = [];
  mkdirSync(join(releaseRoot, 'runtime'), { recursive: true });
  mkdirSync(join(releaseRoot, 'schemas'), { recursive: true });

  // runtime/validators-v1.mjs — the pinned Ajv standalone build, plus the fixture
  // import trace. No schema is compiled at runtime.
  const standalone = readFileSync(join(HERE, 'release-manifest-v1.validator.mjs'), 'utf8');
  const validatorModule = [
    "import { appendFileSync } from 'node:fs';",
    "if (process.env.AE_FIXTURE_IMPORT_LOG) appendFileSync(process.env.AE_FIXTURE_IMPORT_LOG, 'import:validators-v1\\n');",
    '',
    standalone,
  ].join('\n');
  writeFileSync(join(releaseRoot, 'runtime', 'validators-v1.mjs'), validatorModule);
  members.push({ role: 'standalone_validator', ref: 'runtime/validators-v1.mjs' });

  copyFileSync(join(TEMPLATES, 'active-release-bridge.mjs'), join(releaseRoot, 'runtime', 'active-release-bridge.mjs'));
  members.push({ role: 'active_release_bridge', ref: 'runtime/active-release-bridge.mjs' });

  copyFileSync(join(TEMPLATES, 'ae-gate-core.mjs'), join(releaseRoot, 'runtime', 'ae-gate-core.mjs'));
  members.push({ role: 'runtime_core', ref: 'runtime/ae-gate-core.mjs' });

  copyFileSync(
    join(FIXTURES, 'validator', 'release-manifest-v1.schema.json'),
    join(releaseRoot, 'schemas', 'release-manifest-v1.schema.json'),
  );
  members.push({ role: 'schema', ref: 'schemas/release-manifest-v1.schema.json' });

  copyTree(join(policySourceDir, 'policies'), join(releaseRoot, 'policies'), 'policies', 'policy', members);

  return members;
}

// ---------------------------------------------------------------------------
// Build
// ---------------------------------------------------------------------------

export function buildRelease({
  releaseRoot,
  policySourceDir,
  releaseId = 'ae-gate-fixture',
  releaseVersion = '1.0.0',
  transformManifest = (m) => m,
  manifestBytesOverride = null,
}) {
  mkdirSync(releaseRoot, { recursive: true });

  // 1 — members first
  const memberRefs = assembleMembers(releaseRoot, { policySourceDir });
  const members = memberRefs.map(({ role, ref }) => {
    const bytes = readFileSync(join(releaseRoot, ref));
    return { role, ref, raw_digest: digestBytes(bytes), length: bytes.length };
  });

  const bundleBytes = readFileSync(join(policySourceDir, 'policies', 'bundle-v1.json'));

  // 2 — closed manifest over those members. No self_digest, by construction.
  const manifest = transformManifest({
    schema_version: 'ae.release-manifest.v1',
    release_id: releaseId,
    release_version: releaseVersion,
    activation_base_bundle_ref: 'policies/bundle-v1.json',
    activation_base_bundle_digest: digestBytes(bundleBytes),
    reducer_semantics: {
      semantics_version: 'ae.reducer.v1',
      reducer_digest: digestBytes(Buffer.from('fixture-reducer-v1', 'utf8')),
    },
    members,
  });

  // 3 — the authoritative digest, computed over the complete object and held
  //     outside it
  const manifestBytes = manifestBytesOverride ?? canonicalize(manifest);
  const manifestDigest = digestBytes(manifestBytes);
  writeFileSync(join(releaseRoot, 'release-manifest-v1.json'), manifestBytes);

  // 4 — launcher last, carrying that digest and its own copy of the validator
  // Replacements are functions, not strings: the inlined source contains `$'`
  // and other `$`-sequences that String.replace would otherwise interpret as
  // substitution patterns.
  const canonicalSource = [
    inlineModuleSource(readFileSync(join(HERE, 'errors.mjs'), 'utf8'), 'errors.mjs'),
    inlineModuleSource(readFileSync(join(HERE, 'canonical-json.mjs'), 'utf8'), 'canonical-json.mjs'),
  ].join('\n');
  const validatorSource = inlineModuleSource(
    readFileSync(join(HERE, 'release-manifest-v1.validator.mjs'), 'utf8'),
    'release-manifest-v1.validator.mjs',
  );

  const launcherSource = readFileSync(join(TEMPLATES, 'ae-gate.mjs.template'), 'utf8')
    .replace('/*__EMBEDDED_CANONICAL_JSON__*/', () => canonicalSource)
    .replace('/*__EMBEDDED_BOOTSTRAP_VALIDATOR__*/', () => validatorSource)
    .replaceAll('__EXPECTED_RELEASE_MANIFEST_DIGEST__', () => manifestDigest);

  const launcherPath = join(releaseRoot, 'runtime', 'ae-gate.mjs');
  writeFileSync(launcherPath, launcherSource);

  return {
    releaseRoot,
    manifest,
    manifestBytes,
    manifestDigest,
    launcherPath,
    launcherRef: relative(releaseRoot, launcherPath).split('\\').join('/'),
  };
}
