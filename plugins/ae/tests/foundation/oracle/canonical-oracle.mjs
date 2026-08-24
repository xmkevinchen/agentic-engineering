// Independent oracle for the restricted JCS profile.
//
// This exists to be *wrong differently* from lib/canonical-json.mjs, so it is
// written against the specification text rather than against that module:
//
//   - key ordering compares UTF-16 code units explicitly instead of relying on
//     the host's default string collation;
//   - escaping is driven by a precomputed table rather than a switch;
//   - output is assembled as byte chunks rather than a JavaScript string.
//
// Neither implementation is the reference. Both are checked against the
// checked-in expected bytes in fixtures/v1-foundation/canonical-bytes; agreement
// between the two is a secondary signal only.

import { createHash } from 'node:crypto';

class OracleError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'OracleError';
    this.code = code;
  }
}

const ESCAPE_TABLE = (() => {
  const table = new Array(0x20);
  for (let c = 0; c < 0x20; c += 1) {
    table[c] = `\\u${c.toString(16).padStart(4, '0')}`;
  }
  table[0x08] = '\\b';
  table[0x09] = '\\t';
  table[0x0a] = '\\n';
  table[0x0c] = '\\f';
  table[0x0d] = '\\r';
  return table;
})();

function codeUnitLess(a, b) {
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i += 1) {
    const ua = a.charCodeAt(i);
    const ub = b.charCodeAt(i);
    if (ua !== ub) return ua < ub;
  }
  return a.length < b.length;
}

function sortKeys(keys) {
  // Insertion sort over the explicit code-unit predicate. Objects are small, and
  // the point is that the ordering rule is visible rather than delegated to the
  // host's default comparator.
  const out = keys.slice();
  for (let i = 1; i < out.length; i += 1) {
    const key = out[i];
    let j = i - 1;
    while (j >= 0 && codeUnitLess(key, out[j])) {
      out[j + 1] = out[j];
      j -= 1;
    }
    out[j + 1] = key;
  }
  return out;
}

function emitString(str, chunks) {
  let buffered = '"';
  for (let i = 0; i < str.length; i += 1) {
    const unit = str.charCodeAt(i);
    if (unit < 0x20) buffered += ESCAPE_TABLE[unit];
    else if (unit === 0x22) buffered += '\\"';
    else if (unit === 0x5c) buffered += '\\\\';
    else buffered += str[i];
  }
  chunks.push(Buffer.from(`${buffered}"`, 'utf8'));
}

function emit(value, chunks) {
  if (value === null) { chunks.push(Buffer.from('null')); return; }
  const type = typeof value;
  if (type === 'boolean') { chunks.push(Buffer.from(value ? 'true' : 'false')); return; }
  if (type === 'number') {
    if (!Number.isSafeInteger(value) || Object.is(value, -0)) {
      throw new OracleError('number_not_admissible', `number ${value} is outside the restricted profile`);
    }
    chunks.push(Buffer.from(String(value)));
    return;
  }
  if (type === 'string') { emitString(value, chunks); return; }
  if (Array.isArray(value)) {
    chunks.push(Buffer.from('['));
    value.forEach((item, index) => {
      if (index > 0) chunks.push(Buffer.from(','));
      emit(item, chunks);
    });
    chunks.push(Buffer.from(']'));
    return;
  }
  if (type === 'object') {
    chunks.push(Buffer.from('{'));
    sortKeys(Object.keys(value)).forEach((key, index) => {
      if (index > 0) chunks.push(Buffer.from(','));
      emitString(key, chunks);
      chunks.push(Buffer.from(':'));
      emit(value[key], chunks);
    });
    chunks.push(Buffer.from('}'));
    return;
  }
  throw new OracleError('value_not_admissible', `value of type ${type} is not admissible`);
}

export function oracleCanonicalize(value) {
  const chunks = [];
  emit(value, chunks);
  return Buffer.concat(chunks);
}

export function oracleDigest(value) {
  return `sha256:${createHash('sha256').update(oracleCanonicalize(value)).digest('hex')}`;
}
