// Evidence admissibility — AC-2.
//
// Six properties, each with a code, because a falsifier that cannot name what it
// caught is a falsifier a test cannot assert on.
//
// The ordering matters. Resolution comes before comparison: a reference that does
// not resolve is inadmissible evidence, not absent evidence, and collapsing the
// two is how tampering surfaces as `pending`. Everything here returns a code
// rather than throwing, because the Gate turns it into a status and a thrown
// error would bypass the reduction that must produce it.

// The unavailable arm's own admissibility. AC-4 says both arms reach a status
// through the same reduction; that is only true if the unavailable record is
// checked like any other submission. An earlier version mapped every
// `capability_unavailable` straight to `unavailable`, and the dispatch checks sat
// in a function `complete` called after it had already established everything
// passed — unreachable for exactly the runs that had an unavailable result.
function admitUnavailable(record, { contract, assignment, index }) {
  const stated = contract.independence.required === 'cross_family_required'
    ? contract.independence.requested_family
    : null;
  if (stated === null) {
    // Nothing was requested, so nothing can have been unavailable.
    return 'requested_from_wrong_source';
  }
  if (!Array.isArray(record.requested)) return 'requested_dropped';
  if (JSON.stringify(record.requested) !== JSON.stringify(stated)) {
    return 'requested_substituted';
  }
  const attempt = index.attempt(record.attempt);
  if (!attempt) return 'binding_unresolved';
  if (attempt.assignment !== assignment.id) return 'binding_cross_execution';

  const dispatch = index.dispatch(record.attempt, record.obligation);
  if (!dispatch) return 'binding_unresolved';
  if (JSON.stringify(dispatch.requested) !== JSON.stringify(stated)) {
    return 'requested_substituted';
  }
  for (const field of ['observed', 'effective']) {
    if (Object.prototype.hasOwnProperty.call(dispatch, field)) return 'observed_without_answer';
  }
  if (dispatch.substituted_family || dispatch.answered_family) {
    return 'same_family_substituted';
  }
  return null;
}

