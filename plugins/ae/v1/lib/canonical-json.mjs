// Restricted RFC 8785 (JCS) profile for AE v1 authoritative JSON.
//
// Two responsibilities live here and nowhere else:
//
//   1. strict lexical admission — what byte sequences are allowed to become a
//      value at all (encoding, duplicate keys, number domain);
//   2. canonical serialization — the one byte sequence a admitted value maps to.
//
// Structural admission (which fields may appear, their types, closedness) is the
// schema layer's job and is deliberately absent here. See
// docs/references/v1-foundation-freeze.md for why the split is load-bearing.

import { createHash } from 'node:crypto';
import { fail } from './errors.mjs';

// v1 numbers are schema-bounded integers. The bound is the IEEE-754 double exact
// integer range, so a conforming producer in any language round-trips them
// without a bignum and canonical bytes never depend on float formatting.
export const MAX_SAFE_INT = 9007199254740991; // 2^53 - 1
export const MIN_SAFE_INT = -9007199254740991;

const BOM = Buffer.from([0xef, 0xbb, 0xbf]);

// ---------------------------------------------------------------------------
// Decoding
// ---------------------------------------------------------------------------

export function decodeStrictUtf8(bytes) {
  if (!Buffer.isBuffer(bytes)) fail('malformed_json', 'input must be raw bytes');
  if (bytes.length >= 3 && bytes.subarray(0, 3).equals(BOM)) {
    fail('byte_order_mark', 'authoritative JSON must not carry a BOM');
  }
  try {
    return new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes);
  } catch {
    fail('invalid_utf8', 'input is not well-formed UTF-8');
  }
}

// ---------------------------------------------------------------------------
// Strict JSON parser
//
// Hand-written rather than JSON.parse because three of the rules cannot be
// expressed after the fact: duplicate keys are already collapsed by the time
// JSON.parse returns, `-0` and `1.0` are indistinguishable from `0` and `1`, and
// exponent forms are normalized away.
// ---------------------------------------------------------------------------

const WHITESPACE = new Set([' ', '\t', '\n', '\r']);

// Raw invalid UTF-8 is already refused by decodeStrictUtf8, so an unpaired
// surrogate can only arrive through a `\uXXXX` escape. It has to be refused
// rather than passed through: UTF-8 encoding would silently replace it with
// U+FFFD, which changes the bytes an identity is computed over.
function assertNoLoneSurrogate(str) {
  for (let i = 0; i < str.length; i += 1) {
    const unit = str.charCodeAt(i);
    if (unit >= 0xdc00 && unit <= 0xdfff) {
      fail('lone_surrogate', 'unpaired low surrogate in string');
    }
    if (unit >= 0xd800 && unit <= 0xdbff) {
      const next = i + 1 < str.length ? str.charCodeAt(i + 1) : 0;
      if (next < 0xdc00 || next > 0xdfff) {
        fail('lone_surrogate', 'unpaired high surrogate in string');
      }
      i += 1;
    }
  }
}

class StrictParser {
  constructor(text) {
    this.text = text;
    this.i = 0;
  }

  error(code, message) {
    fail(code, `${message} at offset ${this.i}`, { offset: this.i });
  }

  peek() {
    return this.i < this.text.length ? this.text[this.i] : null;
  }

  skipWhitespace() {
    while (this.i < this.text.length && WHITESPACE.has(this.text[this.i])) this.i += 1;
  }

  expect(ch) {
    if (this.text[this.i] !== ch) this.error('malformed_json', `expected '${ch}'`);
    this.i += 1;
  }

  parseDocument() {
    this.skipWhitespace();
    const value = this.parseValue();
    this.skipWhitespace();
    if (this.i !== this.text.length) this.error('trailing_content', 'unexpected trailing content');
    return value;
  }

  parseValue() {
    const ch = this.peek();
    if (ch === null) this.error('malformed_json', 'unexpected end of input');
    if (ch === '{') return this.parseObject();
    if (ch === '[') return this.parseArray();
    if (ch === '"') return this.parseString();
    if (ch === '-' || (ch >= '0' && ch <= '9')) return this.parseNumber();
    if (this.text.startsWith('true', this.i)) { this.i += 4; return true; }
    if (this.text.startsWith('false', this.i)) { this.i += 5; return false; }
    if (this.text.startsWith('null', this.i)) { this.i += 4; return null; }
    if (this.text.startsWith('NaN', this.i) || this.text.startsWith('Infinity', this.i)) {
      this.error('non_finite_number', 'NaN and Infinity are not admissible');
    }
    this.error('malformed_json', `unexpected character '${ch}'`);
    return undefined;
  }

