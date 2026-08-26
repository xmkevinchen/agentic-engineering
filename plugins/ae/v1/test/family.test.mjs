// AC-7, AC-8 — the unavailable arm, and what a request may never claim.

import {
  requestedFamily, dispatchRecord, checkUnanswered, checkRequestedSurvives, unavailableArm,
} from '../lib/family.mjs';
import { group, ok, eq, refuses } from './harness.mjs';

const contract = {
  independence: {
    required: 'cross_family_required',
    requested_family: ['openai', 'qwen'],
    assurance: 'workflow_attested',
  },
};
const solo = { independence: { required: 'none', assurance: 'workflow_attested' } };
const base = { lineage: 'L', run: 'run1', attempt: 'a1', obligation: 'O' };

export function familyTests() {
  group('AC-8 · the Contract is the sole source of the request', () => {
    eq('a cross-family Contract states it', requestedFamily(contract).join(','), 'openai,qwen');
    ok('a solo Contract states none', requestedFamily(solo) === null);
    refuses('declaring the requirement without naming a family', 'requested_dropped',
      () => requestedFamily({ independence: { required: 'cross_family_required' } }));
    // The reader takes only the Contract. There is no parameter through which an
    // Assignment or a config could supply this, which is the point.
    const rec = dispatchRecord({ contract, ...base });
    eq('the dispatch carries what the Contract stated', rec.requested.join(','), 'openai,qwen');
  });

  group('AC-8 · nothing answered means absent, not empty', () => {
    const rec = dispatchRecord({ contract, ...base });
    ok('observed is absent', !('observed' in rec));
    ok('effective is absent', !('effective' in rec));
    ok('an unanswered record passes', checkUnanswered(rec));
    refuses('observed present with nothing behind it', 'observed_without_answer',
      () => checkUnanswered({ ...rec, observed: null }));
    refuses('effective present with nothing behind it', 'observed_without_answer',
      () => checkUnanswered({ ...rec, effective: '' }));
    refuses('the request dropped entirely', 'requested_dropped',
      () => checkUnanswered({ ...rec, requested: undefined }));
  });

  group('AC-8 · the request survives unaltered', () => {
    const rec = dispatchRecord({ contract, ...base });
    ok('an unaltered record', checkRequestedSurvives(contract, rec));
    refuses('a default substituted for it', 'requested_substituted',
      () => checkRequestedSurvives(contract, { ...rec, requested: ['anthropic'] }));
    refuses('a narrowed request', 'requested_substituted',
      () => checkRequestedSurvives(contract, { ...rec, requested: ['openai'] }));
  });

  group('AC-7 · the unavailable arm', () => {
    const dispatch = dispatchRecord({ contract, ...base });
    const good = { origin: 'host', choice: 'stop', seq: 12 };

    eq('a well-formed arm records the choice',
      unavailableArm({
        contract, records: [dispatch], unavailableSeq: 10, decision: good,
        implementerFamily: 'anthropic',
      }).choice, 'stop');

    refuses('a substitute seat answering', 'same_family_substituted',
      () => unavailableArm({
        contract, records: [{ ...dispatch, substituted_family: 'anthropic' }],
        unavailableSeq: 10, decision: good, implementerFamily: 'anthropic',
      }));
    refuses('a same-family seat standing in', 'same_family_substituted',
      () => unavailableArm({
        contract, records: [{ ...dispatch, answered_family: 'anthropic' }],
        unavailableSeq: 10, decision: good, implementerFamily: 'anthropic',
      }));

    refuses('no decision at all', 'human_input_absent',
      () => unavailableArm({ contract, records: [dispatch], unavailableSeq: 10, decision: null }));
    refuses('a decision from model output', 'human_input_absent',
      () => unavailableArm({
        contract, records: [dispatch], unavailableSeq: 10,
        decision: { origin: 'model', choice: 'stop', seq: 12 },
      }));
    refuses('a caller-written field', 'human_input_self_supplied',
      () => unavailableArm({
        contract, records: [dispatch], unavailableSeq: 10,
        decision: { origin: 'host', choice: 'stop', seq: 12, human: true },
      }));
    // A pre-authorized choice is not a decision about something that had not
    // happened yet.
    refuses('a choice recorded before the capability was found unavailable', 'human_input_absent',
      () => unavailableArm({
        contract, records: [dispatch], unavailableSeq: 10,
        decision: { origin: 'host', choice: 'stop', seq: 9 },
      }));
    refuses('a choice outside wait/stop/amend', 'human_input_absent',
      () => unavailableArm({
        contract, records: [dispatch], unavailableSeq: 10,
        decision: { origin: 'host', choice: 'proceed', seq: 12 },
      }));
  });
}
