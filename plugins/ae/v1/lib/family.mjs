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
    // A copy, frozen. Storing the Contract's own array by reference meant that
    // mutating the dispatch mutated the Contract, and the survival check then
    // compared a value with itself.
    requested: Object.freeze([...requested]),
    // `observed` and `effective` are absent, and stay absent until a backend
    // answers. V1 has no successful path (that is V3), so in V1 they never
    // appear — and their absence is exactly what AC-8 checks.
  };
}

const FORBIDDEN_WHEN_UNANSWERED = ['observed', 'effective'];

export function checkUnanswered(record) {
  for (const field of FORBIDDEN_WHEN_UNANSWERED) {
    if (Object.prototype.hasOwnProperty.call(record, field)) {
      fail('observed_without_answer', `${field} is present though nothing answered`, { field });
    }
  }
  if (!record.requested) fail('requested_dropped', 'the requested identity is gone', {});
  return true;
}

// The dispatch record must carry the Contract's requested identity unchanged.
// A default substituted for it is the failure this catches — the record would
// otherwise look complete while naming a family nobody asked for.
export function checkRequestedSurvives(contract, record) {
  const stated = requestedFamily(contract);
  if (!record.requested) fail('requested_dropped', 'the requested identity is gone', {});
  const a = JSON.stringify(stated);
  const b = JSON.stringify(record.requested);
  if (a !== b) {
    fail('requested_substituted', 'the recorded request is not the one the Contract states', {
      stated, recorded: record.requested,
    });
  }
  return true;
}

// The unavailable arm. Reaching `unavailable` is not enough: no same-family seat
// may stand in, and the human's choice must be externally produced and recorded
// *after* the capability was found unavailable. A choice recorded earlier is not
// a decision about something that had not happened yet.
export function unavailableArm({ contract, records, unavailableSeq, decision, implementerFamily }) {
  const requested = requestedFamily(contract);

  for (const r of records) {
    if (r.kind !== 'dispatch_attempt') continue;
    checkRequestedSurvives(contract, r);
    checkUnanswered(r);
    if (r.substituted_family) {
      fail('same_family_substituted', 'a substitute seat answered for the unavailable one', {
        substituted: r.substituted_family,
      });
    }
    if (r.answered_family && r.answered_family === implementerFamily) {
      fail('same_family_substituted', 'a same-family seat stood in', {
        family: r.answered_family,
      });
    }
  }

  if (!decision) {
    fail('human_input_absent', 'the unavailable arm requires a recorded human decision', {});
  }
  if (decision.origin !== 'host') {
    fail('human_input_absent', 'the decision must be collected through the host', {
      origin: decision.origin,
    });
  }
  if (Object.prototype.hasOwnProperty.call(decision, 'human')) {
    fail('human_input_self_supplied', 'a caller-written field is not a decision', {});
  }
  if (!['wait', 'stop', 'amend'].includes(decision.choice)) {
    fail('human_input_absent', 'the decision must be wait, stop, or amend', {
      choice: decision.choice,
    });
  }
  if (!(decision.seq > unavailableSeq)) {
    fail('human_input_absent', 'the decision predates the unavailable finding', {
      decision: decision.seq, unavailable: unavailableSeq,
    });
  }

  return { requested, choice: decision.choice };
}
