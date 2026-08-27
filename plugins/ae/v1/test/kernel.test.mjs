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
import {
  asObject, assignmentDoc, contractDoc, walk, RENDERED, COMMAND, INPUT,
  SOURCE_ROOT, OWNER,
} from './fixtures.mjs';

const fresh = () => new Kernel(join(mkdtempSync(join(tmpdir(), 'k-')), 'log.ndjson'), { sourceRoot: SOURCE_ROOT, render: RENDERED, owner: OWNER });

const doc = asObject(contractDoc());
const approve = (k, over = {}) => k.approve({
  lineage: 'L', revision: 'r1', bytes: doc.bytes, identity: doc.identity,
  actor: 'Human Owner', rendered: RENDERED(doc.bytes), ...over,
});

export function kernelTests() {
  group('AC-5 · every operation refuses before its preconditions exist', () => {
    // One guard repeated at each entry point, and nothing reached any of them:
    // every case in the suite sets a run up first. Sweeping the refusals found
    // nine copies of "this run has no Assignment" that no test could tell were
    // gone.
    //
    // Each asserts its own code. A first attempt only checked that something was
    // thrown, which the very next line does anyway — reading `.grants` of nothing
    // throws too, so the guard could be deleted and the case stayed green.
    const bare = fresh();
    approve(bare);
    const noRun = { lineage: 'L', run: 'run1' };
    const pkg = asObject({
      id: 'pkg1', lineage: 'L', contract_revision: 'r1', assignment: 'A1', attempt: 0,
      producer: 'P', artifact: 'art1', command_result: 'cr1', changed_paths: [],
      material_inputs: [], deviations: [], known_risks: [],
    });

    for (const [what, call] of [
      ['running an observation', () => bare.runObservation({
        id: 'cr1', ...noRun, attempt: 0, obligation: 'O', artifact: 'art1',
      })],
      ['recording a package', () => bare.recordPackage({
        ...noRun, bytes: pkg.bytes, identity: pkg.identity, submitter: 'P',
      })],
      ['dispatching', () => bare.recordDispatch({ ...noRun, attempt: 0, obligation: 'O' })],
      ['recording a capability as unavailable', () => bare.recordUnavailable({
        ...noRun, obligation: 'O', attempt: 0,
      })],
      ['submitting an observation', () => bare.submitObservation({
        ...noRun, obligation: 'O', observation: COMMAND, attempt: 0,
        producer: 'P', artifact: 'art1', pkg: 'pkg1', commandResult: 'cr1', submitter: 'P',
      })],
      ['opening an attempt', () => bare.openAttempt({
        ...noRun, producer: 'P', obligations: ['O'], submitter: 'P',
      })],
      ['asking the Gate', () => bare.status(noRun)],
      ['signing off', () => bare.signOff({ ...noRun, actor: OWNER })],
      ['completing', () => bare.complete({ ...noRun, actor: OWNER })],
    ]) {
      refuses(`${what} without an Assignment`, 'assignment_not_issued', call);
    }
  });

  group('AC-2 · an observation answers an obligation the Contract named', () => {
    // The obligation reaching the Harness is the caller's word. The attempt's
    // scope is compared when evidence is submitted, which is later — so this is
    // the first place a name the Contract never used can be refused, and without
    // it the command runs before anything notices.
    const k = fresh();
    const w = walk(k);
    refuses('an obligation the Contract does not name', 'observation_not_named',
      () => k.runObservation({
        id: 'crX', lineage: w.lineage, run: w.run, attempt: w.attempt.attempt,
        obligation: 'not-in-the-Contract', artifact: 'artX',
      }));
  });

  group('AC-3 · the deliverable a Contract names has to be there', () => {
    // Nothing before this reads the path: approval checks the Contract's shape and
    // its citations, not that the artifact it names exists. So a Contract can name
    // a path the tree does not have, and the observation is where that shows up.
    refuses('an artifact the Contract names but the tree does not hold', 'binding_unresolved',
      () => walk(fresh(), {
        contract: {
          observations: [{
            obligation: 'O', observation: COMMAND, artifact: 'work/absent',
            material_inputs: [INPUT],
          }],
        },
      }));
  });

  group('AC-5 · a Kernel refuses what it was not given the means to do', () => {
    // Three things a Kernel is configured with, and each operation that needs one
    // refuses without it. Deleting any of these left the suite green, because the
    // cases that got there failed for a neighbouring reason instead.
    const doc2 = asObject(contractDoc());
    const bare = (opts) => new Kernel(join(mkdtempSync(join(tmpdir(), 'bare-')), 'log.ndjson'), opts);

    refuses('no Human Owner, so it cannot approve', 'human_input_absent',
      () => bare({ sourceRoot: SOURCE_ROOT, render: RENDERED }).approve({
        lineage: 'L', revision: 'r1', bytes: doc2.bytes, identity: doc2.identity,
        actor: OWNER, rendered: RENDERED(doc2.bytes),
      }));
    refuses('no renderer, so it cannot approve', 'human_input_absent',
      () => bare({ sourceRoot: SOURCE_ROOT, owner: OWNER }).approve({
        lineage: 'L', revision: 'r1', bytes: doc2.bytes, identity: doc2.identity,
        actor: OWNER, rendered: RENDERED(doc2.bytes),
      }));
    refuses('no root, so it cannot resolve what the Contract cites', 'citation_unknown',
      () => bare({ render: RENDERED, owner: OWNER }).approve({
        lineage: 'L', revision: 'r1', bytes: doc2.bytes, identity: doc2.identity,
        actor: OWNER, rendered: RENDERED(doc2.bytes),
      }));
    // The code alone does not pin this one: without the root, resolution would
    // fail anyway — against a path built from `undefined` — and refuse with the
    // same code for an accidental reason. The refusal has to be the stated one.
    try {
      bare({ render: RENDERED, owner: OWNER }).approve({
        lineage: 'L', revision: 'r1', bytes: doc2.bytes, identity: doc2.identity,
        actor: OWNER, rendered: RENDERED(doc2.bytes),
      });
      ok('a rootless Kernel refuses to approve', false);
    } catch (error) {
      eq('and refuses for the missing root, not a path that happened not to resolve',
        error.message, 'this Kernel cannot resolve cited sources, so it cannot approve');
    }
    // A root is per-Kernel, not per-log: a second Kernel reading the same log
    // without one would otherwise run the Contract's command wherever it happened
    // to be started, against whatever it found there.
    const shared = join(mkdtempSync(join(tmpdir(), 'rootless-')), 'log.ndjson');
    const walked = walk(new Kernel(shared, {
      sourceRoot: SOURCE_ROOT, render: RENDERED, owner: OWNER,
    }));
    const rootless = new Kernel(shared, { render: RENDERED, owner: OWNER });
    // By its reason, not only its code: without the root the command would run in
    // whatever directory the process started in and the artifact would fail to
    // resolve afterwards — refusing with the same code, having already run it.
    try {
      rootless.runObservation({
        id: 'cr2', lineage: walked.lineage, run: walked.run,
        attempt: walked.attempt.attempt, obligation: 'O', artifact: 'art2',
      });
      ok('a rootless Kernel refuses to run the observation', false);
    } catch (error) {
      eq('and refuses before running it, for the missing root',
        error.message, 'this Kernel has no root, so it cannot run anything');
    }

    // The half a bare comparison misses. An absent owner is held as `null`, so an
    // actor of `null` equals it — and every operation reserved to the Human Owner
    // would be open to a caller that names nobody.
    const ownerless = bare({ sourceRoot: SOURCE_ROOT, render: RENDERED });
    refuses('an actor equal to the owner it does not have', 'human_input_absent',
      () => ownerless.openFormation({ lineage: 'L', actor: null }));
    refuses('and at the unavailable decision', 'human_input_absent',
      () => ownerless.decideUnavailable({
        lineage: 'L', run: 'run1', actor: null, choice: 'wait',
      }));

    refuses('no completion root, so it cannot say where completion goes', 'writer_not_sole',
      () => bare({ sourceRoot: SOURCE_ROOT, render: RENDERED, owner: OWNER })
        .completionPathFor({ lineage: 'L', run: 'run1' }));
  });

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
    refuses('a Contract naming another revision', 'identity_mismatch',
      () => approve(k, { revision: 'r9' }));
    // Bytes whose identity checks out and whose shape does not. Identity is
    // verified first, so a valid digest over an invalid Contract used to reach
    // everything downstream: nothing else re-checks the shape.
    const smuggled = asObject({ ...contractDoc(), smuggled: 'a field no schema names' });
    refuses('a Contract carrying a field its schema does not name', 'format_open',
      () => approve(k, {
        bytes: smuggled.bytes, identity: smuggled.identity,
        rendered: RENDERED(smuggled.bytes),
      }));

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
