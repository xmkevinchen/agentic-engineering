// AC-2 — evidence is externally produced, bound, current, in-boundary, non-vacuous.

import { admissibility, withinBoundary, inputsChangedAgainst } from '../lib/admissibility.mjs';
import { group, ok, eq } from './harness.mjs';

// A list, as the schema requires. An earlier version of this fixture was an
// obligation-keyed object — schema-invalid, and it hid a real mismatch: the
// implementation read it as an object while the schema required a list, so a
// schema-valid Contract would have had every observation rejected. A fixture the
// schema would refuse cannot demonstrate anything about schema-valid input.
const contract = {
  observations: [{ obligation: 'O', observation: 'sh plugins/ae/scripts/ae-run-tests.sh' }],
};
const assignment = { id: 'A1', contract_revision: 'r1', boundary: ['docs/v1'] };
const approvals = [{ lineage: 'L', revision: 'r1', seq: 5 }];

// The package carries the same five identities as the observation. Resolving it
// is not binding: a package explicitly bound to another execution resolved fine
// until this was compared.
const pkg = {
  seq: 4,
  id: 'pkg1', contract_revision: 'r1', assignment: 'A1', attempt: 1, producer: 'P',
  command_result: 'cr1', artifact: 'art1',
  changed_paths: ['docs/v1/a.md'],
  material_inputs: [{ id: 'in1', path: 'in1', identity: 'sha256:aa' }],
};
const result = {
  origin: 'harness', seq: 9, subjects: 69, inputs_used: ['in1'],
  attempt: 1, artifact: 'art1', command: 'sh plugins/ae/scripts/ae-run-tests.sh',
};
const attempt = { seq: 1, assignment: 'A1', producer: 'P' };

function build(over = {}) {
  const {
    pkgOver = {}, resultOver = {}, attemptOver = {},
    inputsNow = () => ({ identity: 'sha256:aa', seq: 9, path: 'in1' }), ...recOver
  } = over;
  const P = { ...pkg, ...pkgOver };
  const R = { ...result, ...resultOver };
  const T = { ...attempt, ...attemptOver };
  const index = {
    package: (id) => (id === P.id ? P : null),
    attempt: (n) => (n === T.seq ? T : null),
    artifact: (id) => (id === 'art1' ? {} : null),
    commandResult: (id) => (id === 'cr1' ? R : null),
  };
  const admit = admissibility({ contract, assignment, approvals, index, inputsNow, run: 'run1' });
  const record = {
    kind: 'observation', lineage: 'L', obligation: 'O',
    observation: 'sh plugins/ae/scripts/ae-run-tests.sh',
    run: 'run1', contract_revision: 'r1', assignment: 'A1', attempt: 1, producer: 'P',
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
    // And the runner's own record must name the same command, or a result for
    // something else could be pointed at this obligation.
    const swapped = build({ resultOver: { command: 'echo ok' } });
    eq('a result for another command', swapped.admit(swapped.record), 'observation_not_named');
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
    // The decisive case the earlier draft missed: a package that resolves, and is
    // explicitly bound to a different execution.
    const foreignPkg = build({ pkgOver: { assignment: 'OTHER', attempt: 9 } });
    eq('a package from another execution',
      foreignPkg.admit(foreignPkg.record), 'binding_cross_execution');
    // The artifact is one of those identities. A package attesting to a different
    // artifact than the observation names is evidence for another product.
    const foreignArtifact = build({ pkgOver: { artifact: 'art2' } });
    eq('a package attesting to another artifact',
      foreignArtifact.admit(foreignArtifact.record), 'binding_cross_execution');
    const foreignResult = build({ resultOver: { attempt: 9 } });
    eq('a command result from another attempt',
      foreignResult.admit(foreignResult.record), 'binding_cross_execution');
    // The decisive one: a real green run, paired with an artifact it never
    // touched. Everything resolved, and that artifact became the deliverable.
    const untested = build({ resultOver: { artifact: 'art2' } });
    eq('a command result for another artifact',
      untested.admit(untested.record), 'binding_cross_execution');
    // A submission naming another run while pointing at this run's attempt.
    // Nothing stops a party writing that: `submitObservation` takes the attempt
    // as an argument and does not require it to belong to the run. Selection
    // matches it by attempt, so this comparison is what keeps the runs apart.
    const foreignRun = build({ run: 'run2' });
    eq('a submission belonging to another run',
      foreignRun.admit(foreignRun.record), 'binding_cross_execution');
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
    // Both of these used to normalise into something the boundary accepted. An
    // absolute path is outside any repository-relative boundary by construction,
    // and `..` at the root escapes rather than cancelling.
    ok('an absolute path is outside', withinBoundary('/docs/v1/a.md', ['docs/v1']) === false);
    ok('traversal above the root escapes',
      withinBoundary('../../docs/v1/a.md', ['docs/v1']) === false);
    ok('traversal inside it still resolves',
      withinBoundary('docs/v1/sub/../a.md', ['docs/v1']) === true);
    const outsideAbsolute = build({ pkgOver: { changed_paths: ['/etc/passwd'] } });
    eq('and the package carrying one is refused',
      outsideAbsolute.admit(outsideAbsolute.record), 'change_out_of_boundary');
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
    // Silence is not "used nothing". A runner that did not report leaves the
    // completeness question unanswered, and assuming completeness from an absent
    // field is the vacuity this refuses.
    const silent = build({ resultOver: { inputs_used: undefined } });
    eq('a runner that did not report its inputs',
      silent.admit(silent.record), 'material_input_incomplete');
  });

  group('AC-4 · the second staleness — a recorded input changed', () => {
    const index = { package: () => pkg };
    const at = (identity) => () => ({ identity, seq: 9, path: 'in1' });
    const changed = inputsChangedAgainst(index, at('sha256:bb'));
    ok('a changed input is stale', changed({ package: 'pkg1' }) === true);
    const unchanged = inputsChangedAgainst(index, at('sha256:aa'));
    ok('an unchanged input is not', unchanged({ package: 'pkg1' }) === false);
  });
}