  parseObject() {
    this.expect('{');
    // Keys are checked for duplicates as they are read, before any property is
    // materialized — a later duplicate must not be able to overwrite an earlier
    // value even transiently.
    const seen = new Set();
    const entries = [];
    this.skipWhitespace();
    if (this.peek() === '}') { this.i += 1; return Object.fromEntries(entries); }
    for (;;) {
      this.skipWhitespace();
      if (this.peek() !== '"') this.error('malformed_json', 'object key must be a string');
      const key = this.parseString();
      if (seen.has(key)) fail('duplicate_key', `duplicate object key ${JSON.stringify(key)}`, { key });
      seen.add(key);
      this.skipWhitespace();
      this.expect(':');
      this.skipWhitespace();
      entries.push([key, this.parseValue()]);
      this.skipWhitespace();
      const ch = this.peek();
      if (ch === ',') { this.i += 1; continue; }
      if (ch === '}') { this.i += 1; break; }
      this.error('malformed_json', "expected ',' or '}'");
    }
    return Object.fromEntries(entries);
  }

  parseArray() {
    this.expect('[');
    const out = [];
    this.skipWhitespace();
    if (this.peek() === ']') { this.i += 1; return out; }
    for (;;) {
      this.skipWhitespace();
      out.push(this.parseValue());
      this.skipWhitespace();
      const ch = this.peek();
      if (ch === ',') { this.i += 1; continue; }
      if (ch === ']') { this.i += 1; break; }
      this.error('malformed_json', "expected ',' or ']'");
    }
    return out;
  }

  parseString() {
    this.expect('"');
    let out = '';
    for (;;) {
      if (this.i >= this.text.length) this.error('malformed_json', 'unterminated string');
      const ch = this.text[this.i];
      if (ch === '"') { this.i += 1; assertNoLoneSurrogate(out); return out; }
      if (ch === '\\') {
        this.i += 1;
        const esc = this.text[this.i];
        this.i += 1;
        switch (esc) {
          case '"': out += '"'; break;
          case '\\': out += '\\'; break;
          case '/': out += '/'; break;
          case 'b': out += '\b'; break;
          case 'f': out += '\f'; break;
          case 'n': out += '\n'; break;
          case 'r': out += '\r'; break;
          case 't': out += '\t'; break;
          case 'u': {
            const hex = this.text.slice(this.i, this.i + 4);
            if (!/^[0-9a-fA-F]{4}$/.test(hex)) this.error('malformed_json', 'bad \\u escape');
            out += String.fromCharCode(parseInt(hex, 16));
            this.i += 4;
            break;
          }
          default: this.error('malformed_json', `bad escape '\\${esc}'`);
        }
        continue;
      }
      const code = ch.charCodeAt(0);
      if (code < 0x20) this.error('malformed_json', 'raw control character in string');
      out += ch;
      this.i += 1;
    }
  }

  parseNumber() {
    const start = this.i;
    if (this.peek() === '-') this.i += 1;
    if (this.peek() === '0') {
      this.i += 1;
    } else if (this.peek() !== null && this.peek() >= '1' && this.peek() <= '9') {
      while (this.peek() !== null && this.peek() >= '0' && this.peek() <= '9') this.i += 1;
    } else {
      this.error('malformed_json', 'invalid number');
    }
    const intEnd = this.i;
    const rest = this.peek();
    if (rest === '.' || rest === 'e' || rest === 'E') {
      // Consume the rest so the diagnostic names the whole literal.
      this.i += 1;
      while (this.peek() !== null && /[0-9+\-eE.]/.test(this.peek())) this.i += 1;
      fail('non_integer_number', `non-integer number literal ${this.text.slice(start, this.i)}`, {
        literal: this.text.slice(start, this.i),
      });
    }
    const literal = this.text.slice(start, intEnd);
    if (literal === '-0') {
      fail('negative_zero', 'the literal -0 is not admissible: it canonicalizes to 0');
    }
    const value = Number(literal);
    if (!Number.isSafeInteger(value)) {
      fail('number_out_of_range', `integer ${literal} is outside the v1 bounded range`, { literal });
    }
    return value;
  }
}

