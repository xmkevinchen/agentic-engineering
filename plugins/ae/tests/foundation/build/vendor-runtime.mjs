// Makes Ajv standalone output genuinely standalone.
//
// Ajv's generated code emits `require("ajv/dist/runtime/<helper>")` for a handful
// of keywords (minLength/maxLength, uniqueItems, format, ...). An installed AE
// release resolves no packages at runtime, so those requires cannot survive: the
// helper source is lifted into the generated module instead.
//
// Vendoring is allowed only for helpers that are self-contained. A helper that
// reaches further into the dependency tree (equal.js -> fast-deep-equal) fails the
// build rather than silently reintroducing a runtime dependency — pulling in a new
// helper is a deliberate re-freeze, not a side effect of adding a keyword.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const REQUIRE_PATTERN = /require\("([^"]+)"\)\.default/g;

const SCAFFOLDING = [
  /^"use strict";$/,
  /^Object\.defineProperty\(exports, "__esModule", \{ value: true \}\);$/,
  /^\/\/# sourceMappingURL=.*$/,
];

function extract(moduleId, sourcePath) {
  const text = readFileSync(sourcePath, 'utf8');
  const exportMatch = text.match(/^exports\.default = (\w+);$/m);
  if (!exportMatch) {
    throw new Error(`${moduleId}: no recognizable \`exports.default = <name>;\` to vendor`);
  }
  const exportName = exportMatch[1];
  const body = text
    .split('\n')
    .filter((line) => !SCAFFOLDING.some((re) => re.test(line)))
    .filter((line) => !new RegExp(`^exports\\.default = ${exportName};$`).test(line))
    .filter((line) => !new RegExp(`^${exportName}\\.code = `).test(line))
    .join('\n')
    .trim();

  if (/\brequire\s*\(/.test(body)) {
    throw new Error(`${moduleId}: helper reaches another package and cannot be vendored as a leaf`);
  }
  if (/\bexports\b/.test(body)) {
    throw new Error(`${moduleId}: helper still references \`exports\` after scaffolding removal`);
  }
  return { exportName, body };
}

// Only these helpers may be vendored. The list is part of the freeze.
const ALLOWED = new Map([
  ['ajv/dist/runtime/ucs2length', 'ajv/dist/runtime/ucs2length.js'],
]);

export function vendorRuntime(generatedCode, nodeModulesDir) {
  const required = [...new Set([...generatedCode.matchAll(REQUIRE_PATTERN)].map((m) => m[1]))].sort();
  const vendored = [];
  let code = generatedCode;

  for (const moduleId of required) {
    const relative = ALLOWED.get(moduleId);
    if (!relative) {
      throw new Error(
        `generated validator requires ${moduleId}, which is not in the vendorable set. `
        + 'Either avoid the keyword that pulls it in, or extend the frozen vendor list deliberately.',
      );
    }
    const { exportName, body } = extract(moduleId, join(nodeModulesDir, relative));
    const local = `__ae_vendored_${exportName}`;
    vendored.push({ moduleId, local, exportName, body });
    code = code.replaceAll(`require("${moduleId}").default`, local);
  }

  if (/\brequire\s*\(/.test(code)) {
    throw new Error('generated validator still contains a require() after vendoring');
  }

  if (vendored.length === 0) return { code, vendored };

  const prelude = vendored
    .map(({ moduleId, local, exportName, body }) => [
      `// vendored from ${moduleId} — see build/vendor-runtime.mjs`,
      `const ${local} = (() => {`,
      body.split('\n').map((line) => (line ? `  ${line}` : '')).join('\n'),
      `  return ${exportName};`,
      '})();',
      '',
    ].join('\n'))
    .join('\n');

  // The generated module opens with a `"use strict";` line; the prelude goes
  // immediately after it so the vendored helpers keep strict-mode semantics.
  const lines = code.split('\n');
  const insertAt = lines[0].startsWith('"use strict"') ? 1 : 0;
  lines.splice(insertAt, 0, '', prelude.trimEnd(), '');
  return { code: lines.join('\n'), vendored };
}

export const VENDORABLE_MODULES = [...ALLOWED.keys()];
