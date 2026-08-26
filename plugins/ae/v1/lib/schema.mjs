// Closed formats — AC-12.
//
// Two jobs, and the second is the unusual one.
//
// 1. Validate a value against a schema.
// 2. **Validate the schema itself.** A schema position that constrains nothing
//    admits anything, so `{}` at any depth defeats the closure the Contract
//    requires. An earlier draft of the Contract said "closed schema" and would
//    have accepted every property defined as `{}`; saying it recursively is what
//    makes the word mean something. `items: {}` is the same defect one level in:
//    it rejects an empty array while admitting `[null]`.
//
// Self-contained on purpose. The frozen corpus pins Ajv for the release manifest;
// V1 builds no release and adds no build step, so it carries its own checker and
// pins that instead (AC-12's enforcement identity).

import { fail } from './codes.mjs';

const TYPES = ['object', 'array', 'string', 'integer', 'boolean', 'digest', 'enum', 'const'];

// ---------------------------------------------------------------------------
// Schema linting — is this schema actually closed?

export function lintSchema(schema, path = '$') {
  const problems = [];

  if (schema === null || typeof schema !== 'object' || Array.isArray(schema)) {
    problems.push({ path, code: 'format_open', why: 'not a schema object' });
    return problems;
  }
  // `{}` is caught here rather than by its own check: an empty schema has no
  // type, so a separate emptiness test would be unreachable. A mutation run
  // proved that — removing the emptiness test left the suite green, which is the
  // signature of a guard that guards nothing. An unreachable second layer is not
  // defence in depth; it is a claim of protection that no test can hold to
  // account.
  if (!schema.type || !TYPES.includes(schema.type)) {
    problems.push({
      path, code: 'format_open',
      why: Object.keys(schema).length === 0
        ? 'empty schema: no type, so it admits anything'
        : `missing or unknown type: ${schema.type}`,
    });
    return problems;
  }

  switch (schema.type) {
    case 'object': {
      if (!schema.properties || Object.keys(schema.properties).length === 0) {
        problems.push({ path, code: 'format_open', why: 'object with no properties' });
        break;
      }
      if (schema.additional !== false) {
        problems.push({ path, code: 'format_open', why: 'object must refuse additional properties' });
      }
      if (!Array.isArray(schema.required)) {
        problems.push({ path, code: 'format_open', why: 'object must state which properties are required' });
      }
      for (const [key, sub] of Object.entries(schema.properties)) {
        problems.push(...lintSchema(sub, `${path}.${key}`));
      }
      break;
    }
    case 'array': {
      if (!schema.items) {
        problems.push({ path, code: 'format_open', why: 'array without an item schema' });
        break;
      }
      problems.push(...lintSchema(schema.items, `${path}[]`));
      break;
    }
    case 'string': {
      // A string field that may be empty is a field that may carry nothing while
      // appearing present. Where emptiness is genuinely meaningful the schema
      // says `minLength: 0` explicitly, and says why.
      if (schema.minLength === undefined) {
        problems.push({ path, code: 'format_open', why: 'string without a minimum length' });
      }
      break;
    }
    case 'enum': {
      if (!Array.isArray(schema.values) || schema.values.length === 0) {
        problems.push({ path, code: 'format_open', why: 'enum without values' });
      }
      break;
    }
    case 'const': {
      if (schema.value === undefined) {
        problems.push({ path, code: 'format_open', why: 'const without a value' });
      }
      break;
    }
    default:
      break;
  }
  return problems;
}

export function assertClosed(schema, name) {
  const problems = lintSchema(schema, `$(${name})`);
  if (problems.length > 0) {
    fail('format_open', `schema ${name} is not closed`, { problems });
  }
  return true;
}

// ---------------------------------------------------------------------------
// Value validation.

const DIGEST = /^sha256:[0-9a-f]{64}$/;

export function validate(schema, value, path = '$') {
  if (value === null || value === undefined) {
    return [{ path, code: 'format_open', why: 'null or absent' }];
  }
  switch (schema.type) {
    case 'object': {
      if (typeof value !== 'object' || Array.isArray(value)) {
        return [{ path, code: 'format_open', why: 'expected object' }];
      }
      const problems = [];
      for (const key of schema.required || []) {
        if (!Object.prototype.hasOwnProperty.call(value, key)) {
          problems.push({ path: `${path}.${key}`, code: 'format_open', why: 'required property absent' });
        }
      }
      for (const key of Object.keys(value)) {
        if (!schema.properties[key]) {
          problems.push({ path: `${path}.${key}`, code: 'format_open', why: 'additional property' });
          continue;
        }
        problems.push(...validate(schema.properties[key], value[key], `${path}.${key}`));
      }
      return problems;
    }
    case 'array': {
      if (!Array.isArray(value)) return [{ path, code: 'format_open', why: 'expected array' }];
      if (schema.minItems !== undefined && value.length < schema.minItems) {
        return [{ path, code: 'format_open', why: `fewer than ${schema.minItems} items` }];
      }
      return value.flatMap((v, i) => validate(schema.items, v, `${path}[${i}]`));
    }
    case 'string':
      if (typeof value !== 'string') return [{ path, code: 'format_open', why: 'expected string' }];
      if (value.length < (schema.minLength ?? 1)) {
        return [{ path, code: 'format_open', why: 'shorter than the minimum' }];
      }
      return [];
    case 'integer':
      return Number.isInteger(value) ? [] : [{ path, code: 'format_open', why: 'expected integer' }];
    case 'boolean':
      return typeof value === 'boolean' ? [] : [{ path, code: 'format_open', why: 'expected boolean' }];
    case 'digest':
      return typeof value === 'string' && DIGEST.test(value)
        ? [] : [{ path, code: 'format_open', why: 'expected sha256 digest' }];
    case 'enum':
      return schema.values.includes(value)
        ? [] : [{ path, code: 'format_open', why: `not one of ${schema.values.join('|')}` }];
    case 'const':
      return value === schema.value
        ? [] : [{ path, code: 'format_open', why: `expected ${schema.value}` }];
    default:
      return [{ path, code: 'format_open', why: `unknown type ${schema.type}` }];
  }
}
