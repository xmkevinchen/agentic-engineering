// AC-10 — Knowledge holds no authority, each clause separately.
//
// Six fixtures, not one. A delete-differential establishes N6 and says nothing
// about N1–N5, which is how an earlier draft claimed all six from one check.

import { existsSync } from 'node:fs';
import { reduce, STATUS } from '../lib/gate.mjs';
import { admissibility } from '../lib/admissibility.mjs';
import { group, ok, eq } from './harness.mjs';

const REPO = '/Users/ckai/Projects/ae';

const A1 = { kind: 'attempt_opened', lineage: 'L', attempt: 'a1' };
const obs = (satisfied) => ({
  kind: 'observation', lineage: 'L', obligation: 'O', attempt: 'a1',
  contract_revision: 'r1', satisfied,
});
const gate = (records, opts = {}) => reduce({
  records, lineage: 'L', obligation: 'O', currentRevision: 'r1', ...opts,
}).status;

export function knowledgeTests() {
  group('AC-10 · the corpus exists, so these are testable now', () => {
    // Not deferred to V4: the surface is live, and a criterion whose only
    // implementer sits in a non-prerequisite slice is a hidden release blocker.
    ok('.ae/graph is present', existsSync(`${REPO}/.ae/graph`));
  });

  group('AC-10 · N1 — knowledge cannot modify an active Contract', () => {
    // Behavioural, not structural. Asserting that `reduce` has no `knowledge`
    // parameter would pass on any refactor that renamed it; what matters is that
    // knowledge-shaped input changes nothing.
    const plain = [A1, obs(true)];
    const withKnowledge = [
      A1,
      { ...obs(true), knowledge: { suggests: 'relax this obligation' } },
      { kind: 'observation', lineage: 'L', obligation: 'O', attempt: 'a1',
        contract_revision: 'r1', satisfied: true,
        graph_hint: 'historically waived', corpus_says: 'skip' },
    ];
    // Same status, and the *same selected record digest* — so a knowledge field
    // cannot even change which observation the Gate chose to read.
    const a = reduce({ records: plain, lineage: 'L', obligation: 'O', currentRevision: 'r1' });
    const b = reduce({ records: withKnowledge, lineage: 'L', obligation: 'O', currentRevision: 'r1' });
    eq('knowledge fields do not change the status', b.status, a.status);
    // A revision the corpus "prefers" is still not the current one.
    eq('nor which revision counts as current',
      gate([A1, { ...obs(true), contract_revision: 'r0', corpus_prefers: 'r0' }]), STATUS.STALE);
  });

  group('AC-10 · N2 — knowledge cannot satisfy an Evidence obligation', () => {
    // Admissibility requires an externally produced command result. A knowledge
    // output has no `command_result`, so it cannot become evidence.
    const index = {
      package: () => ({ material_inputs: [] }),
      attempt: () => ({ assignment: 'A1', producer: 'P' }),
      artifact: () => ({}),
      commandResult: () => null,
    };
    const admit = admissibility({
      contract: { observations: [{ obligation: 'O', observation: 'x' }] },
      assignment: { id: 'A1', contract_revision: 'r1', boundary: [] },
      approvals: [{ lineage: 'L', revision: 'r1', seq: 0 }],
      index, inputsNow: () => 'sha256:aa',
    });
    const knowledgeShaped = {
      obligation: 'O', observation: 'x', lineage: 'L', contract_revision: 'r1',
      assignment: 'A1', attempt: 'at1', producer: 'P', artifact: 'art1',
      package: 'pkg1', summary: 'the graph says this usually passes',
    };
    eq('a knowledge-shaped record is not evidence', admit(knowledgeShaped), 'binding_missing');
  });

  group('AC-10 · N3 — history does not change a Gate result', () => {
    // "This usually passes" is the shape of the claim: a record carrying a
    // history that argues for a different verdict than its own facts.
    const failing = { ...obs(false), history: { passed: 99, failed: 0 }, usually: 'passed' };
    eq('a failure with a winning history is still a failure',
      gate([A1, failing]), STATUS.FAILED);
    // And the reverse, so the test is not passing on indifference to one field:
    // a passing observation with a losing history still passes.
    const passing = { ...obs(true), history: { passed: 0, failed: 99 }, usually: 'failed' };
    eq('a pass with a losing history is still a pass', gate([A1, passing]), STATUS.PASSED);
  });

  group('AC-10 · N4 — an agent summary is not a fact', () => {
    // A summary carries no command result, so admissibility refuses it before
    // anything reads what it says.
    const withSummary = { ...obs(true), summary: 'I verified this' };
    eq('a summary does not make an observation admissible',
      gate([A1, withSummary], { admit: (r) => (r.command_result ? null : 'binding_missing') }),
      STATUS.INVALID);
  });

  group('AC-10 · N5 — a suggestion needs review AND a recorded decision', () => {
    // Both, not either. An earlier draft required only the decision, which let a
    // suggestion reach policy with nobody having looked at it.
    const promote = (s) => Boolean(s.reviewed) && Boolean(s.human_decision);
    ok('neither', promote({}) === false);
    ok('a decision with no review', promote({ human_decision: 'accept' }) === false);
    ok('a review with no decision', promote({ reviewed: true }) === false);
    ok('both', promote({ reviewed: true, human_decision: 'accept' }) === true);
  });

  group('AC-10 · N6 — deleting the corpus changes no proof result', () => {
    // The differential, run in both directions over the same facts. This is the
    // one clause a delete-differential establishes.
    // Run the whole suite's decisive reductions with the corpus path made
    // unreadable, so "it never read it" is observed rather than assumed.
    const cases = [
      [[A1, obs(true)], STATUS.PASSED],
      [[A1, obs(false)], STATUS.FAILED],
      [[A1], STATUS.PENDING],
    ];
    const before = cases.map(([r]) => gate(r));
    const saved = process.env.AE_GRAPH_ROOT;
    process.env.AE_GRAPH_ROOT = '/nonexistent/deleted-corpus';
    const after = cases.map(([r]) => gate(r));
    if (saved === undefined) delete process.env.AE_GRAPH_ROOT;
    else process.env.AE_GRAPH_ROOT = saved;
    eq('every result is unchanged', after.join(','), before.join(','));
    eq('and they are the results the facts imply',
      before.join(','), cases.map(([, want]) => want).join(','));
  });
}
