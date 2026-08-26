// The requested family, and the unavailable arm — AC-8 and AC-7.
//
// The Contract states the requested family and nothing else does. The Assignment
// has no such field at all (its schema refuses one), and configuration is not
// consulted: two sources for one fact is how the fact gets quietly changed.
//
// Where nothing answered, `observed` and `effective` are **absent**. Not null,
// not empty, not defaulted — a present-but-empty field is a claim about an
// observation nobody made, which is the substitution this refuses.

import { fail } from './codes.mjs';
import { deepFreeze } from './freeze.mjs';

export function requestedFamily(contract) {
  const ind = contract.independence || {};
  if (ind.required !== 'cross_family_required') return null;
  const requested = ind.requested_family;
  if (!Array.isArray(requested) || requested.length === 0) {
    fail('requested_dropped', 'cross_family_required without a requested family', {});
  }
  return requested;
}

// Reading it from anywhere else is the defect, so the reader takes only the
// Contract. An assignment or a config passed here would be a type error at the
// call site rather than a silent fallback.
export function dispatchRecord({ contract, lineage, run, attempt, obligation }) {
  const requested = requestedFamily(contract);
  if (requested === null) {
    fail('requested_dropped', 'no cross-family requirement to dispatch', {});
  }
  return {
    kind: 'dispatch_attempt',
    lineage, run, attempt, obligation,
    // A copy, deeply frozen. Storing the Contract's own array by reference meant
    // that mutating the dispatch mutated the Contract, and the survival check
    // then compared a value with itself. Shallow freezing would stop the array
    // growing while leaving anything inside it editable — the same defect one
    // level in, which is what `deepFreeze` exists for.
    requested: deepFreeze([...requested]),
    // `observed` and `effective` are absent, and stay absent until a backend
    // answers. V1 has no successful path (that is V3), so in V1 they never
    // appear — and their absence is exactly what AC-8 checks.
  };
}

const FORBIDDEN_WHEN_UNANSWERED = ['observed', 'effective'];
