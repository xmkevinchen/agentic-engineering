// AC-5, AC-7 — authority is granted, never claimed.

import {
  requireHumanInput, checkAssignment, attributeProducer, checkGrant, HUMAN_OPERATIONS,
} from '../lib/authority.mjs';
import { group, ok, eq, refuses } from './harness.mjs';

const approvals = [{ lineage: 'L', revision: 'r1' }];
const assignment = {
  id: 'A1', lineage: 'L', contract_revision: 'r1',
  grants: { attempt_producer: 'P', mutation_producer: 'P', obligations: ['O'] },
  boundary: ['docs/v1'],
};
const issuance = { origin: 'host', actor: 'HumanOwner', beneficiary: 'P' };

export function authorityTests() {
  group('AC-5 · human operations need a human input', () => {
    eq('five operations are human', HUMAN_OPERATIONS.length, 6);
    for (const op of HUMAN_OPERATIONS) {
      refuses(`${op} refuses model output`, 'human_input_absent',
        () => requireHumanInput(op, { origin: 'model' }));
      refuses(`${op} refuses a caller-written field`, 'human_input_self_supplied',
        () => requireHumanInput(op, { origin: 'host', human: true }));
    }
    eq('a host-collected input is accepted',
      requireHumanInput('signoff', { origin: 'host' }).origin, 'host');
  });

  group('AC-5 · the Assignment is issued from outside', () => {
    refuses('an Assignment needs an issuance record', 'assignment_not_issued',
      () => checkAssignment(assignment, { issuance: null, approvals, runAssignments: [assignment] }));
    refuses('the party it grants may not issue it', 'assignment_self_issued',
      () => checkAssignment(assignment, {
        issuance: { origin: 'host', actor: 'P', beneficiary: 'P' },
        approvals, runAssignments: [assignment],
      }));
    refuses('it must bind an approved revision', 'assignment_not_issued',
      () => checkAssignment({ ...assignment, contract_revision: 'r9' }, {
        issuance, approvals, runAssignments: [assignment],
      }));
    refuses('a run holds exactly one', 'assignment_not_unique',
      () => checkAssignment(assignment, {
        issuance, approvals, runAssignments: [assignment, { id: 'A2' }],
      }));
    eq('a properly issued Assignment stands',
      checkAssignment(assignment, { issuance, approvals, runAssignments: [assignment] }).id, 'A1');
  });

  group('AC-5 · identity comes from the record, not the submission', () => {
    refuses('a submission may not vouch for itself', 'identity_self_asserted',
      () => attributeProducer({ producer: 'P' }, { origin: 'submission', actor: 'P' }));
    refuses('nor claim to be someone else', 'identity_self_asserted',
      () => attributeProducer({ producer: 'P' }, { origin: 'harness', actor: 'Q' }));
    eq('the recorded submitter is the producer',
      attributeProducer({ producer: 'P' }, { origin: 'harness', actor: 'P' }), 'P');
  });

  group('AC-7 · grants bound what a producer may do', () => {
    refuses('opening an attempt needs the grant', 'attempt_not_granted',
      () => checkGrant(assignment, { producer: 'Q', action: 'open_attempt' }));
    ok('the granted producer may open one',
      checkGrant(assignment, { producer: 'P', action: 'open_attempt' }));
    refuses('an ungranted obligation is refused', 'authority_not_granted',
      () => checkGrant(assignment, { producer: 'P', action: 'submit_evidence', obligation: 'X' }));
    refuses('mutation under another producer is refused', 'mutation_producer_ungranted',
      () => checkGrant(assignment, { producer: 'Q', action: 'mutate', paths: [] }));
    refuses('a change outside the boundary is refused', 'change_out_of_boundary',
      () => checkGrant(assignment, { producer: 'P', action: 'mutate', paths: ['src/x.js'] }));
    ok('a change inside it is allowed',
      checkGrant(assignment, { producer: 'P', action: 'mutate', paths: ['docs/v1/a.md'] }));
  });
}
