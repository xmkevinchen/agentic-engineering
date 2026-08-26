// The Kernel as a channel — the defect that made every other check optional.
//
// The first implementation was a set of correct functions a caller could
// assemble, or not: `reduce` took an optional admissibility check, and a
// standalone `requireHumanInput` took any object whose caller wrote
// `origin: 'host'`. Every check was right and none was compulsory.
//
// These cases probe the bypasses directly. They are the ones that matter: a
// criterion enforced only when the caller opts in is not enforced.

import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Kernel } from '../lib/kernel.mjs';
import { validate } from '../lib/schema.mjs';
import { RECORDS } from '../schema/records.mjs';
import { group, ok, eq, refuses } from './harness.mjs';
import { asObject, assignmentDoc, contractDoc, RENDERED, COMMAND } from './fixtures.mjs';

const fresh = () => new Kernel(join(mkdtempSync(join(tmpdir(), 'k-')), 'log.ndjson'));

const doc = asObject(contractDoc());
const approve = (k, over = {}) => k.approve({
  lineage: 'L', revision: 'r1', bytes: doc.bytes, identity: doc.identity,
  actor: 'H', rendered: RENDERED(doc.bytes), render: RENDERED, ...over,
});

export function kernelTests() {
  group('AC-5 · a caller cannot manufacture a host-collected input', () => {
    const k = fresh();
    // The bypass: an object with `origin: 'host'` written by whoever holds it.
    refuses('supplying an origin', 'human_input_self_supplied',
      () => k.collectHumanInput({
        operation: 'signoff', actor: 'H', lineage: 'L', choice: 'sign', origin: 'host',
      }));

    // The Kernel stamps it. There is no exported function that does, so holding
    // a host-origin record means having gone through here.
    const rec = k.collectHumanInput({
      operation: 'signoff', actor: 'H', lineage: 'L', choice: 'sign',
    });
    eq('the Kernel stamps the origin', rec.origin, 'host');

    // And the record shape pins it: a record claiming host origin cannot exist
    // with anything else in that position. Asserted against the schema, because
    // there is no longer a way to attempt the append — the Kernel's ledger is
    // private, so every record goes through the operation that guards it.
    const problems = validate(RECORDS.human_decision_choice, {
      kind: 'human_decision_choice', operation: 'signoff', actor: 'H', lineage: 'L',
      choice: 'sign', origin: 'model', seq: 0,
    });
    ok('a decision claiming another origin is not a valid record', problems.length > 0);
  });

  group('AC-12 · one decision shape per operation', () => {
    // A single `human_decision` carried every operation's fields as optional, so
    // it admitted an activation with a choice and an unavailable decision with
    // none — combinations no consumer can use.
    ok('an activation without its revision and view is refused',
      validate(RECORDS.human_decision_activation, {
        kind: 'human_decision_activation', operation: 'activation', actor: 'H',
        lineage: 'L', origin: 'host', seq: 0,
      }).length > 0);
    ok('a choice decision without a choice is refused',
      validate(RECORDS.human_decision_choice, {
        kind: 'human_decision_choice', operation: 'unavailable_decision', actor: 'H',
        lineage: 'L', origin: 'host', seq: 0,
      }).length > 0);
  });

  group('AC-3 · the current revision is derived, never nominated', () => {
    const k = fresh();
    ok('an unapproved lineage has no current revision', k.currentRevision('L') === null);
    approve(k);
    eq('after approval it is the approved one', k.currentRevision('L'), 'r1');
    // A second lineage does not disturb the first — the composition defect an
    // earlier draft had, where currency was computed over the whole log.
    const other = asObject(contractDoc({ lineage: 'OTHER', revision: 't1' }));
    k.approve({
      lineage: 'OTHER', revision: 't1', bytes: other.bytes, identity: other.identity,
      actor: 'H', rendered: RENDERED(other.bytes), render: RENDERED,
    });
    eq('the first lineage is unchanged', k.currentRevision('L'), 'r1');
  });

  group('AC-3 · approval judges the bytes it is given', () => {
    const k = fresh();
    refuses('bytes that do not match the recorded identity', 'identity_mismatch',
      () => approve(k, { bytes: JSON.stringify(contractDoc({ intent: 'tampered' })) }));
    refuses('a Contract naming another lineage', 'identity_mismatch',
      () => approve(k, { lineage: 'ELSEWHERE' }));
    // Schema-valid and incoherent: an obligation with no named observation. It
    // used to be approved and fail later, somewhere else, as something else.
    const broken = asObject(contractDoc({ obligations: ['O', 'UNNAMED'] }));
    refuses('an obligation with no observation', 'format_open',
      () => approve(k, { bytes: broken.bytes, identity: broken.identity,
        rendered: RENDERED(broken.bytes) }));
  });

  group('AC-4 · admissibility is not optional', () => {
    // The Critical defect: `reduce` defaulted `admit` to a function that always
    // passed, so omitting it let a bare observation reach `passed`. `status`
    // builds the check itself and offers no parameter to skip it.
    const k = fresh();
    approve(k);
    const a = asObject(assignmentDoc());
    k.issueAssignment({
      lineage: 'L', run: 'run1', bytes: a.bytes, identity: a.identity, actor: 'H',
    });
    const at = k.openAttempt({
      lineage: 'L', run: 'run1', producer: 'P', obligations: ['O'], submitter: 'P',
    });
    // Through the real operations, not planted: this is a path a producer can
    // actually take. The evidence references name nothing in the log, and they
    // resolve through the Kernel's own index — which cannot be talked out of it.
    k.submitObservation({
      lineage: 'L', run: 'run1', obligation: 'O', observation: COMMAND,
      attempt: at.attempt, producer: 'P',
      artifact: 'art1', pkg: 'pkg1', commandResult: 'cr1', submitter: 'P',
    });
    const { byObligation, allPassed } = k.status({ lineage: 'L', run: 'run1' });
    eq('a bare observation does not pass', byObligation.O.status, 'invalid');
    ok('and completion is not reached', allPassed === false);
  });

  group('AC-4 · the Gate judges the approved Contract, not one it is handed', () => {
    // There is no parameter for it. The obligations come from the approved bytes,
    // so a caller cannot present a Contract with fewer of them, or with its
    // independence requirement removed.
    const k = fresh();
    approve(k);
    const a = asObject(assignmentDoc());
    k.issueAssignment({
      lineage: 'L', run: 'run1', bytes: a.bytes, identity: a.identity, actor: 'H',
    });
    const { byObligation } = k.status({ lineage: 'L', run: 'run1' });
    eq('the approved obligation is judged', Object.keys(byObligation).join(','), 'O');
  });
}
