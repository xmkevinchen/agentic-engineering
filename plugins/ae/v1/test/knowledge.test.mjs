// AC-10 — Knowledge holds no authority, each clause separately.
//
// An honest accounting first. V1's Kernel has no knowledge interface at all: no
// module reads the corpus, no record kind carries a suggestion, and no code path
// promotes one. That makes most of N1–N6 **structurally** true here rather than
// behaviourally interesting, and the right test for a structural fact is an
// enumeration, not a scenario.
//
// An earlier version of this file did the opposite and was circular: it checked
// the keys of an object it had just built, called one function twice, and tested a
// four-line `promote` helper that existed only in the test. Those pass whatever
// the implementation does, which is the definition of a criterion that cannot
// fail.

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { reduce, STATUS } from '../lib/gate.mjs';
import { KINDS } from '../lib/ledger.mjs';
import { group, ok, eq } from './harness.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const libDir = join(here, '..', 'lib');
// `AE_REPO_ROOT` for the mutation check, which runs this suite from a copy.
const REPO = process.env.AE_REPO_ROOT || join(here, '..', '..', '..', '..');

const sources = () => readdirSync(libDir)
  .filter((f) => f.endsWith('.mjs'))
  .map((f) => ({ name: f, text: readFileSync(join(libDir, f), 'utf8') }));

const A1 = { kind: 'attempt_opened', lineage: 'L', run: 'run1', seq: 1 };
// The observation names its evidence; the outcome comes from the runner's record
// through `outcomeOf`, never from the submission.
const obs = (green, extra = {}) => ({
  kind: 'observation', lineage: 'L', run: 'run1', obligation: 'O', attempt: 1,
  contract_revision: 'r1', command_result: green ? 'green' : 'red', ...extra,
});
const gate = (records) => reduce({
  records, lineage: 'L', run: 'run1', obligation: 'O',
  currentRevision: 'r1', boundRevision: 'r1',
  admit: () => null,
  inputsChanged: () => false,
  outcomeOf: (r) => r.command_result === 'green',
}).status;

export function knowledgeTests() {
  group('AC-10 · the corpus exists, so these are testable now', () => {
    // Not deferred to V4: the surface is live, and a criterion whose only
    // implementer sits in a non-prerequisite slice is a hidden release blocker.
    ok('.ae/graph is present', existsSync(join(REPO, '.ae', 'graph')));
  });

  group('AC-10 · N1, N2 — no knowledge reaches a Contract or an Evidence obligation', () => {
    // Structural, and stated as such: there is no path, so there is nothing to
    // exercise. The enumeration is over this directory — closed, small, stated.
    // Precisely what it claims: does anything name the corpus. A broader check —
    // "reads the filesystem" — would flag the writer, which reads the filesystem
    // because writing to it is its job, and a check that flags correct code is a
    // check nobody will keep.
    const offenders = sources()
      .filter(({ text }) => /['"`][^'"`]*\.ae\/graph/.test(text) || /ae_graph|aeGraph/.test(text))
      .map(({ name }) => `${name}: names the corpus`);
    eq('no Kernel module names the corpus', offenders.join('; '), '');

    // And no record kind carries a suggestion, so nothing could be appended that
    // a later reader might treat as one.
    const suspicious = Object.keys(KINDS).filter(
      (k) => /knowledge|suggest|graph|hint/i.test(k),
    );
    eq('no record kind carries knowledge', suspicious.join(','), '');
  });

  group('AC-10 · N3, N4 — history and summaries do not move a verdict', () => {
    // Behavioural, because here there is something to exercise: a record may
    // carry these fields, and the question is whether the reduction reads them.
    const withHistory = obs(false, { history: { passed: 99, failed: 0 }, usually: 'passed' });
    eq('a failure with a winning history is still a failure',
      gate([A1, withHistory]), STATUS.FAILED);
    // The converse, so the test is not passing on indifference to one field.
    const passingDespite = obs(true, { history: { passed: 0, failed: 99 }, usually: 'failed' });
    eq('a pass with a losing history is still a pass',
      gate([A1, passingDespite]), STATUS.PASSED);
    // A summary is a claim about a run, and the reduction reads the run's facts.
    eq('an agent summary does not decide',
      gate([A1, obs(false, { summary: 'I verified this thoroughly' })]), STATUS.FAILED);
    // Nor does a corpus-preferred revision become the current one. Currency is
    // the run's bound revision against the lineage's latest, and a field on a
    // submission naming a preference is not either of them.
    const preferring = (records) => reduce({
      records, lineage: 'L', run: 'run1', obligation: 'O',
      currentRevision: 'r1', boundRevision: 'r0',
      admit: () => null, inputsChanged: () => false,
      outcomeOf: (r) => r.command_result === 'green',
    }).status;
    eq('a corpus preference does not set currency',
      preferring([A1, obs(true, { corpus_prefers: 'r0' })]), STATUS.STALE);
  });

  group('AC-10 · N5 — no suggestion-to-policy path exists in V1', () => {
    // Declared, not simulated. An earlier version wrote a four-line `promote`
    // function in the test and asserted things about it, which established
    // nothing about the system. V1 has no promotion path at all, so the honest
    // statement is that the clause has no V1 subject — and the enumeration below
    // is what makes that checkable rather than asserted.
    // Code, not prose. Matching the word anywhere would flag comments that
    // mention the policy snapshot the foundation corpus keeps — a check on
    // vocabulary rather than on behaviour.
    const offenders = sources()
      .filter(({ text }) => /\b(function|const)\s+promote|promoteTo|applyPolicy/.test(text))
      .map(({ name }) => `${name}: defines a promotion path`);
    eq('nothing in the Kernel promotes anything', offenders.join('; '), '');
    ok('so N5 has no V1 subject, and V2 supplies its reviewer seat', true);
  });

  group('AC-10 · N6 — the corpus is not read, so deleting it changes nothing', () => {
    // The differential is only meaningful if something might have read it. Since
    // N1/N2 established that nothing does, the strongest available check is that
    // the decisive reductions do not touch the filesystem at all — which the
    // reduction being pure already gives, and which is asserted here rather than
    // reasoned about.
    const cases = [
      [[A1, obs(true)], STATUS.PASSED],
      [[A1, obs(false)], STATUS.FAILED],
      [[A1], STATUS.PENDING],
    ];
    const gateSource = sources().find((f) => f.name === 'gate.mjs').text;
    eq('the reduction imports no filesystem module',
      /from 'node:fs'/.test(gateSource) ? 'imports fs' : '', '');
    for (const [records, expected] of cases) {
      eq(`the facts imply ${expected}`, gate(records), expected);
    }
  });
}
