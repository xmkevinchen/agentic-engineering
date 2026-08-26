// The Kernel — the only way in.
//
// The first implementation was a set of correct checks that a caller could
// assemble, or not. `reduce` took an optional `admit`; omitting it let a bare
// observation reach `passed`. `requireHumanInput` took any object whose caller
// wrote `origin: 'host'`. Every check was right and none was compulsory, which is
// the difference between "this path has checks" and "there is no other path" —
// and the second is the whole point.
//
// So: one object owns the log, and the facts that decide admissibility exist only
// because it wrote them. A caller cannot manufacture a host-collected input,
// because the only function that stamps one is a method here, and stamping is not
// exposed. Forging one means writing the log file directly, which is the OS-level
// access §4 already concedes and does not pretend to resist.

import { Ledger } from './ledger.mjs';
import { reduceAll, STATUS } from './gate.mjs';
import { admissibility, inputsChangedAgainst } from './admissibility.mjs';
import { currentRevision as deriveCurrent, verify } from './identity.mjs';
import { checkRequestedSurvives, checkUnanswered, requestedFamily } from './family.mjs';
import { fail } from './codes.mjs';

// Origin is stamped here and nowhere else. It is not a brand — a brand travels
// with a value a caller already holds. This is a property the caller never gets
// to set, because the only writer of these records is below.
const HOST = 'host';
const HARNESS = 'harness';

export class Kernel {
  constructor(logPath) {
    this.ledger = new Ledger(logPath);
  }

  // --- reads -------------------------------------------------------------

  records() { return this.ledger.read(); }

  approvals() {
    return this.records().filter(
      (r) => r.kind === 'contract_approved_genesis' || r.kind === 'contract_approved_revision',
    );
  }

  // Current revision is derived from the approval history, never accepted from a
  // caller. An earlier draft took it as a parameter, which let the party being
  // judged choose the yardstick.
  currentRevision(lineage) {
    return deriveCurrent(this.approvals(), lineage);
  }

  find(kind, id) {
    return this.records().find((r) => r.kind === kind && r.id === id) || null;
  }

  // --- host-collected inputs ---------------------------------------------
  //
  // The trust root, as a write path. `collectHumanInput` is the only producer of
  // a record with `origin: host`, and it is a method rather than a free function
  // so that holding one requires having gone through the Kernel.

  collectHumanInput({ operation, actor, lineage, ...payload }) {
    if (Object.prototype.hasOwnProperty.call(payload, 'origin')) {
      fail('human_input_self_supplied', 'a caller may not supply an origin', { operation });
    }
    return this.ledger.append({
      kind: 'human_decision', operation, actor, lineage, origin: HOST, ...payload,
    });
  }

  recordCommandResult({ id, lineage, run, attempt, command, exit, raw, subjects, inputsUsed }) {
    // `inputsUsed` is not defaulted. An omitted argument became `[]`, which reads
    // as "used nothing" and made the later completeness check unreachable — the
    // vacuity the check exists to refuse, introduced by the channel that was
    // supposed to close it.
    if (!Array.isArray(inputsUsed)) {
      fail('material_input_incomplete', 'the runner must report which inputs it used', { id });
    }
    return this.ledger.append({
      kind: 'command_result', id, lineage, run, attempt, command, exit,
      raw, subjects, inputs_used: inputsUsed, origin: HARNESS,
    });
  }

  recordPackage(pkg) {
    return this.ledger.append({ kind: 'evidence_package', ...pkg });
  }

  recordArtifact({ id, lineage, run, artifactKind, identity }) {
    return this.ledger.append({
      kind: 'artifact_recorded', id, lineage, run, artifact_kind: artifactKind, identity,
    });
  }

  // --- the guarded operations --------------------------------------------

