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
import { readFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Kernel } from '../lib/kernel.mjs';
import { auditOriginSurface } from '../lib/source-audit.mjs';

const libDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'lib');
import { validate } from '../lib/schema.mjs';
import { RECORDS } from '../schema/records.mjs';
import { group, ok, eq, refuses } from './harness.mjs';
import { asObject, assignmentDoc, contractDoc, RENDERED, COMMAND, SOURCE_ROOT, OWNER } from './fixtures.mjs';

const fresh = () => new Kernel(join(mkdtempSync(join(tmpdir(), 'k-')), 'log.ndjson'), { sourceRoot: SOURCE_ROOT, render: RENDERED, owner: OWNER });

const doc = asObject(contractDoc());
const approve = (k, over = {}) => k.approve({
  lineage: 'L', revision: 'r1', bytes: doc.bytes, identity: doc.identity,
  actor: 'Human Owner', rendered: RENDERED(doc.bytes), ...over,
});

export function kernelTests() {
  group('AC-5 · a caller cannot manufacture a host-collected input', () => {
    const k = fresh();
    // There is no way to reach the stamper. It was a public method, so the
    // guarded operations could be walked around entirely: calling it with
    // `operation: 'unavailable_decision'` appended a valid choice before anything
    // had been found unavailable. Being the only stamper is not a property if the
    // stamper is reachable directly.
    ok('the stamper is not reachable', k.collectHumanInput === undefined);
    // And no public operation takes an origin, so there is no parameter through
    // which one could be supplied. Read off the source, because "there is no such
    // parameter" is a fact about the program rather than about a value.
    eq('no public method takes an origin',
      auditOriginSurface({ readFileSync, dir: libDir }).join(','), '');

    // Approval goes through it, and what lands is host-origin.
    approve(k);
    const rec = k.records().find((r) => r.kind === 'human_decision_activation');
    eq('the Kernel stamps the origin', rec.origin, 'host');

    // And the record shape pins it: a record claiming host origin cannot exist
    // with anything else in that position. Asserted against the schema, because
    // there is no longer a way to attempt the append — the Kernel's ledger is
    // private, so every record goes through the operation that guards it.
    const problems = validate(RECORDS.human_decision_unavailable, {
      kind: 'human_decision_unavailable', operation: 'unavailable_decision',
      actor: 'Human Owner', lineage: 'L', run: 'run1', answers: 3,
      choice: 'stop', origin: 'model', seq: 0,
    });
    ok('a decision claiming another origin is not a valid record', problems.length > 0);
  });

  group('AC-12 · one decision shape per operation', () => {
    // A single `human_decision` carried every operation's fields as optional, so
    // it admitted an activation with a choice and an unavailable decision with
    // none — combinations no consumer can use.
    ok('an activation without its revision and view is refused',
      validate(RECORDS.human_decision_activation, {
        kind: 'human_decision_activation', operation: 'activation', actor: 'Human Owner',
        lineage: 'L', origin: 'host', seq: 0,
      }).length > 0);
    ok('a choice decision without a choice is refused',
      validate(RECORDS.human_decision_unavailable, {
        kind: 'human_decision_unavailable', operation: 'unavailable_decision',
        actor: 'Human Owner', lineage: 'L', run: 'run1', origin: 'host', seq: 0,
      }).length > 0);
    // And an unavailable decision that answers nothing in particular: it was a
    // `human_decision_choice` carrying neither the run nor the record it
    // answered, so a decision for one run was replayed into every run.
    ok('an unavailable decision with no run or answer is refused',
      validate(RECORDS.human_decision_unavailable, {
        kind: 'human_decision_unavailable', operation: 'unavailable_decision',
        actor: 'Human Owner', lineage: 'L', choice: 'stop', origin: 'host', seq: 0,
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
      actor: 'Human Owner', rendered: RENDERED(other.bytes),
    });
    eq('the first lineage is unchanged', k.currentRevision('L'), 'r1');
  });

  group('AC-5 · the Contract names who may activate it', () => {
    // AC-5's table puts activation, sign-off and the unavailable decision in one
    // row: the Human Owner, and no model. `actor` was whatever the caller wrote,
    // so a Contract could be activated by someone it does not name.
    const k = fresh();
    refuses('someone the Contract does not name', 'authority_not_granted',
      () => approve(k, { actor: 'P' }));
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
      lineage: 'L', run: 'run1', bytes: a.bytes, identity: a.identity, actor: 'Human Owner',
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
      lineage: 'L', run: 'run1', bytes: a.bytes, identity: a.identity, actor: 'Human Owner',
    });
    const { byObligation } = k.status({ lineage: 'L', run: 'run1' });
    eq('the approved obligation is judged', Object.keys(byObligation).join(','), 'O');
  });
}
