// AC-4 — the Gate selects, then reduces, and fails closed.

import { reduce, reduceAll, STATUS, PRECEDENCE } from '../lib/gate.mjs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { group, ok, eq } from './harness.mjs';

// Every record carries the run it belongs to. Selection is scoped by it, because
// a lineage outlives its executions and evidence from one used to decide another.
const A1 = { kind: 'attempt_opened', lineage: 'L', run: 'run1', attempt: 'a1' };
const A2 = { kind: 'attempt_opened', lineage: 'L', run: 'run1', attempt: 'a2' };
// The observation names its evidence and claims no outcome — the schema has no
// field for one. `outcome` here is what the *runner's* record would say, threaded
// through `outcomeOf` below, so these cases exercise the reduction rather than a
// submission's opinion of itself.
const obs = (attempt, outcome, rev = 'r1') => ({
  kind: 'observation', lineage: 'L', run: 'run1', obligation: 'O', attempt,
  contract_revision: rev, command_result: outcome ? 'green' : 'red',
});
const unavailable = (attempt) => ({
  kind: 'capability_unavailable', lineage: 'L', run: 'run1', obligation: 'O', attempt,
});

// The three readers the reduction requires. None has a permissive default: an
// optional check is a check that does not exist, and omitting one now throws
// rather than quietly passing everything.
const DEFAULTS = {
  admit: () => null,
  inputsChanged: () => false,
  outcomeOf: (r) => r.command_result === 'green',
};
const run = (records, opts = {}) => reduce({
  records, lineage: 'L', run: 'run1', obligation: 'O', currentRevision: 'r1',
  ...DEFAULTS, ...opts,
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
    // Two shapes of the same claim: a `status` field, and the `satisfied` field
    // the reduction used to copy. Neither is read — the verdict comes from the
    // runner's record through `outcomeOf`.
    eq('an asserted status is ignored',
      run([A1, { ...obs('a1', false), status: 'passed' }]), STATUS.FAILED);
    eq('an asserted satisfaction is ignored',
      run([A1, { ...obs('a1', false), satisfied: true }]), STATUS.FAILED);
  });

  group('AC-4 · the reduction refuses to run without its readers', () => {
    const records = [A1, obs('a1', true)];
    const base = { records, lineage: 'L', run: 'run1', obligation: 'O', currentRevision: 'r1' };
    for (const missing of ['admit', 'inputsChanged', 'outcomeOf']) {
      const opts = { ...DEFAULTS };
      delete opts[missing];
      let threw = false;
      try { reduce({ ...base, ...opts }); } catch { threw = true; }
      ok(`omitting ${missing} throws rather than passing everything`, threw);
    }
  });

  group('AC-4 · the Gate does not read its own output', () => {
    // `gate_result` carries the same routing fields, so an earlier version
    // selected it on the next pass and turned a `passed` into an `invalid`.
    const verdict = {
      kind: 'gate_result', lineage: 'L', obligation: 'O', attempt: 'a1',
      run: 'run1', contract_revision: 'r1', status: 'passed',
    };
    eq('a recorded verdict does not poison the next reduction',
      run([A1, obs('a1', true), verdict]), STATUS.PASSED);
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
    // Two calls inside one process share module state, a warmed cache and one
    // random seed: that establishes repeatability, not determinism. The real
    // check spawns fresh processes, and varies TZ and locale so an ambient
    // dependence would show up as divergence rather than as a passing test.
    const records = [A1, obs('a1', true)];
    const args = JSON.stringify(records);
    const here = fileURLToPath(new URL('./determinism.mjs', import.meta.url));
    const run = (env) => execFileSync(process.execPath, [here, args], {
      env: { ...process.env, ...env }, encoding: 'utf8',
    });
    const a = run({});
    const b = run({});
    const c = run({ TZ: 'Asia/Tokyo', LANG: 'ja_JP.UTF-8' });
    eq('a second process agrees', b, a);
    eq('a different timezone and locale agree', c, a);

    // And it is not vacuous: different facts must produce a different result, or
    // the comparison above would pass on a function that ignores its input.
    const different = run({}) === execFileSync(process.execPath, [
      here, JSON.stringify([A1, obs('a1', false)]),
    ], { encoding: 'utf8' });
    ok('different facts produce a different result', different === false);
  });

  group('AC-1 · completion needs every obligation passed', () => {
    const recs = [
      { kind: 'attempt_opened', lineage: 'L', run: 'run1', attempt: 'a1' },
      { ...obs('a1', true), obligation: 'O1' },
      { ...obs('a1', true), obligation: 'O2' },
    ];
    ok('all passed', reduceAll({
      records: recs, lineage: 'L', run: 'run1', obligations: ['O1', 'O2'],
      currentRevision: 'r1', ...DEFAULTS,
    }).allPassed);
    ok('one pending blocks', reduceAll({
      records: recs, lineage: 'L', run: 'run1', obligations: ['O1', 'O2', 'O3'],
      currentRevision: 'r1', ...DEFAULTS,
    }).allPassed === false);
    // An empty obligation list is not "everything passed" — it is a Contract that
    // promised nothing, and vacuous completion is the failure AE exists to catch.
    ok('no obligations is not completion', reduceAll({
      records: recs, lineage: 'L', run: 'run1', obligations: [], currentRevision: 'r1', ...DEFAULTS,
    }).allPassed === false);
  });
}
