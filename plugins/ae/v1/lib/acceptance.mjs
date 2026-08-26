// Completion — AC-1.
//
// An `Acceptance` exists only when every obligation is `passed` and the Human
// Owner has signed for *this* revision, *this* run, *this* deliverable, after the
// Gate reported `passed`. Each of those bindings is checked separately, because
// an implementation checking only the run would pass a sign-off for the wrong
// revision.
//
// The unavailable arm reaches no Acceptance and needs none: `unavailable` is not
// `passed`, and nothing else about the run changes that.

import { reduceAll, STATUS } from './gate.mjs';
import { requireHumanInput } from './authority.mjs';
import { fail } from './codes.mjs';

export function emitAcceptance({
  contract, lineage, run, deliverable, records, currentRevision, signoff,
  admit, inputsChanged,
}) {
  const { byObligation, allPassed } = reduceAll({
    records, lineage, obligations: contract.obligations, currentRevision, admit, inputsChanged,
  });

  if (!allPassed) {
    const first = contract.obligations.find((o) => byObligation[o].status !== STATUS.PASSED);
    fail('not_all_passed', 'completion requires every obligation to be passed', {
      obligation: first, status: byObligation[first].status,
    });
  }

  // The sign-off is a human input from the trust root — not a field the
  // submitting party wrote about itself.
  requireHumanInput('signoff', signoff);

  // Bound to this run, and to nothing else. Three separate checks so that an
  // implementation satisfying one does not appear to satisfy all three.
  if (signoff.run !== run) {
    fail('signoff_wrong_run', 'the sign-off belongs to another run', {
      expected: run, actual: signoff.run,
    });
  }
  if (signoff.contract_revision !== currentRevision) {
    fail('signoff_wrong_revision', 'the sign-off belongs to another revision', {
      expected: currentRevision, actual: signoff.contract_revision,
    });
  }
  if (signoff.deliverable !== deliverable.identity) {
    fail('signoff_wrong_deliverable', 'the sign-off belongs to another deliverable', {
      expected: deliverable.identity, actual: signoff.deliverable,
    });
  }

  // After the Gate, not before. A sign-off recorded first is approval of
  // something that had not been decided yet.
  const lastGateInput = Math.max(...records.map((r) => r.seq ?? -1), -1);
  if (!(signoff.seq > lastGateInput)) {
    fail('signoff_before_gate', 'the sign-off predates the Gate result', {
      signoff: signoff.seq, lastFact: lastGateInput,
    });
  }

  // Where the Contract required no independent review, the Acceptance says so and
  // the statement is checked against the Contract. A stated absence, never an
  // empty slot — and an Acceptance silent about a review the Contract *did*
  // require is inadmissible.
  const required = contract.independence.required === 'cross_family_required';
  const review = required
    ? { required: true, accepted_review: signoff.accepted_review }
    : { required: false, statement: 'no independent review required by this Contract' };

  if (required && !signoff.accepted_review) {
    fail('review_required_absent', 'the Contract required a review and none is carried', {});
  }

  return {
    lineage,
    contract_revision: currentRevision,
    contract_identity: contract.identity,
    deliverable,
    decision: { outcome: 'accepted', origin: 'host', run, seq: signoff.seq },
    review,
  };
}
