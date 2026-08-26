// AC-1, AC-6 — completion, and the formation trace.

import { createHash } from 'node:crypto';
import { emitAcceptance } from '../lib/acceptance.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  checkDispositions, checkCitations, checkPresentedView, statementsFrom,
} from '../lib/formation.mjs';
import { group, ok, eq, refuses } from './harness.mjs';

const sha = (s) => `sha256:${createHash('sha256').update(s).digest('hex')}`;

const CONTRACT = join(
  dirname(fileURLToPath(import.meta.url)),
  '..', '..', '..', '..', '.ae', 'features', 'active',
  'F-086-v1-minimal-kernel', 'contract.md',
);

const contract = {
  obligations: ['O'],
  independence: { required: 'none', assurance: 'workflow_attested' },
  identity: { byte_sha256: sha('c'), canonical_sha256: sha('c'), length: 1 },
};
const deliverable = { kind: 'commit', identity: sha('deliverable') };
const records = [
  { kind: 'attempt_opened', lineage: 'L', attempt: 'a1', seq: 0 },
  {
    kind: 'observation', lineage: 'L', obligation: 'O', attempt: 'a1',
    contract_revision: 'r1', satisfied: true, seq: 1,
  },
];
const signoff = {
  origin: 'host', run: 'run1', contract_revision: 'r1',
  deliverable: deliverable.identity, seq: 2,
};
const emit = (over = {}) => emitAcceptance({
  contract, lineage: 'L', run: 'run1', deliverable, records, currentRevision: 'r1',
  signoff, ...over,
});

