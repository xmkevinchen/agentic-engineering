// Authority — AC-5 and AC-7.
//
// No party acquires authority by asserting it. Every authority traces to a grant
// that originated outside the party exercising it, and identity comes from the
// record of who acted rather than a field the actor wrote about itself.
//
// This is where three earlier drafts each pushed the regress up one level: the
// runner would vouch for the result, the Assignment for the runner's producer,
// and nothing for the Assignment. The stopping point is the trust root — the
// host's interaction surface and the Harness's own write path — and it is named
// once in the Contract rather than re-invented per criterion.

import { fail } from './codes.mjs';

export const HUMAN_OPERATIONS = Object.freeze([
  'activation',
  'assignment_issuance',
  'signoff',
  'unavailable_decision',
  'retreat_decision',
  'worth_decision',
]);

// An input counts as coming from the trust root when the host collected it and
// the Harness recorded it. `origin` is written by the recorder, never by the
// submission — a submission that sets it is doing the thing this refuses.
export function requireHumanInput(operation, input) {
  if (!HUMAN_OPERATIONS.includes(operation)) {
    fail('authority_not_granted', `not a human operation: ${operation}`, { operation });
  }
  if (!input || input.origin !== 'host') {
    fail('human_input_absent', `${operation} requires an input collected through the host`, {
      operation, origin: input ? input.origin : null,
    });
  }
  if (input.self_declared === true || Object.prototype.hasOwnProperty.call(input, 'human')) {
    // The `human: true` shape is named explicitly because it is the obvious
    // forgery: a field the caller writes about itself, asserting the very thing
    // the check exists to establish.
    fail('human_input_self_supplied', `${operation} may not be satisfied by a caller-written field`, {
      operation,
    });
  }
  return input;
}

// The Assignment is issued by the Human Owner through the root, bound to an
// already-approved revision. An Assignment that appears without an issuance
// record is not an Assignment — which is what stops a producer minting one that
// grants itself what it wants.
export function checkAssignment(assignment, { issuance, approvals, runAssignments }) {
  if (!issuance) {
    fail('assignment_not_issued', 'an Assignment requires an issuance record from the trust root', {
      assignment: assignment.id,
    });
  }
  requireHumanInput('assignment_issuance', issuance);

  if (issuance.beneficiary && issuance.beneficiary === issuance.actor) {
    fail('assignment_self_issued', 'the party an Assignment grants may not issue it', {
      assignment: assignment.id,
    });
  }

  const approved = approvals.some(
    (a) => a.lineage === assignment.lineage && a.revision === assignment.contract_revision,
  );
  if (!approved) {
    fail('assignment_not_issued', 'an Assignment must bind an already-approved revision', {
      assignment: assignment.id, revision: assignment.contract_revision,
    });
  }

  // Exactly one per run. A second is refused, not merely unused.
  const others = runAssignments.filter((a) => a.id !== assignment.id);
  if (others.length > 0) {
    fail('assignment_not_unique', 'a run holds exactly one Assignment', {
      assignment: assignment.id, others: others.map((a) => a.id),
    });
  }

  return assignment;
}

// Identity is established the way AC-14 establishes a human's: from the record of
// who submitted, not from a `producer` field the submission wrote. A submission
// asserting it equals the Assignment's owner is believed on nothing.
export function attributeProducer(submission, hostRecord) {
  if (!hostRecord || hostRecord.origin !== 'harness') {
    fail('identity_self_asserted', 'producer identity comes from the record of who submitted', {
      claimed: submission.producer,
    });
  }
  if (submission.producer != null && submission.producer !== hostRecord.actor) {
    fail('identity_self_asserted', 'a submission may not name a producer other than its submitter', {
      claimed: submission.producer, actual: hostRecord.actor,
    });
  }
  return hostRecord.actor;
}

export function checkGrant(assignment, { producer, action, obligation, paths }) {
  const grants = assignment.grants || {};

  if (action === 'open_attempt') {
    if (grants.attempt_producer !== producer) {
      fail('attempt_not_granted', 'only the granted producer may open an attempt', {
        producer, granted: grants.attempt_producer,
      });
    }
    return true;
  }

  if (action === 'submit_evidence') {
    if (!(grants.obligations || []).includes(obligation)) {
      fail('authority_not_granted', 'the Assignment does not grant this obligation', {
        obligation, granted: grants.obligations,
      });
    }
    return true;
  }

  if (action === 'mutate') {
    if (grants.mutation_producer !== producer) {
      fail('mutation_producer_ungranted', 'mutation authority was granted to another producer', {
        producer, granted: grants.mutation_producer,
      });
    }
    for (const path of paths || []) {
      const inside = (assignment.boundary || []).some((allowed) => {
        const a = allowed.split('/'); const p = path.split('/');
        return a.length <= p.length && a.every((seg, i) => seg === p[i]);
      });
      if (!inside) {
        fail('change_out_of_boundary', 'a change lies outside the granted boundary', { path });
      }
    }
    return true;
  }

  fail('authority_not_granted', `unknown action: ${action}`, { action });
}
