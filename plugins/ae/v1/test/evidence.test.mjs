// AC-2 — evidence is externally produced, bound, current, in-boundary, non-vacuous.

import { admissibility, withinBoundary, inputsChangedAgainst } from '../lib/admissibility.mjs';
import { group, ok, eq } from './harness.mjs';

const contract = { observations: { O: 'sh plugins/ae/scripts/ae-run-tests.sh' } };
const assignment = { id: 'A1', contract_revision: 'r1', boundary: ['docs/v1'] };
const approvals = [{ lineage: 'L', revision: 'r1', seq: 5 }];

const pkg = {
  id: 'pkg1', changed_paths: ['docs/v1/a.md'],
  material_inputs: [{ id: 'in1', identity: 'sha256:aa' }],
};
const result = { origin: 'harness', seq: 9, subjects: 69, inputs_used: ['in1'] };
const attempt = { attempt: 'at1', assignment: 'A1', producer: 'P' };

function build(over = {}) {
  const {
    pkgOver = {}, resultOver = {}, attemptOver = {}, inputsNow = () => 'sha256:aa', ...recOver
  } = over;
  const P = { ...pkg, ...pkgOver };
  const R = { ...result, ...resultOver };
  const T = { ...attempt, ...attemptOver };
  const index = {
    package: (id) => (id === P.id ? P : null),
    attempt: (id) => (id === T.attempt ? T : null),
    artifact: (id) => (id === 'art1' ? {} : null),
    commandResult: (id) => (id === 'cr1' ? R : null),
  };
  const admit = admissibility({ contract, assignment, approvals, index, inputsNow });
  const record = {
    kind: 'observation', lineage: 'L', obligation: 'O',
    observation: 'sh plugins/ae/scripts/ae-run-tests.sh',
    contract_revision: 'r1', assignment: 'A1', attempt: 'at1', producer: 'P',
    artifact: 'art1', package: 'pkg1', command_result: 'cr1',
    ...recOver,
  };
  return { admit, record, index };
}

export function evidenceTests() {
  group('AC-2 · a well-formed observation is admissible', () => {
    const { admit, record } = build();
    ok('admitted', admit(record) === null);
  });

  group('AC-2 · it must answer the observation the Contract named', () => {
    const { admit, record } = build({ observation: 'echo ok' });
    eq('a different command', admit(record), 'observation_not_named');
    const other = build({ obligation: 'UNKNOWN' });
    eq('an obligation with no named observation', other.admit(other.record), 'observation_not_named');
  });

  group('AC-2 · the raw result is externally produced', () => {
    // A submission carrying its own result is refused rather than merged: an
    // agent's account of its own run is its self-report.
    const own = build({ raw_result: 'all green' });
    eq('a submission-authored result', own.admit(own.record), 'result_self_authored');
    const notHarness = build({ resultOver: { origin: 'submission' } });
    eq('a result the Harness did not write', notHarness.admit(notHarness.record), 'result_self_authored');
  });

  group('AC-2 · bindings resolve and belong to one execution', () => {
    for (const field of ['contract_revision', 'assignment', 'attempt', 'producer', 'artifact']) {
      const missing = build({ [field]: null });
      eq(`${field} absent`, missing.admit(missing.record), 'binding_missing');
    }
    const dangling = build({ artifact: 'gone' });
    eq('a reference that does not resolve', dangling.admit(dangling.record), 'binding_unresolved');
    // Each resolves, but they do not belong together — the case an earlier draft
    // missed by checking existence and calling it binding.
    const cross = build({ assignment: 'A2' });
    eq('an assignment from another execution', cross.admit(cross.record), 'binding_cross_execution');
    const otherProducer = build({ attemptOver: { producer: 'Q' } });
    eq('an attempt opened by someone else',
      otherProducer.admit(otherProducer.record), 'binding_cross_execution');
  });

  group('AC-2 · the observation postdates activation', () => {
    // Results gathered against candidate bytes, then relabelled with post-approval
    // identities. Ordered by the record, not by a time the submission supplied.
    const early = build({ resultOver: { seq: 3 } });
    eq('captured before approval', early.admit(early.record), 'capture_before_activation');
    const same = build({ resultOver: { seq: 5 } });
    eq('captured at the approval itself', same.admit(same.record), 'capture_before_activation');
  });

  group('AC-2 · changes stay inside the boundary', () => {
    const outside = build({ pkgOver: { changed_paths: ['docs/v1/a.md', 'src/x.js'] } });
    eq('a change outside it', outside.admit(outside.record), 'change_out_of_boundary');
    ok('a prefix is not containment', withinBoundary('docs/v1x/a.md', ['docs/v1']) === false);
  });

  group('AC-2 · non-vacuity', () => {
    const zero = build({ resultOver: { subjects: 0 } });
    eq('zero subjects exercised', zero.admit(zero.record), 'vacuous_observation');
    // Output the runner could not count is inadmissible rather than assumed
    // non-vacuous: nobody may assume it counted.
    const uncountable = build({ resultOver: { subjects: null } });
    eq('an uncountable result', uncountable.admit(uncountable.record), 'vacuous_observation');
  });

  group('AC-2 · material inputs are complete', () => {
    // A recorded set that omits an input the run used is not a smaller true
    // statement; it is a false one, because staleness is computed over it.
    const omitted = build({
      pkgOver: { material_inputs: [] },
      resultOver: { inputs_used: ['in1'] },
    });
    eq('an input used but not recorded', omitted.admit(omitted.record), 'material_input_incomplete');
    const gone = build({ inputsNow: () => null });
    eq('a recorded input that no longer resolves', gone.admit(gone.record), 'binding_unresolved');
  });

  group('AC-4 · the second staleness — a recorded input changed', () => {
    const index = { package: () => pkg };
    const changed = inputsChangedAgainst(index, () => 'sha256:bb');
    ok('a changed input is stale', changed({ package: 'pkg1' }) === true);
    const unchanged = inputsChangedAgainst(index, () => 'sha256:aa');
    ok('an unchanged input is not', unchanged({ package: 'pkg1' }) === false);
  });
}
