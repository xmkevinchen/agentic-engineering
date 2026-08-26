// AC-4 — the Gate selects, then reduces, and fails closed.

import { reduce, reduceAll, STATUS, PRECEDENCE } from '../lib/gate.mjs';
import { group, ok, eq } from './harness.mjs';

const A1 = { kind: 'attempt_opened', lineage: 'L', attempt: 'a1' };
const A2 = { kind: 'attempt_opened', lineage: 'L', attempt: 'a2' };
const obs = (attempt, satisfied, rev = 'r1') => ({
  kind: 'observation', lineage: 'L', obligation: 'O', attempt, contract_revision: rev, satisfied,
});
const unavailable = (attempt) => ({
  kind: 'capability_unavailable', lineage: 'L', obligation: 'O', attempt,
});

const run = (records, opts = {}) => reduce({
  records, lineage: 'L', obligation: 'O', currentRevision: 'r1', ...opts,
}).status;

export function gateTests() {
  group('AC-4 · every status reachable by its own condition', () => {
    eq('passed', run([A1, obs('a1', true)]), STATUS.PASSED);
    eq('failed', run([A1, obs('a1', false)]), STATUS.FAILED);
    eq('pending — attempt opened, nothing submitted', run([A1]), STATUS.PENDING);
    eq('unavailable', run([A1, unavailable('a1')]), STATUS.UNAVAILABLE);
    eq('stale — superseded revision', run([A1, obs('a1', true, 'r0')]), STATUS.STALE);
    eq('stale — material input changed',
      run([A1, obs('a1', true)], { inputsChanged: () => true }), STATUS.STALE);
    eq('invalid — inadmissible',
      run([A1, obs('a1', true)], { admit: () => 'binding_missing' }), STATUS.INVALID);
  });

  group('AC-4 · the latest attempt decides', () => {
    // A failure does not survive a legitimate retry.
    eq('retry after failure', run([A1, obs('a1', false), A2, obs('a2', true)]), STATUS.PASSED);
    // Nor does an inadmissible earlier attempt poison a later valid one.
    eq('retry after invalid',
      run([A1, obs('a1', true), A2, obs('a2', true)], {
        admit: (r) => (r.attempt === 'a1' ? 'binding_missing' : null),
      }), STATUS.PASSED);
    // And an older pass does not survive an attempt that produced nothing:
    // a retry with no result is an absence, not a pass.
    eq('empty latest attempt', run([A1, obs('a1', true), A2]), STATUS.PENDING);
  });

  group('AC-4 · contradiction fails closed', () => {
    eq('failed and passed in one attempt',
      run([A1, obs('a1', true), obs('a1', false)]), STATUS.INVALID);
    // Recency must not resolve it. Order both ways to be sure.
    eq('order does not resolve it',
      run([A1, obs('a1', false), obs('a1', true)]), STATUS.INVALID);
  });

  group('AC-4 · selection judges nothing', () => {
    // The record a status exists to report must survive selection. Two earlier
    // drafts filtered here and each time the status became `pending`.
    eq('superseded evidence is stale, not pending',
      run([A1, obs('a1', true, 'r0')]), STATUS.STALE);
    eq('inadmissible evidence is invalid, not pending',
      run([A1, obs('a1', true)], { admit: () => 'binding_unresolved' }), STATUS.INVALID);
    eq('unavailable is unavailable, not pending',
      run([A1, unavailable('a1')]), STATUS.UNAVAILABLE);
  });

  group('AC-4 · a supplied status changes nothing', () => {
    const forged = { ...obs('a1', false), status: 'passed' };
    eq('asserted status ignored', run([A1, forged]), STATUS.FAILED);
  });

  group('AC-4 · precedence within the selected candidate', () => {
    eq('order is invalid > stale > unavailable > failed > passed',
      PRECEDENCE.join('>'), 'invalid>stale>unavailable>failed>passed');
    // invalid outranks stale: uninterpretable evidence is not interpreted further.
    eq('invalid over stale',
      run([A1, obs('a1', true, 'r0')], { admit: () => 'binding_missing' }), STATUS.INVALID);
    // stale outranks unavailable, and both outrank a plain failure.
    eq('unavailable over failed',
      run([A1, obs('a1', false), unavailable('a1')]), STATUS.UNAVAILABLE);
  });

  group('AC-4 · deterministic across processes', () => {
    const records = [A1, obs('a1', true)];
    const a = reduce({ records, lineage: 'L', obligation: 'O', currentRevision: 'r1' });
    const b = reduce({ records: [...records], lineage: 'L', obligation: 'O', currentRevision: 'r1' });
    eq('same facts, same status', a.status, b.status);
    eq('same facts, same selection', a.selected, b.selected);
  });

  group('AC-1 · completion needs every obligation passed', () => {
    const recs = [
      { kind: 'attempt_opened', lineage: 'L', attempt: 'a1' },
      { ...obs('a1', true), obligation: 'O1' },
      { ...obs('a1', true), obligation: 'O2' },
    ];
    ok('all passed', reduceAll({
      records: recs, lineage: 'L', obligations: ['O1', 'O2'], currentRevision: 'r1',
    }).allPassed);
    ok('one pending blocks', reduceAll({
      records: recs, lineage: 'L', obligations: ['O1', 'O2', 'O3'], currentRevision: 'r1',
    }).allPassed === false);
    // An empty obligation list is not "everything passed" — it is a Contract that
    // promised nothing, and vacuous completion is the failure AE exists to catch.
    ok('no obligations is not completion', reduceAll({
      records: recs, lineage: 'L', obligations: [], currentRevision: 'r1',
    }).allPassed === false);
  });
}