export function completionTests() {
  group('AC-1 · completion needs every obligation passed', () => {
    eq('a clean run is accepted', emit().decision.outcome, 'accepted');
    refuses('an obligation still pending', 'not_all_passed',
      () => emit({ contract: { ...contract, obligations: ['O', 'O2'] } }));
    refuses('an obligation that failed', 'not_all_passed',
      () => emit({ records: [records[0], { ...records[1], satisfied: false }] }));
    // The unavailable arm reaches no Acceptance and needs none.
    refuses('an unavailable capability', 'not_all_passed',
      () => emit({
        records: [records[0], {
          kind: 'capability_unavailable', lineage: 'L', obligation: 'O', attempt: 'a1', seq: 1,
        }],
      }));
  });

  group('AC-1 · the sign-off is bound to this run', () => {
    // Three bindings, three cases, each holding the others equal — so an
    // implementation checking only the run fails the other two.
    refuses('another run', 'signoff_wrong_run',
      () => emit({ signoff: { ...signoff, run: 'run2' } }));
    refuses('another revision', 'signoff_wrong_revision',
      () => emit({ signoff: { ...signoff, contract_revision: 'r0' } }));
    refuses('another deliverable', 'signoff_wrong_deliverable',
      () => emit({ signoff: { ...signoff, deliverable: sha('other') } }));
  });

  group('AC-1 · the sign-off comes after the Gate', () => {
    refuses('recorded before the last fact', 'signoff_before_gate',
      () => emit({ signoff: { ...signoff, seq: 1 } }));
    refuses('recorded alongside it', 'signoff_before_gate',
      () => emit({ signoff: { ...signoff, seq: 0 } }));
  });

  group('AC-1 · the sign-off is a human input', () => {
    refuses('model output', 'human_input_absent',
      () => emit({ signoff: { ...signoff, origin: 'model' } }));
    refuses('a caller-written field', 'human_input_self_supplied',
      () => emit({ signoff: { ...signoff, human: true } }));
  });

  group('AC-1 · review is stated, never left empty', () => {
    const solo = emit();
    ok('a solo Contract states the absence', solo.review.required === false);
    ok('and says so in words',
      solo.review.statement === 'no independent review required by this Contract');

    const crossFamily = {
      ...contract,
      independence: {
        required: 'cross_family_required', requested_family: ['openai'],
        assurance: 'workflow_attested',
      },
    };
    refuses('a required review that is absent', 'review_required_absent',
      () => emit({ contract: crossFamily }));
    const withReview = emit({
      contract: crossFamily,
      signoff: { ...signoff, accepted_review: sha('review') },
    });
    ok('a carried review is recorded', withReview.review.required === true);
  });

  group('AC-6 · the disposition table checks itself', () => {
    // The failure mode three consecutive drafts had: a table claiming a criterion
    // carries an obligation it does not contain, always in the direction of
    // claiming more.
    const carriedBy = (criterion, obligation) => criterion === 'AC-4' && obligation === 'determinism';
    eq('a true landing', checkDispositions(
      [{ obligation: 'determinism', disposition: 'carried', lands_in: ['AC-4'] }], carriedBy,
    ).length, 0);
    eq('a false landing is caught', checkDispositions(
      [{ obligation: 'determinism', disposition: 'carried', lands_in: ['AC-9'] }], carriedBy,
    )[0].why, 'AC-9 does not contain this obligation');
    ok('carried but naming no landing', checkDispositions(
      [{ obligation: 'determinism', disposition: 'carried' }], carriedBy,
    ).length > 0);
    ok('neither carried nor disposed', checkDispositions(
      [{ obligation: 'x' }], carriedBy,
    ).length > 0);
  });

  group('AC-6 · citations must be specific', () => {
    const prov = {
      verifiable: [{ id: 'D-01' }],
      transcribed: [{ id: 'U-01', broad: true }],
      proposals: [{ id: 'P-01' }],
    };
    eq('a specific citation', checkCitations([{ id: 's', cites: ['D-01'] }], prov).length, 0);
    eq('citing nothing', checkCitations([{ id: 's', cites: [] }], prov)[0].why, 'cites nothing');
    // An entry broad enough to support any statement supports none of them.
    eq('citing only a broad entry',
      checkCitations([{ id: 's', cites: ['U-01'] }], prov)[0].why, 'cites only a broad entry');
    ok('citing an unknown source', checkCitations([{ id: 's', cites: ['Z-99'] }], prov).length > 0);
  });

  group('AC-6 · statements are read from the Contract, not supplied', () => {
    // The defect this closes: an earlier draft took both the statement list and
    // the oracle that judged it, so a caller could describe a document that
    // satisfied every rule and never mention the one that did not.
    const bytes = readFileSync(CONTRACT);
    const statements = statementsFrom(bytes);
    ok('the activated Contract yields statements', statements.length > 10);

    // Every scope row, non-goal and criterion in the real Contract cites
    // something specific. This is the check running against itself, which is the
    // only version worth having.
    const uncited = statements.filter((s) => s.cites.length === 0);
    eq('none is uncited', uncited.map((s) => s.id).join(','), '');

    // And the parse distinguishes sections: N1 is a non-goal under §3 and a
    // knowledge clause under AC-10, and reading them as one kind reported six
    // phantom uncited statements on the first run.
    const ids = new Set(statements.map((s) => s.id));
    ok('scope rows are found', ids.has('S1'));
    ok('non-goals are found', ids.has('N1'));
    ok('criteria are found', ids.has('AC-1'));
  });

  group('AC-6 · the presented view is derived from the approved bytes', () => {
    const bytes = Buffer.from('{"a":1}');
    const render = (b) => Buffer.from(`VIEW:${b.toString()}`);
    const good = {
      renders_sha256: sha(bytes.toString()),
      rendering_sha256: sha(render(bytes).toString()),
    };
    ok('a derived view', checkPresentedView({ approvedBytes: bytes, view: good, render }));

    // Two digests side by side would satisfy a weaker check: a stale view of one
    // candidate plus the correct digest of another. Re-rendering is what closes it.
    const stale = { ...good, rendering_sha256: sha('VIEW:{"a":2}') };
    refuses('a view of different bytes', 'identity_mismatch',
      () => checkPresentedView({ approvedBytes: bytes, view: stale, render }));
    const wrongClaim = { ...good, renders_sha256: sha('{"a":2}') };
    refuses('a view claiming to render something else', 'identity_mismatch',
      () => checkPresentedView({ approvedBytes: bytes, view: wrongClaim, render }));
    refuses('no view recorded at all', 'human_input_absent',
      () => checkPresentedView({ approvedBytes: bytes, view: null, render }));
  });
}