  approve({ lineage, revision, bytes, identity, predecessor, view, actor }) {
    verify(bytes, identity);
    const prior = this.approvals().filter((a) => a.lineage === lineage);
    if (prior.length === 0 && predecessor != null) {
      fail('lineage_predecessor_wrong', 'a lineage genesis has no predecessor', { lineage });
    }
    if (prior.length > 0) {
      if (predecessor == null) {
        fail('lineage_second_genesis', 'a lineage may open only one genesis', { lineage });
      }
      const last = prior[prior.length - 1];
      if (predecessor !== last.identity.byte_sha256) {
        fail('lineage_predecessor_wrong', 'predecessor is not the prior revision', { lineage });
      }
    }
    if (!view || !view.renders_sha256 || view.renders_sha256 !== identity.byte_sha256) {
      fail('human_input_absent', 'approval must record the view of these exact bytes', { lineage });
    }
    const decision = this.collectHumanInput({
      operation: 'activation', actor, lineage, revision, view,
    });
    // Genesis and revision are separate shapes, so the key is absent rather than
    // present-and-undefined. `undefined` is still an own property, and a closed
    // schema counts it as one — which is the honest behaviour: "absent" cannot be
    // spelled as a value.
    const base = { lineage, revision, identity, decision: decision.seq };
    return this.ledger.append(
      prior.length === 0
        ? { kind: 'contract_approved_genesis', ...base }
        : { kind: 'contract_approved_revision', ...base, predecessor },
    );
  }

  // An attempt may be opened only by the producer the Assignment names, and the
  // record of who opened it is written here rather than claimed by the opener.
  openAttempt({ lineage, run, producer, obligations, submitter }) {
    if (submitter !== producer) {
      fail('identity_self_asserted', 'the submitter is not the producer it names', {
        submitter, producer,
      });
    }
    // Resolved from the log, not accepted as an argument. A caller previously
    // passed an Assignment object with grants it had chosen itself.
    const issued = this.records().find(
      (r) => r.kind === 'assignment_issued' && r.lineage === lineage && r.run === run,
    );
    if (!issued) {
      fail('assignment_not_issued', 'no Assignment was issued for this run', { lineage, run });
    }
    if (issued.grants.attempt_producer !== producer) {
      fail('attempt_not_granted', 'only the granted producer may open an attempt', { producer });
    }
    const assignment = issued;
    return this.ledger.append({
      kind: 'attempt_opened', lineage, run, assignment: assignment.id,
      attempt: `${assignment.id}#${this.ledger.seq}`, producer, obligations,
    });
  }

  // The Assignment is issued by the Human Owner, bound to an approved revision,
  // and the beneficiary may not be the actor. A producer minting one that grants
  // itself what it wants is the regress this ends.
  issueAssignment({ lineage, run, id, contractRevision, actor, beneficiary, boundary, grants }) {
    if (actor === beneficiary) {
      fail('assignment_self_issued', 'the party an Assignment grants may not issue it', { id });
    }
    if (this.currentRevision(lineage) !== contractRevision) {
      fail('assignment_not_issued', 'an Assignment must bind the current approved revision', {
        id, contractRevision,
      });
    }
    const existing = this.records().filter(
      (r) => r.kind === 'assignment_issued' && r.lineage === lineage,
    );
    if (existing.length > 0) {
      fail('assignment_not_unique', 'a run holds exactly one Assignment', { id });
    }
    // The grants and the boundary are part of the issuance, not something the
    // holder supplies later. An earlier version recorded who issued it and let
    // the Assignment object carry self-selected grants.
    return this.ledger.append({
      kind: 'assignment_issued', lineage, run, id, contract_revision: contractRevision,
      actor, beneficiary, boundary, grants, origin: HOST,
    });
  }

  recordUnavailable({ lineage, run, obligation, attempt, requested }) {
    return this.ledger.append({
      kind: 'capability_unavailable', lineage, run, obligation, attempt,
      requested, origin: HARNESS,
    });
  }

  recordDelivery({ lineage, to, carried, provenance }) {
    return this.ledger.append({
      kind: 'delivery', lineage, to, carried, provenance, origin: HARNESS,
    });
  }

  // An observation names the runner's record; it does not carry one. The
  // separation is what stops a submission authoring its own raw result.
  submitObservation({ lineage, run, obligation, observation, attempt, contractRevision,
    assignment, producer, artifact, pkg, commandResult, submitter }) {
    if (submitter !== producer) {
      fail('identity_self_asserted', 'the submitter is not the producer it names', {
        submitter, producer,
      });
    }
    // No outcome parameter. What the run produced is in the runner's record; the
    // observation says which obligation it answers and which evidence it points
    // at, and stops there.
    return this.ledger.append({
      kind: 'observation', lineage, run, obligation, observation, attempt,
      contract_revision: contractRevision, assignment, producer, artifact,
      package: pkg, command_result: commandResult,
    });
  }

