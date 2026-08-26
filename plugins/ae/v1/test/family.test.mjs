// AC-7, AC-8 — the unavailable arm, and what a request may never claim.

import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { requestedFamily, dispatchRecord } from '../lib/family.mjs';
import { Kernel } from '../lib/kernel.mjs';
import { RECORDS } from '../schema/records.mjs';
import { group, ok, eq, refuses } from './harness.mjs';
import { asObject, assignmentDoc, contractDoc, RENDERED, SOURCE_ROOT } from './fixtures.mjs';

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
    // Absent, not null and not empty. The record schema has no position for
    // either field, so a dispatch claiming an answer nobody gave is not a record —
    // which is stronger than a function that would have refused one.
    const rec = dispatchRecord({ contract, ...base });
    ok('observed is absent', !('observed' in rec));
    ok('effective is absent', !('effective' in rec));
    ok('the schema has no position for observed',
      RECORDS.dispatch_attempt.properties.observed === undefined);
    ok('nor for effective',
      RECORDS.dispatch_attempt.properties.effective === undefined);
    ok('and it admits nothing beside what it names',
      RECORDS.dispatch_attempt.additional === false);
  });

  const cross = {
    independence: {
      required: 'cross_family_required',
      requested_family: ['openai', 'qwen'],
      assurance: 'workflow_attested',
    },
  };

  group('AC-7 · the unavailable arm reaches its status through the same reduction', () => {
    const build = (dispatchOver = {}, unavailableOver = {}) => {
      const k = new Kernel(join(mkdtempSync(join(tmpdir(), 'v1f-')), 'log.ndjson'), { sourceRoot: SOURCE_ROOT });
      const c = asObject(contractDoc(cross));
      k.approve({
        lineage: 'L', revision: 'r1', bytes: c.bytes, identity: c.identity,
        actor: 'Human Owner', rendered: RENDERED(c.bytes), render: RENDERED,
      });
      const a = asObject(assignmentDoc());
      k.issueAssignment({
        lineage: 'L', run: 'run1', bytes: a.bytes, identity: a.identity, actor: 'Human Owner',
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
    const k = new Kernel(join(mkdtempSync(join(tmpdir(), 'v1f-')), 'log.ndjson'), { sourceRoot: SOURCE_ROOT });
    const c = asObject(contractDoc());
    k.approve({
      lineage: 'L', revision: 'r1', bytes: c.bytes, identity: c.identity,
      actor: 'Human Owner', rendered: RENDERED(c.bytes), render: RENDERED,
    });
    const a = asObject(assignmentDoc());
    k.issueAssignment({
      lineage: 'L', run: 'run1', bytes: a.bytes, identity: a.identity, actor: 'Human Owner',
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

  group('AC-7 · the choice is recorded, and only after the fact', () => {
    // "After the capability was found unavailable" is a property of the append:
    // there is a record the decision must follow. It used to be checked at
    // completion, which an unavailable run never reaches — completion stops at
    // `not_all_passed` first — so the ordering check sat in an unreachable branch.
    const k = new Kernel(join(mkdtempSync(join(tmpdir(), 'v1u-')), 'log.ndjson'), { sourceRoot: SOURCE_ROOT });
    const c = asObject(contractDoc(cross));
    k.approve({
      lineage: 'L', revision: 'r1', bytes: c.bytes, identity: c.identity,
      actor: 'Human Owner', rendered: RENDERED(c.bytes), render: RENDERED,
    });
    const a = asObject(assignmentDoc());
    k.issueAssignment({
      lineage: 'L', run: 'run1', bytes: a.bytes, identity: a.identity, actor: 'Human Owner',
    });
    const at = k.openAttempt({
      lineage: 'L', run: 'run1', producer: 'P', obligations: ['O'], submitter: 'P',
    });

    refuses('a choice from someone the Contract does not name', 'authority_not_granted',
      () => k.decideUnavailable({ lineage: 'L', run: 'run1', actor: 'P', choice: 'stop' }));
    refuses('a choice before anything was unavailable', 'human_input_absent',
      () => k.decideUnavailable({ lineage: 'L', run: 'run1', actor: 'Human Owner', choice: 'stop' }));

    k.recordDispatch({ lineage: 'L', run: 'run1', attempt: at.attempt, obligation: 'O' });
    k.recordUnavailable({
      lineage: 'L', run: 'run1', obligation: 'O', attempt: at.attempt,
      requested: ['openai', 'qwen'],
    });

    refuses('a choice outside wait/stop/amend', 'human_input_absent',
      () => k.decideUnavailable({ lineage: 'L', run: 'run1', actor: 'Human Owner', choice: 'proceed' }));

    const decision = k.decideUnavailable({
      lineage: 'L', run: 'run1', actor: 'Human Owner', choice: 'stop',
    });
    eq('the choice is recorded', decision.choice, 'stop');
    eq('externally produced', decision.origin, 'host');
    ok('and after the record it responds to',
      decision.seq > k.records().find((r) => r.kind === 'capability_unavailable').seq);

    // And the run still produces no Acceptance: `unavailable` is not `passed`.
    ok('the arm reaches no completion', k.status({ lineage: 'L', run: 'run1' }).allPassed === false);
  });
}
