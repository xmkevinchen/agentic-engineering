// The Kernel as a channel — the defect that made every other check optional.
//
// The first implementation was a set of correct functions a caller could
// assemble, or not: `reduce` took an optional admissibility check, and
// `requireHumanInput` took any object whose caller wrote `origin: 'host'`.
// Every check was right and none was compulsory.
//
// These cases probe the bypasses directly. They are the ones that matter: a
// criterion enforced only when the caller opts in is not enforced.

import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Kernel } from '../lib/kernel.mjs';
import { identify } from '../lib/identity.mjs';
import { group, ok, eq, refuses } from './harness.mjs';

const fresh = () => new Kernel(join(mkdtempSync(join(tmpdir(), 'k-')), 'log.ndjson'));

const contractBytes = JSON.stringify({ intent: 'x' });
const identity = identify(contractBytes);
const view = { renders_sha256: identity.byte_sha256, rendering_sha256: identity.canonical_sha256 };

export function kernelTests() {
  group('AC-5 · a caller cannot manufacture a host-collected input', () => {
    const k = fresh();
    // The bypass: an object with `origin: 'host'` written by whoever holds it.
    refuses('supplying an origin', 'human_input_self_supplied',
      () => k.collectHumanInput({ operation: 'signoff', actor: 'H', lineage: 'L', origin: 'host' }));

    // The Kernel stamps it. There is no exported function that does, so holding
    // a host-origin record means having gone through here.
    const rec = k.collectHumanInput({ operation: 'signoff', actor: 'H', lineage: 'L' });
    eq('the Kernel stamps the origin', rec.origin, 'host');

    // And the record shape pins it: a record claiming host origin cannot be
    // appended with anything else in that position.
    refuses('appending a decision with another origin', 'format_open',
      () => k.ledger.append({
        kind: 'human_decision', operation: 'signoff', actor: 'H', lineage: 'L', origin: 'model',
      }));
  });

  group('AC-3 · the current revision is derived, never nominated', () => {
    const k = fresh();
    ok('an unapproved lineage has no current revision', k.currentRevision('L') === null);
    k.approve({ lineage: 'L', revision: 'r1', bytes: contractBytes, identity, view, actor: 'H' });
    eq('after approval it is the approved one', k.currentRevision('L'), 'r1');
    // A second lineage does not disturb the first — the composition defect an
    // earlier draft had, where currency was computed over the whole log.
    const other = identify(JSON.stringify({ intent: 'y' }));
    k.approve({
      lineage: 'OTHER', revision: 't1', bytes: JSON.stringify({ intent: 'y' }),
      identity: other,
      view: { renders_sha256: other.byte_sha256, rendering_sha256: other.canonical_sha256 },
      actor: 'H',
    });
    eq('the first lineage is unchanged', k.currentRevision('L'), 'r1');
  });

  group('AC-6 · approval records the view of these exact bytes', () => {
    const k = fresh();
    refuses('no view at all', 'human_input_absent',
      () => k.approve({ lineage: 'L', revision: 'r1', bytes: contractBytes, identity, actor: 'H' }));
    refuses('a view of different bytes', 'human_input_absent',
      () => k.approve({
        lineage: 'L', revision: 'r1', bytes: contractBytes, identity, actor: 'H',
        view: { renders_sha256: 'sha256:' + '0'.repeat(64), rendering_sha256: identity.canonical_sha256 },
      }));
    refuses('bytes that do not match the recorded identity', 'identity_mismatch',
      () => k.approve({
        lineage: 'L', revision: 'r1', bytes: '{"intent":"tampered"}', identity, view, actor: 'H',
      }));
  });

  group('AC-3 · lineage relations are enforced on the path', () => {
    const k = fresh();
    k.approve({ lineage: 'L', revision: 'r1', bytes: contractBytes, identity, view, actor: 'H' });
    refuses('a second genesis', 'lineage_second_genesis',
      () => k.approve({ lineage: 'L', revision: 'r2', bytes: contractBytes, identity, view, actor: 'H' }));
    refuses('a wrong predecessor', 'lineage_predecessor_wrong',
      () => k.approve({
        lineage: 'L', revision: 'r2', bytes: contractBytes, identity, view, actor: 'H',
        predecessor: 'sha256:' + '0'.repeat(64),
      }));
  });

  group('AC-7 · only the granted producer opens an attempt', () => {
    const k = fresh();
    const assignment = { id: 'A1', grants: { attempt_producer: 'P' } };
    refuses('an ungranted producer', 'attempt_not_granted',
      () => k.openAttempt({
        lineage: 'L', assignment, producer: 'Q', obligations: ['O'], submitter: 'Q',
      }));
    // And the opener cannot claim to be someone else: the submitter is compared
    // with what the record will say.
    refuses('a submitter naming another producer', 'identity_self_asserted',
      () => k.openAttempt({
        lineage: 'L', assignment, producer: 'P', obligations: ['O'], submitter: 'Q',
      }));
    const opened = k.openAttempt({
      lineage: 'L', assignment, producer: 'P', obligations: ['O'], submitter: 'P',
    });
    eq('the granted producer may', opened.producer, 'P');
  });

  group('AC-4 · admissibility is not optional', () => {
    // The Critical defect: `reduce` defaulted `admit` to a function that always
    // passed, so omitting it let a bare observation reach `passed`. The Kernel's
    // `status` builds the check itself and offers no parameter to skip it.
    const k = fresh();
    k.approve({ lineage: 'L', revision: 'r1', bytes: contractBytes, identity, view, actor: 'H' });
    const contract = {
      obligations: ['O'],
      observations: [{ obligation: 'O', observation: 'sh run.sh' }],
    };
    const assignment = { id: 'A1', contract_revision: 'r1', boundary: ['docs'] };
    const empty = { package: () => null, attempt: () => null, artifact: () => null, commandResult: () => null };

    k.ledger.append({
      kind: 'attempt_opened', lineage: 'L', assignment: 'A1', attempt: 'a1',
      producer: 'P', obligations: ['O'],
    });
    // A bare observation — the shape the old positive test used — reaches the
    // reduction and is refused there rather than passing.
    k.ledger.append({
      kind: 'observation', lineage: 'L', obligation: 'O', observation: 'sh run.sh',
      attempt: 'a1', contract_revision: 'r1', assignment: 'A1', producer: 'P',
      artifact: 'art1', package: 'pkg1', command_result: 'cr1', satisfied: true,
    });
    const { byObligation, allPassed } = k.status({
      contract, lineage: 'L', assignment, index: empty, inputsNow: () => null,
    });
    eq('a bare observation does not pass', byObligation.O.status, 'invalid');
    ok('and completion is not reached', allPassed === false);
  });
}
