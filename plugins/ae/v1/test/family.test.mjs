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
import { asObject, assignmentDoc, contractDoc, RENDERED, SOURCE_ROOT, OWNER } from './fixtures.mjs';

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

    // And an arm the Gate refused is not one the Human Owner may decide about:
    // the choice answers an event, and there was no admissible event.
    refuses('a choice about an arm the Gate refused', 'human_input_absent',
      () => swapped.decideUnavailable({
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
    k.recordUnavailable({
      lineage: 'L', run: 'run1', obligation: 'O', attempt: at.attempt, requested: ['openai'],
    });
    // And there is nothing to dispatch: a Contract that requested no family has
    // no request to carry, and defaulting one would put a family nobody asked for
    // into the record.
    refuses('a dispatch under a Contract that asked for nothing', 'requested_dropped',
      () => k.recordDispatch({ lineage: 'L', run: 'run1', attempt: at.attempt, obligation: 'O' }));

    eq('an unavailable arm on a solo Contract',
      k.status({ lineage: 'L', run: 'run1' }).byObligation.O.code, 'requested_from_wrong_source');
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
    k.recordUnavailable({
      lineage: 'L', run: 'run2', obligation: 'O', attempt: at2.attempt, requested: ['qwen'],
    });
    k.status({ lineage: 'L', run: 'run2' });
    const here = fileURLToPath(new URL('./replay.mjs', import.meta.url));
    const out = JSON.parse(execFileSync(
      process.execPath, [here, logPath, 'L', 'run2'], { encoding: 'utf8' },
    ));
    eq('and replay reads the second run\'s request', (out.requested || []).join(','), 'qwen');
    eq('under the revision that asked for it', out.approvedRevision, 'r2');
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
