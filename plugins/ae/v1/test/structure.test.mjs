// Structural invariants — AC-4's every-path-one-reduction (X4a) and AC-11's sole
// writer.
//
// These are enumerations over the source, not behavioural cases, because the
// claims are about what *exists*: a second reducer or a second writer is a defect
// no run would exhibit until the day it does. The universe enumerated is this
// directory — closed, small, and stated. It is not a reachability proof over the
// whole host, which is X4b and needs a closed universe v1 does not have.

import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { STATUS } from '../lib/gate.mjs';
import { group, ok, eq } from './harness.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const libDir = join(here, '..', 'lib');

function sources() {
  return readdirSync(libDir)
    .filter((f) => f.endsWith('.mjs'))
    .map((f) => ({ name: f, text: readFileSync(join(libDir, f), 'utf8') }));
}

export function structureTests() {
  group('AC-4 · one reduction, enumerated over this directory', () => {
    const files = sources();
    ok('the directory is non-empty', files.length > 0);

    // A status value returned from anywhere but the reduction would be a second
    // path to a status. Only gate.mjs may name them as results.
    const statusValues = Object.values(STATUS);
    const offenders = [];
    for (const { name, text } of files) {
      if (name === 'gate.mjs') continue;
      for (const value of statusValues) {
        // A quoted status string outside gate.mjs, in a return position.
        const pattern = new RegExp(`return[^;]*['"\`]${value}['"\`]`);
        if (pattern.test(text)) offenders.push(`${name}: returns '${value}'`);
      }
    }
    eq('no module outside gate.mjs returns a status', offenders.join('; '), '');

    // And gate.mjs exposes exactly the two entry points, so "the reduction" names
    // one thing.
    const gate = files.find((f) => f.name === 'gate.mjs').text;
    const exported = [...gate.matchAll(/^export function (\w+)/gm)].map((m) => m[1]);
    eq('gate exports select, reduce, reduceAll', exported.join(','), 'select,reduce,reduceAll');
  });

  group('AC-11 · one completion writer', () => {
    const files = sources();
    // The primitive that actually writes is imported in exactly one place. A
    // second importer would be a second writer however it were named.
    const importers = files.filter(
      ({ text }) => /from '\.\/fs-noreplace\.mjs'/.test(text),
    ).map((f) => f.name);
    eq('atomicFileNoReplace has one importer', importers.join(','), 'kernel.mjs');

    // And the write is a private method, so there is no exported function to
    // import. It used to be `commitCompletion(root, path, acceptance, verdicts)`,
    // which was a second completion entry point however carefully the Kernel
    // called it — importing the module was enough to write an Acceptance with no
    // Gate, no sign-off and no record.
    const kernel = files.find((f) => f.name === 'kernel.mjs').text;
    ok('the completion write is private', /#commitCompletion\(/.test(kernel));
    const exported = [...kernel.matchAll(/^export (?:function|class) (\w+)/gm)].map((m) => m[1]);
    eq('the Kernel module exports only the Kernel', exported.join(','), 'Kernel');
  });

  group('AC-5 · no in-process marker stands in for external origin', () => {
    // The Contract names these specifically: a brand, a WeakSet, a sealed value.
    // A caller-written field wrapped in a brand is still a caller-written field.
    const files = sources();
    const suspicious = [];
    for (const { name, text } of files) {
      if (/new WeakSet\(/.test(text)) suspicious.push(`${name}: WeakSet`);
      if (/Symbol\(['"`]?brand/i.test(text)) suspicious.push(`${name}: brand symbol`);
    }
    eq('no brand or WeakSet is used as provenance', suspicious.join('; '), '');
  });

  group('Q-01 · nothing here asserts an installed release', () => {
    const files = sources();
    const offenders = [];
    for (const { name, text } of files) {
      // Deriving "which release is active" from one's own location is the
      // inference the constraint forbids.
      if (/import\.meta\.url[\s\S]{0,200}(release|manifest)/i.test(text)) {
        offenders.push(`${name}: derives a release from its own location`);
      }
      if (/release[_-]?manifest/i.test(text)) offenders.push(`${name}: references a release manifest`);
    }
    eq('no release is asserted', offenders.join('; '), '');
  });
}
