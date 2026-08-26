// AC-5, AC-7 — authority is granted, never claimed.
//
// Against the Kernel, not against helpers. The previous version of this file
// tested `checkAssignment`, `attributeProducer` and `checkGrant` directly, and
// every case passed while nothing on the production path called any of them:
// a green suite that established the functions were correct and not that they
// were reached. Those helpers are gone; the properties are asserted here, on the
// only path a party has.

import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Kernel } from '../lib/kernel.mjs';
import { group, ok, eq, refuses } from './harness.mjs';
import { asObject, assignmentDoc, contractDoc, walk, RENDERED, COMMAND, sha, SOURCE_ROOT } from './fixtures.mjs';

const fresh = () => new Kernel(join(mkdtempSync(join(tmpdir(), 'v1a-')), 'log.ndjson'), { sourceRoot: SOURCE_ROOT });

function approved(k, over = {}) {
  const contract = asObject(contractDoc(over));
  k.approve({
    lineage: 'L', revision: 'r1', bytes: contract.bytes, identity: contract.identity,
    actor: 'Human Owner', rendered: RENDERED(contract.bytes), render: RENDERED,
  });
  return contract;
}

const issue = (k, over = {}, actor = 'Human Owner') => {
  const a = asObject(assignmentDoc(over));
  return k.issueAssignment({
    lineage: 'L', run: 'run1', bytes: a.bytes, identity: a.identity, actor,
  });
};

export function authorityTests() {
  group('AC-5 · the Assignment is issued from outside', () => {
    const k = fresh();
    approved(k);
    refuses('the party it grants may not issue it', 'assignment_self_issued',
      () => issue(k, {}, 'P'));
    refuses('it must bind the current approved revision', 'assignment_not_issued',
      () => issue(k, { contract_revision: 'r9' }));
    refuses('it may not grant an obligation the Contract does not state', 'authority_not_granted',
      () => issue(k, { grants: { attempt_producer: 'P', mutation_producer: 'P', obligations: ['X'] } }));
    eq('a properly issued Assignment stands', issue(k).id, 'A1');
    refuses('a run holds exactly one', 'assignment_not_unique', () => issue(k));
  });

  group('AC-5 · an Assignment cannot be produced without issuing one', () => {
    // The decisive case: there is no parameter through which a holder can present
    // its own Assignment. An earlier version took one as an argument, so a
    // producer handed in grants it had chosen for itself.
    const k = fresh();
    approved(k);
    refuses('no issuance, no attempt', 'assignment_not_issued',
      () => k.openAttempt({
        lineage: 'L', run: 'run1', producer: 'P', obligations: ['O'], submitter: 'P',
      }));
  });

  group('AC-5 · identity comes from the record, not the submission', () => {
    const k = fresh();
    approved(k);
    issue(k);
    refuses('a submitter may not name another producer', 'identity_self_asserted',
      () => k.openAttempt({
        lineage: 'L', run: 'run1', producer: 'P', obligations: ['O'], submitter: 'Q',
      }));
  });

  group('AC-7 · grants bound what a producer may do', () => {
    const k = fresh();
    approved(k);
    issue(k);
    refuses('an ungranted producer may not open an attempt', 'attempt_not_granted',
      () => k.openAttempt({
        lineage: 'L', run: 'run1', producer: 'Q', obligations: ['O'], submitter: 'Q',
      }));
    const opened = k.openAttempt({
      lineage: 'L', run: 'run1', producer: 'P', obligations: ['O'], submitter: 'P',
    });
    eq('the granted producer may', opened.producer, 'P');
  });

  group('AC-7 · a grant names which obligations', () => {
    // Two obligations in the Contract, one of them granted. The producer may not
    // reach the other, in either operation.
    const k = fresh();
    approved(k, {
      obligations: ['O', 'O2'],
      observations: [
        { obligation: 'O', observation: COMMAND },
        { obligation: 'O2', observation: 'sh other.sh' },
      ],
    });
    issue(k);
    refuses('an attempt against an ungranted obligation', 'authority_not_granted',
      () => k.openAttempt({
        lineage: 'L', run: 'run1', producer: 'P', obligations: ['O2'], submitter: 'P',
      }));
    const at = k.openAttempt({
      lineage: 'L', run: 'run1', producer: 'P', obligations: ['O'], submitter: 'P',
    });
    refuses('evidence for an ungranted obligation', 'authority_not_granted',
      () => k.submitObservation({
        lineage: 'L', run: 'run1', obligation: 'O2', observation: 'sh other.sh',
        attempt: at.attempt, producer: 'P', artifact: 'art1', pkg: 'pkg1',
        commandResult: 'cr1', submitter: 'P',
      }));
  });

  group('AC-7 · changes are submitted under the granted mutation producer', () => {
    const k = fresh();
    const w = walk(k);
    refuses('a package from another producer', 'mutation_producer_ungranted',
      () => {
        const other = asObject({ ...w.pkg.value, id: 'pkg2', producer: 'Q' });
        k.recordPackage({
          lineage: 'L', run: 'run1', bytes: other.bytes, identity: other.identity, submitter: 'Q',
        });
      });
    refuses('a submitter packaging under someone else', 'identity_self_asserted',
      () => {
        const other = asObject({ ...w.pkg.value, id: 'pkg3' });
        k.recordPackage({
          lineage: 'L', run: 'run1', bytes: other.bytes, identity: other.identity, submitter: 'Q',
        });
      });
  });

  group('AC-5 · a host-collected input backs every authority operation', () => {
    // Not a claim a caller writes: `origin: host` is stamped by the Kernel, and
    // the record schema makes any other value invalid. There is no method that
    // takes an origin, so the check is that no such parameter exists.
    const k = fresh();
    approved(k);
    const decisions = k.records().filter((r) => r.kind.startsWith('human_decision'));
    ok('approval collected one', decisions.length === 1);
    eq('and the Kernel stamped it', decisions[0].origin, 'host');
    issue(k);
    ok('so did issuance', k.records().filter((r) => r.kind.startsWith('human_decision')).length === 2);
  });
}