  signOff({ lineage, run, contractRevision, deliverable, actor, acceptedReview }) {
    return this.ledger.append({
      kind: 'human_signoff', lineage, run, contract_revision: contractRevision,
      deliverable, actor, origin: HOST,
      ...(acceptedReview ? { accepted_review: acceptedReview } : {}),
    });
  }

  recordCompletion({ lineage, run, acceptance, path }) {
    return this.ledger.append({
      kind: 'completion_committed', lineage, run, acceptance, path,
    });
  }

  recordRun({ lineage, run, formationElapsed, changeElapsed, traceOutcome, wentWrong }) {
    return this.ledger.append({
      kind: 'run_record', lineage, run,
      formation_elapsed: formationElapsed, change_elapsed: changeElapsed,
      trace_outcome: traceOutcome, went_wrong: wentWrong,
    });
  }

  // The index resolves from the log and takes nothing from a caller. An earlier
  // version accepted `index` and `inputsNow` as parameters, which let the party
  // being judged supply the evidence universe — packages and command results that
  // had never been recorded resolved fine and produced `passed`.
  index() {
    const records = this.records();
    const findBy = (kind, field) => (value) => records.find(
      (r) => r.kind === kind && r[field] === value,
    ) || null;
    return {
      commandResult: findBy('command_result', 'id'),
      attempt: findBy('attempt_opened', 'attempt'),
      package: findBy('evidence_package', 'id'),
      artifact: findBy('artifact_recorded', 'id'),
    };
  }

  // The verdict, computed from what the runner observed. Nothing the submission
  // says is read here — there is no field it could say it in.
  //
  // Only the exit status. Non-vacuity is admissibility's (AC-2), and a copy of it
  // here was unreachable: the reduction calls this only after `admit` returned
  // null, and `admit` already refuses a result with no subjects. A second layer no
  // planted defect can turn red is a claim of protection nothing holds to account,
  // so it states the property once, where it is reachable.
  outcomeReader() {
    const index = this.index();
    return (record) => {
      const result = index.commandResult(record.command_result);
      if (!result) return null;
      return result.exit === 0;
    };
  }

  // Deliveries are what makes "the contributor consumed the shared basis"
  // observable rather than self-reported: a contribution is admissible only
  // against one. Consumption itself is not observable, and the Contract claims
  // only delivery — this is the reader that makes the claim mean something.
  deliveriesTo(actor, lineage) {
    return this.records().filter(
      (r) => r.kind === 'delivery' && r.to === actor && r.lineage === lineage,
    );
  }

  // AC-9's arithmetic reads this. The retreat condition fires when formation
  // elapsed exceeds change elapsed and the trace caught nothing; recording the
  // facts without anything reading them would be a kind with no consumer.
  retreatCondition(lineage, run) {
    const record = this.records().find(
      (r) => r.kind === 'run_record' && r.lineage === lineage && r.run === run,
    );
    if (!record) return null;
    return {
      fired: record.formation_elapsed > record.change_elapsed
        && record.trace_outcome === 'caught_nothing',
      formation: record.formation_elapsed,
      change: record.change_elapsed,
      trace: record.trace_outcome,
    };
  }

  // Observations reach the Gate through `status`, which reads them by kind. This
  // names that reader explicitly so the audit can see it.
  observationsFor(lineage, obligation) {
    return this.records().filter(
      (r) => r.kind === 'observation' && r.lineage === lineage && r.obligation === obligation,
    );
  }

  // --- the reduction ------------------------------------------------------
  //
  // No optional admissibility. The Gate always runs the full check, because a
  // check a caller may omit is a check that does not exist.

  status({ contract, lineage, assignment, inputsNow, run }) {
    const records = this.records();
    const index = this.index();
    const current = this.currentRevision(lineage);
    if (current === null) {
      fail('assignment_not_issued', 'nothing is approved for this lineage', { lineage });
    }
    const admit = admissibility({
      contract, assignment, approvals: this.approvals(), index, inputsNow,
    });
    const result = reduceAll({
      records, lineage, obligations: contract.obligations, currentRevision: current,
      admit,
      inputsChanged: inputsChangedAgainst(index, inputsNow),
      outcomeOf: this.outcomeReader(),
    });

    // The verdict is recorded, because completion relies on it and AC-13 says
    // everything either the Gate or the Human Owner relies on is recorded when it
    // happens. Without this, replay could reconstruct the inputs but not the
    // decision they produced — and "the Gate said passed" would be a claim with
    // nothing behind it.
    if (run) {
      for (const obligation of contract.obligations) {
        const v = result.byObligation[obligation];
        this.ledger.append({
          kind: 'gate_result', lineage, run, contract_revision: current, obligation,
          status: v.status,
          ...(v.code ? { code: v.code } : {}),
          ...(v.attempt ? { attempt: v.attempt } : {}),
          ...(v.selected ? { selected: v.selected } : {}),
        });
      }
    }
    return result;
  }

