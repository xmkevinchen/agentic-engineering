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

export function admissibility({
  contract,        // the active revision: names an observation per obligation
  assignment,      // grants: producer, boundary, obligations
  approvals,       // approval history, for activation ordering
  index,           // resolvers: package(id), attempt(id), artifact(id), commandResult(id)
  inputsNow,       // current identity of a material input, or null if gone
}) {
  return function admit(record) {
    // --- the observation the Contract named -------------------------------
    const named = contract.observations && contract.observations[record.obligation];
    if (!named) return 'observation_not_named';
    if (record.observation !== named) return 'observation_not_named';

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

    // --- bound to one execution -------------------------------------------
    for (const field of ['contract_revision', 'assignment', 'attempt', 'producer', 'artifact']) {
      if (record[field] == null) return 'binding_missing';
    }
    const pkg = record.package ? index.package(record.package) : null;
    if (!record.package) return 'binding_missing';
    if (!pkg) return 'binding_unresolved';

    const attempt = index.attempt(record.attempt);
    if (!attempt) return 'binding_unresolved';
    if (!index.artifact(record.artifact)) return 'binding_unresolved';

    // Each resolves. Do they belong together?
    if (record.assignment !== assignment.id) return 'binding_cross_execution';
    if (assignment.contract_revision !== record.contract_revision) return 'binding_cross_execution';
    if (attempt.assignment !== assignment.id) return 'binding_cross_execution';
    if (attempt.producer !== record.producer) return 'binding_cross_execution';

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
    const recorded = new Set((pkg.material_inputs || []).map((i) => i.id));
    for (const used of result.inputs_used || []) {
      if (!recorded.has(used)) return 'material_input_incomplete';
    }
    for (const input of pkg.material_inputs || []) {
      if (inputsNow(input.id) === null) return 'binding_unresolved';
    }

    return null;
  };
}

// A change is inside the boundary when some allowed prefix contains it. Prefixes
// are compared on path segments: `docs/v1` does not contain `docs/v1x`.
export function withinBoundary(path, boundary) {
  const parts = path.split('/');
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
      if (now === null) return true;
      if (now !== input.identity) return true;
    }
    return false;
  };
}