export function parseStrict(bytes) {
  return new StrictParser(decodeStrictUtf8(bytes)).parseDocument();
}

// ---------------------------------------------------------------------------
// Canonical serialization
// ---------------------------------------------------------------------------

const ESCAPES = new Map([
  [0x08, '\\b'], [0x09, '\\t'], [0x0a, '\\n'], [0x0c, '\\f'], [0x0d, '\\r'],
  [0x22, '\\"'], [0x5c, '\\\\'],
]);

function serializeString(str) {
  assertNoLoneSurrogate(str);
  let out = '"';
  for (const ch of str) {
    const code = ch.codePointAt(0);
    const esc = ESCAPES.get(code);
    if (esc !== undefined) out += esc;
    else if (code < 0x20) out += `\\u${code.toString(16).padStart(4, '0')}`;
    else out += ch;
  }
  return `${out}"`;
}

function serializeValue(value, path) {
  if (value === null) return 'null';
  if (value === true) return 'true';
  if (value === false) return 'false';
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) fail('non_finite_number', `non-finite number at ${path}`);
    if (!Number.isInteger(value)) fail('non_integer_number', `non-integer number at ${path}`);
    if (Object.is(value, -0)) fail('negative_zero', `negative zero at ${path}`);
    if (!Number.isSafeInteger(value)) fail('number_out_of_range', `number out of range at ${path}`);
    return String(value);
  }
  if (typeof value === 'string') return serializeString(value);
  if (Array.isArray(value)) {
    return `[${value.map((v, i) => serializeValue(v, `${path}[${i}]`)).join(',')}]`;
  }
  if (typeof value === 'object') {
    // JCS orders members by the UTF-16 code units of the key. JavaScript's default
    // string comparison is exactly that ordering, so no custom comparator is
    // needed — but note it is NOT code-point order: a surrogate pair sorts below
    // U+E000..U+FFFF.
    const keys = Object.keys(value).sort();
    const parts = keys.map((k) => `${serializeString(k)}:${serializeValue(value[k], `${path}.${k}`)}`);
    return `{${parts.join(',')}}`;
  }
  fail('malformed_json', `value of type ${typeof value} at ${path} is not admissible`);
  return undefined;
}

export function canonicalize(value) {
  return Buffer.from(serializeValue(value, '$'), 'utf8');
}

export function canonicalizeBytes(bytes) {
  return canonicalize(parseStrict(bytes));
}

// ---------------------------------------------------------------------------
// Digests
// ---------------------------------------------------------------------------

export function digestBytes(bytes) {
  return `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
}

export function canonicalDigest(value) {
  return digestBytes(canonicalize(value));
}

export const DIGEST_PATTERN = /^sha256:[0-9a-f]{64}$/;

export function isDigest(text) {
  return typeof text === 'string' && DIGEST_PATTERN.test(text);
}

// ---------------------------------------------------------------------------
// NDJSON
// ---------------------------------------------------------------------------

const LF = 0x0a;
const CR = 0x0d;

export function encodeNdjson(objects) {
  return Buffer.concat(objects.flatMap((o) => [canonicalize(o), Buffer.from([LF])]));
}

// Admits only "each line is already canonical bytes, terminated by exactly one
// LF". Re-serializing and comparing is what makes a semantically equal but
// differently spelled line a rejection rather than a silent repair.
export function parseNdjson(bytes) {
  if (!Buffer.isBuffer(bytes)) fail('malformed_json', 'input must be raw bytes');
  if (bytes.length === 0) return [];
  if (bytes[bytes.length - 1] !== LF) {
    fail('ndjson_missing_terminator', 'NDJSON must end with a single LF');
  }
  const out = [];
  let start = 0;
  for (let i = 0; i < bytes.length; i += 1) {
    if (bytes[i] !== LF) continue;
    const line = bytes.subarray(start, i);
    if (line.length === 0) fail('ndjson_trailing_terminator', 'NDJSON must not contain a blank line');
    if (line[line.length - 1] === CR) {
      fail('ndjson_carriage_return', 'NDJSON lines are LF-terminated; CRLF is not admissible');
    }
    const value = parseStrict(Buffer.from(line));
    if (!canonicalize(value).equals(line)) {
      fail('ndjson_not_canonical', 'NDJSON line is not already canonical bytes');
    }
    out.push(value);
    start = i + 1;
  }
  return out;
}
