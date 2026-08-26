// AC-7, AC-8 — the unavailable arm, and what a request may never claim.

import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { requestedFamily, dispatchRecord } from '../lib/family.mjs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { Kernel } from '../lib/kernel.mjs';
import { RECORDS } from '../schema/records.mjs';
import { group, ok, eq, refuses } from './harness.mjs';
import {
  asObject, assignmentDoc, contractDoc, RENDERED, SOURCE_ROOT, OWNER,
  COMMAND, ARTIFACT, INPUT,
} from './fixtures.mjs';

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
      const k = new Kernel(join(mkdtempSync(join(tmpdir(), 'v1f-')), 'log.ndjson'), { sourceRoot: SOURCE_ROOT, render: RENDERED, owner: OWNER });
      const c = asObject(contractDoc(cross));
      k.approve({
        lineage: 'L', revision: 'r1', bytes: c.bytes, identity: c.identity,
        actor: 'Human Owner', rendered: RENDERED(c.bytes),
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
        lineage: 'L', run: 'run1', obligation: 'O', attempt: at.attempt, ...unavailableOver,
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
    // Two different facts about what happened: one seat stood in, another
    // replied. They shared a refusal, so a case reaching either covered both.
    const answered = build({ answeredFamily: 'anthropic' });
    eq('a seat that replied',
      answered.status({ lineage: 'L', run: 'run1' }).byObligation.O.code,
      'same_family_substituted');
    // A request nobody made is not constructible: `recordUnavailable` reads the
    // run's Contract, so there is no argument through which one could arrive.
    // What is constructible is an arm the Gate refuses for authority — and that
    // is not one the Human Owner may decide about either, because the choice
    // answers an event and there was no admissible event.
    const refused = build({ substitutedFamily: 'anthropic' });
    eq('a seat that answered is not a missing capability',
      refused.status({ lineage: 'L', run: 'run1' }).byObligation.O.code,
      'same_family_substituted');
    refuses('a choice about an arm the Gate refused', 'human_input_absent',
      () => refused.decideUnavailable({
        lineage: 'L', run: 'run1', actor: 'Human Owner', choice: 'stop',
      }));

    // And a solo Contract cannot have an unavailable arm at all: nothing was
    // requested, so nothing can have been missing.
    const k = new Kernel(join(mkdtempSync(join(tmpdir(), 'v1f-')), 'log.ndjson'), { sourceRoot: SOURCE_ROOT, render: RENDERED, owner: OWNER });
    const c = asObject(contractDoc());
    k.approve({
      lineage: 'L', revision: 'r1', bytes: c.bytes, identity: c.identity,
      actor: 'Human Owner', rendered: RENDERED(c.bytes),
    });
    const a = asObject(assignmentDoc());
    k.issueAssignment({
      lineage: 'L', run: 'run1', bytes: a.bytes, identity: a.identity, actor: 'Human Owner',
    });
    const at = k.openAttempt({
      lineage: 'L', run: 'run1', producer: 'P', obligations: ['O'], submitter: 'P',
    });
    // A solo Contract has no request, so there is nothing to dispatch and nothing
    // that could have been missing — defaulting either would put a family nobody
    // asked for into the record.
    refuses('an unavailable record under a Contract that asked for nothing',
      'requested_from_wrong_source',
      () => k.recordUnavailable({
        lineage: 'L', run: 'run1', obligation: 'O', attempt: at.attempt,
      }));
    refuses('a dispatch under a Contract that asked for nothing', 'requested_dropped',
      () => k.recordDispatch({ lineage: 'L', run: 'run1', attempt: at.attempt, obligation: 'O' }));

    eq('and the obligation is simply pending',
      k.status({ lineage: 'L', run: 'run1' }).byObligation.O.status, 'pending');
  });

  group('AC-8 · two revisions, two runs, one log, and the requests do not cross', () => {
    // What the criterion asks to see: distinctive requests across interleaved
    // revisions and runs, replayed. One log holds both, and each run's dispatch
    // and unavailable record must still name the family its own revision asked
    // for — a request read from anywhere but the Contract would show up here as
    // the wrong family under one of them.
    const dir = mkdtempSync(join(tmpdir(), 'v1x-'));
    const logPath = join(dir, 'log.ndjson');
    const k = new Kernel(logPath, { sourceRoot: SOURCE_ROOT, render: RENDERED, owner: OWNER });

    const askFor = (families, over = {}) => contractDoc({
      independence: {
        required: 'cross_family_required', requested_family: families,
        assurance: 'workflow_attested',
      },
      ...over,
    });
    const first = asObject(askFor(['openai']));
    k.approve({
      lineage: 'L', revision: 'r1', bytes: first.bytes, identity: first.identity,
      actor: OWNER, rendered: RENDERED(first.bytes),
    });
    const a1 = asObject(assignmentDoc());
    k.issueAssignment({
      lineage: 'L', run: 'run1', bytes: a1.bytes, identity: a1.identity, actor: OWNER,
    });
    const at1 = k.openAttempt({
      lineage: 'L', run: 'run1', producer: 'P', obligations: ['O'], submitter: 'P',
    });
    k.recordDispatch({ lineage: 'L', run: 'run1', attempt: at1.attempt, obligation: 'O' });

    // A second revision asking for something else, and a run under it — opened
    // while the first run is still unfinished, so the records interleave.
    const second = asObject(askFor(['qwen'], {
      revision: 'r2', predecessor: first.identity.byte_sha256,
    }));
    k.approve({
      lineage: 'L', revision: 'r2', bytes: second.bytes, identity: second.identity,
      predecessor: first.identity.byte_sha256, actor: OWNER,
      rendered: RENDERED(second.bytes),
    });
    const a2 = asObject(assignmentDoc({ id: 'A2', contract_revision: 'r2' }));
    k.issueAssignment({
      lineage: 'L', run: 'run2', bytes: a2.bytes, identity: a2.identity, actor: OWNER,
    });
    const at2 = k.openAttempt({
      lineage: 'L', run: 'run2', producer: 'P', obligations: ['O'], submitter: 'P',
    });
    k.recordDispatch({ lineage: 'L', run: 'run2', attempt: at2.attempt, obligation: 'O' });

    const dispatches = k.records().filter((r) => r.kind === 'dispatch_attempt');
    eq('the first run asked for what its revision stated',
      dispatches.find((d) => d.run === 'run1').requested.join(','), 'openai');
    eq('the second for what its own stated',
      dispatches.find((d) => d.run === 'run2').requested.join(','), 'qwen');

    // Replayed in a fresh process, each run still carries its own request.
    k.recordUnavailable({ lineage: 'L', run: 'run2', obligation: 'O', attempt: at2.attempt });
    k.status({ lineage: 'L', run: 'run2' });
    const here = fileURLToPath(new URL('./replay.mjs', import.meta.url));
    const out = JSON.parse(execFileSync(
      process.execPath, [here, logPath, 'L', 'run2'], { encoding: 'utf8' },
    ));
    eq('and replay reads the second run\'s request', (out.requested || []).join(','), 'qwen');
    eq('under the revision that asked for it', out.approvedRevision, 'r2');
  });

  group('AC-7 · two dispatches for one obligation resolve to neither', () => {
    // The same rule as the evidence resolvers: a name answering to two records
    // answers to neither. Nothing exercised it for dispatches, so removing that
    // refusal left the suite green.
    const k = new Kernel(join(mkdtempSync(join(tmpdir(), 'v1d-')), 'log.ndjson'), {
      sourceRoot: SOURCE_ROOT, render: RENDERED, owner: OWNER,
    });
    const c = asObject(contractDoc(cross));
    k.openFormation({ lineage: 'L', actor: OWNER });
    k.approve({
      lineage: 'L', revision: 'r1', bytes: c.bytes, identity: c.identity,
      actor: OWNER, rendered: RENDERED(c.bytes),
    });
    const a = asObject(assignmentDoc());
    k.issueAssignment({
      lineage: 'L', run: 'run1', bytes: a.bytes, identity: a.identity, actor: OWNER,
    });
    const at = k.openAttempt({
      lineage: 'L', run: 'run1', producer: 'P', obligations: ['O'], submitter: 'P',
    });
    k.recordDispatch({ lineage: 'L', run: 'run1', attempt: at.attempt, obligation: 'O' });
    k.recordDispatch({ lineage: 'L', run: 'run1', attempt: at.attempt, obligation: 'O' });
    k.recordUnavailable({ lineage: 'L', run: 'run1', obligation: 'O', attempt: at.attempt });
    refuses('two dispatches under one attempt and obligation', 'binding_unresolved',
      () => k.status({ lineage: 'L', run: 'run1' }));
  });

  group('AC-7 · the choice answers the event the Gate reduced', () => {
    // An inadmissible unavailable record on the first attempt, an admissible one
    // on a retry. Taking the first record in the run meant the decision answered
    // the one the Gate had refused, while the Gate had reported `unavailable`
    // about the other — which is the relation `answers` exists to keep.
    const k = new Kernel(join(mkdtempSync(join(tmpdir(), 'v1w-')), 'log.ndjson'), {
      sourceRoot: SOURCE_ROOT, render: RENDERED, owner: OWNER,
    });
    const c = asObject(contractDoc(cross));
    k.approve({
      lineage: 'L', revision: 'r1', bytes: c.bytes, identity: c.identity,
      actor: OWNER, rendered: RENDERED(c.bytes),
    });
    const a = asObject(assignmentDoc());
    k.issueAssignment({
      lineage: 'L', run: 'run1', bytes: a.bytes, identity: a.identity, actor: OWNER,
    });

    // First attempt: a dispatch a seat answered, so its unavailable record is
    // inadmissible.
    const first = k.openAttempt({
      lineage: 'L', run: 'run1', producer: 'P', obligations: ['O'], submitter: 'P',
    });
    k.recordDispatch({
      lineage: 'L', run: 'run1', attempt: first.attempt, obligation: 'O',
      answeredFamily: 'anthropic',
    });
    const refusedEvent = k.recordUnavailable({
      lineage: 'L', run: 'run1', obligation: 'O', attempt: first.attempt,
    });

    // A retry, this time with nothing answering.
    const retry = k.openAttempt({
      lineage: 'L', run: 'run1', producer: 'P', obligations: ['O'], submitter: 'P',
    });
    k.recordDispatch({ lineage: 'L', run: 'run1', attempt: retry.attempt, obligation: 'O' });
    const realEvent = k.recordUnavailable({
      lineage: 'L', run: 'run1', obligation: 'O', attempt: retry.attempt,
    });

    eq('the Gate reports the retry',
      k.status({ lineage: 'L', run: 'run1' }).byObligation.O.status, 'unavailable');
    const decision = k.decideUnavailable({
      lineage: 'L', run: 'run1', actor: OWNER, choice: 'stop',
    });
    eq('and the choice answers that event', decision.answers, realEvent.seq);
    ok('not the one the Gate refused', decision.answers !== refusedEvent.seq);
    eq('naming the obligation it was about', decision.obligation, 'O');
  });

  group('AC-7 · two obligations under one attempt do not confuse the choice', () => {
    // The same defect one level in: matching on lineage, run and attempt found *a*
    // record like the selected one, and with two obligations under one attempt
    // that was the wrong one — the Gate reached `unavailable` for the second while
    // the decision answered the first.
    const k = new Kernel(join(mkdtempSync(join(tmpdir(), 'v1o-')), 'log.ndjson'), {
      sourceRoot: SOURCE_ROOT, render: RENDERED, owner: OWNER,
    });
    const two = asObject(contractDoc({
      ...cross,
      obligations: ['O', 'O2'],
      observations: [
        { obligation: 'O', observation: COMMAND, artifact: ARTIFACT, material_inputs: [INPUT] },
        { obligation: 'O2', observation: COMMAND, artifact: ARTIFACT, material_inputs: [INPUT] },
      ],
    }));
    k.openFormation({ lineage: 'L', actor: OWNER });
    k.approve({
      lineage: 'L', revision: 'r1', bytes: two.bytes, identity: two.identity,
      actor: OWNER, rendered: RENDERED(two.bytes),
    });
    const a = asObject(assignmentDoc({
      grants: { attempt_producer: 'P', mutation_producer: 'P', obligations: ['O', 'O2'] },
    }));
    k.issueAssignment({
      lineage: 'L', run: 'run1', bytes: a.bytes, identity: a.identity, actor: OWNER,
    });
    const at = k.openAttempt({
      lineage: 'L', run: 'run1', producer: 'P', obligations: ['O', 'O2'], submitter: 'P',
    });

    // The first obligation's arm is refused — a seat answered. The second's is not.
    k.recordDispatch({
      lineage: 'L', run: 'run1', attempt: at.attempt, obligation: 'O',
      answeredFamily: 'anthropic',
    });
    const refused = k.recordUnavailable({
      lineage: 'L', run: 'run1', obligation: 'O', attempt: at.attempt,
    });
    k.recordDispatch({ lineage: 'L', run: 'run1', attempt: at.attempt, obligation: 'O2' });
    const real = k.recordUnavailable({
      lineage: 'L', run: 'run1', obligation: 'O2', attempt: at.attempt,
    });

    const status = k.status({ lineage: 'L', run: 'run1' }).byObligation;
    eq('the first arm is refused', status.O.code, 'same_family_substituted');
    eq('the second is unavailable', status.O2.status, 'unavailable');
    const decision = k.decideUnavailable({
      lineage: 'L', run: 'run1', actor: OWNER, choice: 'stop',
    });
    eq('and the choice answers the second', decision.answers, real.seq);
    eq('naming its obligation', decision.obligation, 'O2');
    ok('not the refused one', decision.answers !== refused.seq);
  });

  group('AC-7 · the choice is recorded, and only after the fact', () => {
    // "After the capability was found unavailable" is a property of the append:
    // there is a record the decision must follow. It used to be checked at
    // completion, which an unavailable run never reaches — completion stops at
    // `not_all_passed` first — so the ordering check sat in an unreachable branch.
    const k = new Kernel(join(mkdtempSync(join(tmpdir(), 'v1u-')), 'log.ndjson'), { sourceRoot: SOURCE_ROOT, render: RENDERED, owner: OWNER });
    const c = asObject(contractDoc(cross));
    k.approve({
      lineage: 'L', revision: 'r1', bytes: c.bytes, identity: c.identity,
      actor: 'Human Owner', rendered: RENDERED(c.bytes),
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
    k.recordUnavailable({ lineage: 'L', run: 'run1', obligation: 'O', attempt: at.attempt });

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