  // Completion. There is no second entry point: `emitAcceptance` used to live in
  // its own module, call the reducer itself, and forward admissibility as an
  // optional argument — so the channel could be walked around by importing the
  // other thing. It is deleted rather than deprecated.
  complete({ contract, lineage, run, assignment, deliverable, actor, inputsNow, acceptedReview }) {
    const { byObligation, allPassed } = this.status({
      contract, lineage, assignment, inputsNow, run,
    });
    if (!allPassed) {
      const first = contract.obligations.find((o) => byObligation[o].status !== 'passed');
      fail('not_all_passed', 'completion requires every obligation to be passed', {
        obligation: first, status: byObligation[first].status,
      });
    }

    // The unavailable arm is checked here too: a Contract that declared
    // cross-family cannot complete while its dispatch guarantees are unmet.
    this.checkUnavailableArm({ contract, lineage });

    const current = this.currentRevision(lineage);
    const required = contract.independence.required === 'cross_family_required';
    if (required && !acceptedReview) {
      fail('review_required_absent', 'the Contract required a review and none is carried', {});
    }

    const signoff = this.signOff({
      lineage, run, contractRevision: current,
      deliverable: deliverable.identity, actor, acceptedReview,
    });

    // After the Gate, and bound to this run, revision and deliverable. The
    // sign-off is appended above, so its position in the log is what orders it —
    // not a sequence number the caller chose.
    const lastGateInput = Math.max(
      ...this.records()
        .filter((r) => r.kind === 'gate_result' && r.run === run)
        .map((r) => r.seq),
      -1,
    );
    if (!(signoff.seq > lastGateInput)) {
      fail('signoff_before_gate', 'the sign-off predates the Gate result', {
        signoff: signoff.seq, lastGate: lastGateInput,
      });
    }

    // The Acceptance is exactly the shape the schema states — the verdicts travel
    // beside it rather than inside it, because a closed schema means an extra
    // field is a validation failure and not a helpful addition.
    const acceptance = {
      lineage,
      contract_revision: current,
      contract_identity: contract.identity,
      deliverable,
      decision: { outcome: 'accepted', origin: HOST, run, seq: signoff.seq },
      review: required
        ? { required: true, accepted_review: acceptedReview }
        : { required: false, statement: 'no independent review required by this Contract' },
    };
    return {
      acceptance,
      verdicts: this.records().filter((r) => r.kind === 'gate_result' && r.run === run),
      obligations: contract.obligations,
    };
  }

  // The unavailable arm is on the path, not beside it. An earlier draft had a
  // function that checked it and nothing that called that function.
  checkUnavailableArm({ contract, lineage }) {
    if (requestedFamily(contract) === null) return null;
    const records = this.records();
    const dispatches = records.filter((r) => r.kind === 'dispatch_attempt' && r.lineage === lineage);
    for (const d of dispatches) {
      checkRequestedSurvives(contract, d);
      checkUnanswered(d);
      if (d.substituted_family || d.answered_family) {
        fail('same_family_substituted', 'a seat answered for the unavailable one', {});
      }
    }
    const unavailable = records.find(
      (r) => r.kind === 'capability_unavailable' && r.lineage === lineage,
    );
    if (!unavailable) return null;
    const decision = records.find(
      (r) => r.kind === 'human_decision' && r.operation === 'unavailable_decision'
        && r.lineage === lineage && r.seq > unavailable.seq,
    );
    if (!decision) {
      fail('human_input_absent', 'the unavailable arm requires a decision recorded after it', {
        unavailable: unavailable.seq,
      });
    }
    if (!['wait', 'stop', 'amend'].includes(decision.choice)) {
      fail('human_input_absent', 'the decision must be wait, stop, or amend', {
        choice: decision.choice,
      });
    }
    return { unavailable: unavailable.seq, choice: decision.choice };
  }
}

export { STATUS };
