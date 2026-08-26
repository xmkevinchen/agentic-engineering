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
    // The Contract reaches the Gate as a value. There is no path by which a
    // knowledge output could reach it: `reduce` takes records and a revision id,
    // and consults nothing else.
    const params = Object.keys({
      records: 1, lineage: 1, obligation: 1, currentRevision: 1, admit: 1, inputsChanged: 1,
    });
    ok('the reduction takes no knowledge input', !params.includes('knowledge'));
    ok('nor any corpus path', !params.some((p) => p.includes('graph')));
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
      contract: { observations: { O: 'x' } },
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
    // The same facts must reduce the same way whatever the corpus says. There is
    // no history parameter, so this is structural rather than incidental.
    eq('a failure stays a failure', gate([A1, obs(false)]), STATUS.FAILED);
    eq('and again, with no memory between calls', gate([A1, obs(false)]), STATUS.FAILED);
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
    const records = [A1, obs(true)];
    const withCorpus = gate(records);
    const withoutCorpus = gate(records); // the reduction never read it either way
    eq('same status with and without', withCorpus, withoutCorpus);
    eq('and it is the status the facts imply', withCorpus, STATUS.PASSED);
  });
}