export function admissibility({
  contract,        // the active revision: names an observation per obligation
  assignment,      // grants: producer, boundary, obligations
  approvals,       // approval history, for activation ordering
  index,           // resolvers: package(id), attempt(id), artifact(id), commandResult(id)
  inputsNow,       // the Harness's latest observation of a material input
  run,             // the execution being judged
}) {
  return function admit(record) {
    // Not a duplicate of selection's attempt filter. Attempt ids are minted from
    // an Assignment id and a sequence number, and an Assignment id is unique only
    // within a run — so two runs can mint the same attempt and each other's
    // submissions become selectable. This is the comparison that separates them.
    if (record.run !== run) return 'binding_cross_execution';

    if (record.kind === 'capability_unavailable') {
      return admitUnavailable(record, { contract, assignment, index });
    }

    // --- the observation the Contract named -------------------------------
    // A list, matching the schema. An earlier draft read this as an
    // obligation-keyed object while the schema required a list, so a
    // schema-valid Contract had every observation rejected — and the tests hid
    // it by using an object-shaped fixture the schema would have refused.
    const entry = (contract.observations || []).find((o) => o.obligation === record.obligation);
    if (!entry) return 'observation_not_named';
    if (record.observation !== entry.observation) return 'observation_not_named';

    // --- externally produced ----------------------------------------------
    // The raw result is a record the Harness wrote. A submission carrying its own
    // is refused rather than merged: an agent's account of its own run is its
    // self-report, and self-report is never evidence.
    if (Object.prototype.hasOwnProperty.call(record, 'raw_result')) {
      return 'result_self_authored';
    }
    if (!record.command_result) return 'binding_missing';
    const result = index.commandResult(record.command_result);
    if (!result) return 'binding_unresolved';
    if (result.origin !== 'harness') return 'result_self_authored';
    // The runner's record must name the same command the Contract did, or a
    // result for something else could be pointed at this obligation. This is a
    // naming check, not a binding one, so it belongs here; the result's execution
    // binding is checked below with the rest.
    if (result.command !== entry.observation) return 'observation_not_named';

    // --- bound to one execution -------------------------------------------
    // Resolution first, comparison second. A missing field and a field pointing
    // at another execution are different verdicts, and checking them out of order
    // reports the second when the first is true.
    for (const field of ['contract_revision', 'assignment', 'attempt', 'producer', 'artifact']) {
      if (record[field] == null) return 'binding_missing';
    }
    if (!record.package) return 'binding_missing';

    const pkg = index.package(record.package);
    if (!pkg) return 'binding_unresolved';
    const attempt = index.attempt(record.attempt);
    if (!attempt) return 'binding_unresolved';
    if (!index.artifact(record.artifact)) return 'binding_unresolved';

    // Everything resolves. Do they belong together? Resolving is not binding: a
    // package explicitly bound to another execution resolved fine in an earlier
    // draft, because nothing compared the two.
    if (record.assignment !== assignment.id) return 'binding_cross_execution';
    if (assignment.contract_revision !== record.contract_revision) return 'binding_cross_execution';
    if (attempt.assignment !== assignment.id) return 'binding_cross_execution';
    if (attempt.producer !== record.producer) return 'binding_cross_execution';
    for (const field of ['contract_revision', 'assignment', 'attempt', 'producer', 'artifact']) {
      if (pkg[field] !== record[field]) return 'binding_cross_execution';
    }
    if (pkg.command_result !== record.command_result) return 'binding_cross_execution';
    if (result.attempt !== record.attempt) return 'binding_cross_execution';

    // --- captured after activation ----------------------------------------
    // Ordered by the record, not by a time the submission supplied. Results
    // gathered against candidate bytes and relabelled after approval fail here.
    const activation = approvals.findIndex(
      (a) => a.lineage === record.lineage && a.revision === record.contract_revision,
    );
    if (activation === -1) return 'binding_unresolved';
    if (result.seq == null || result.seq <= approvals[activation].seq) {
      return 'capture_before_activation';
    }

    // --- inside the assignment's boundary ---------------------------------
    for (const path of pkg.changed_paths || []) {
      if (!withinBoundary(path, assignment.boundary)) return 'change_out_of_boundary';
    }

    // --- non-vacuous -------------------------------------------------------
    // Zero subjects is not a pass. Output whose subject count cannot be
    // established is inadmissible rather than assumed non-vacuous — the runner
    // could not count, so nobody may assume it counted.
    if (result.subjects == null) return 'vacuous_observation';
    if (!(result.subjects > 0)) return 'vacuous_observation';

    // --- material inputs complete -----------------------------------------
    // A recorded set that omits an input the observation used is not a smaller
    // true statement; it is a false one, because staleness is then computed over
    // the wrong set.
    // An absent `inputs_used` is not "used nothing" — it is a runner that did not
    // report, and assuming completeness from silence is the vacuity this refuses.
    if (!Array.isArray(result.inputs_used)) return 'material_input_incomplete';
    const recorded = new Set((pkg.material_inputs || []).map((i) => i.id));
    for (const used of result.inputs_used) {
      if (!recorded.has(used)) return 'material_input_incomplete';
    }
    for (const input of pkg.material_inputs || []) {
      const now = inputsNow(input.id);
      // Never observed is not "unchanged". An input the Harness has not looked at
      // cannot be shown to be current, and assuming it is would be the vacuity
      // this section refuses.
      if (now === undefined) return 'material_input_incomplete';
      if (now === null) return 'binding_unresolved';
    }

    return null;
  };
}

// A change is inside the boundary when some allowed prefix contains it. Prefixes
// are compared on path segments: `docs/v1` does not contain `docs/v1x`.
export function withinBoundary(path, boundary) {
  // Normalise first. Comparing raw segments accepted `docs/v1/../../src/secret.js`
  // against boundary `docs/v1`, because the first two segments matched and nobody
  // asked where the rest went.
  // An absolute path is outside any repository-relative boundary by construction,
  // and `..` at the root escapes rather than cancelling. Both used to normalise
  // into something the boundary accepted: `/docs/v1/a` and `../../docs/v1/a` both
  // became `docs/v1/a`.
  if (path.startsWith('/')) return false;
  const parts = [];
  for (const seg of path.split('/')) {
    if (seg === '' || seg === '.') continue;
    if (seg === '..') {
      if (parts.length === 0) return false;
      parts.pop();
      continue;
    }
    parts.push(seg);
  }
  return (boundary || []).some((allowed) => {
    const a = allowed.split('/');
    if (a.length > parts.length) return false;
    return a.every((seg, i) => seg === parts[i]);
  });
}

// Staleness of the second kind — AC-4's second `stale` row. Separate from
// admissibility: the evidence was admissible when written, and the world moved.
export function inputsChangedAgainst(index, inputsNow) {
  return function inputsChanged(record) {
    const pkg = index.package(record.package);
    if (!pkg) return false;
    for (const input of pkg.material_inputs || []) {
      const now = inputsNow(input.id);
      if (now === undefined) return false;
      if (now === null) return true;
      if (now !== input.identity) return true;
    }
    return false;
  };
}
