// AC-7, AC-8 — the unavailable arm, and what a request may never claim.

import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  requestedFamily, dispatchRecord, checkUnanswered, checkRequestedSurvives,
} from '../lib/family.mjs';
import { Kernel } from '../lib/kernel.mjs';
import { group, ok, eq, refuses } from './harness.mjs';
import { asObject, assignmentDoc, contractDoc, RENDERED } from './fixtures.mjs';

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

  // Through the Gate, because that is where the property lives. The previous
  // version called a standalone `unavailableArm` that nothing on the production
  // path invoked; the Kernel's own arm check ran only after completion had
  // established everything passed, which is precisely the case an unavailable
  // result rules out.
  group('AC-7 · the unavailable arm reaches its status through the same reduction', () => {
    const cross = {
      independence: {
        required: 'cross_family_required',
        requested_family: ['openai', 'qwen'],
        assurance: 'workflow_attested',
      },
    };
    const build = (dispatchOver = {}, unavailableOver = {}) => {
      const k = new Kernel(join(mkdtempSync(join(tmpdir(), 'v1f-')), 'log.ndjson'));
      const c = asObject(contractDoc(cross));
      k.approve({
        lineage: 'L', revision: 'r1', bytes: c.bytes, identity: c.identity,
        actor: 'Owner', rendered: RENDERED(c.bytes), render: RENDERED,
      });
      const a = asObject(assignmentDoc());
      k.issueAssignment({
        lineage: 'L', run: 'run1', bytes: a.bytes, identity: a.identity, actor: 'Owner',
      });
      const at = k.openAttempt({
        lineage: 'L', run: 'run1', producer: 'P', obligations: ['O'], submitter: 'P',
      });
      k.recordDispatch({
        lineage: 'L', run: 'run1', attempt: at.attempt, obligation: 'O', ...dispatchOver,
      });
      k.recordUnavailable({
        lineage: 'L', run: 'run1', obligation: 'O', attempt: at.attempt,
        requested: ['openai', 'qwen'], ...unavailableOver,
      });
      return k;
    };

    eq('a well-formed arm is unavailable',
      build().status({ lineage: 'L', run: 'run1' }).byObligation.O.status, 'unavailable');

    // Each of these used to reach `unavailable` unchecked.
    const substituted = build({ substitutedFamily: 'anthropic' });
    eq('a substitute seat answering is invalid, not unavailable',
      substituted.status({ lineage: 'L', run: 'run1' }).byObligation.O.code,
      'same_family_substituted');
    const answered = build({ answeredFamily: 'anthropic' });
    eq('a same-family seat standing in',
      answered.status({ lineage: 'L', run: 'run1' }).byObligation.O.code,
      'same_family_substituted');
    const swapped = build({}, { requested: ['anthropic'] });
    eq('a request nobody made', swapped.status({ lineage: 'L', run: 'run1' }).byObligation.O.code,
      'requested_substituted');

    // And a solo Contract cannot have an unavailable arm at all: nothing was
    // requested, so nothing can have been missing.
    const k = new Kernel(join(mkdtempSync(join(tmpdir(), 'v1f-')), 'log.ndjson'));
    const c = asObject(contractDoc());
    k.approve({
      lineage: 'L', revision: 'r1', bytes: c.bytes, identity: c.identity,
      actor: 'Owner', rendered: RENDERED(c.bytes), render: RENDERED,
    });
    const a = asObject(assignmentDoc());
    k.issueAssignment({
      lineage: 'L', run: 'run1', bytes: a.bytes, identity: a.identity, actor: 'Owner',
    });
    const at = k.openAttempt({
      lineage: 'L', run: 'run1', producer: 'P', obligations: ['O'], submitter: 'P',
    });
    k.recordUnavailable({
      lineage: 'L', run: 'run1', obligation: 'O', attempt: at.attempt, requested: ['openai'],
    });
    eq('an unavailable arm on a solo Contract',
      k.status({ lineage: 'L', run: 'run1' }).byObligation.O.code, 'requested_from_wrong_source');
  });
}
