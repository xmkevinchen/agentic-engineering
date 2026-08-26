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
import { currentRevision as deriveCurrent, identify, verify } from './identity.mjs';
import { checkRequestedSurvives, checkUnanswered, dispatchRecord, requestedFamily } from './family.mjs';
import { commitCompletion } from './writer.mjs';
import { formationProblems } from './formation.mjs';
import { parseStrict, digestBytes } from './canonical-json.mjs';
import { validate } from './schema.mjs';
import { ASSIGNMENT, CONTRACT, EVIDENCE_PACKAGE, checkContractRelations } from '../schema/objects.mjs';
import { fail } from './codes.mjs';

// A durable object goes in as bytes and comes out only through here. `verify`
// first, then the schema, then the value: a consumer that acts on an object whose
// byte identity does not verify is AC-3's falsifier, and the way to make that
// impossible is to have no other way to obtain the object.
function openObject(bytes, identity, schema, what) {
  verify(bytes, identity);
  const value = parseStrict(Buffer.from(bytes, 'utf8'));
  const problems = validate(schema, value);
  if (problems.length > 0) {
    fail('format_open', `the ${what} does not match its closed shape`, { problems });
  }
  return value;
}

// Origin is stamped here and nowhere else. It is not a brand — a brand travels
// with a value a caller already holds. This is a property the caller never gets
// to set, because the only writer of these records is below.
const HOST = 'host';
const HARNESS = 'harness';

export class Kernel {
  // Private. A public `ledger` let anything holding a Kernel append a record
  // without passing the operation that guards it — `gate_result: passed` and
  // `human_signoff` included. Being the only writer is not a property if the
  // writer is reachable around the front door.
  #ledger;

  // Where completion is written. Held by the Kernel rather than passed to the
  // write, because a caller that chooses the destination chooses what "the
  // completion" is.
  #completionRoot;

  constructor(logPath, { completionRoot } = {}) {
    this.#ledger = new Ledger(logPath);
    this.#completionRoot = completionRoot || null;
  }

  // --- reads -------------------------------------------------------------

  records() { return this.#ledger.read(); }

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
    // One kind per operation shape. The single `human_decision` shape carried
    // every operation's fields as optional, so it admitted an activation with a
    // choice and an unavailable decision with none. Two branches rather than a
    // computed kind, so each is a real call site the kind audit can see.
    if (operation === 'activation') {
      return this.#ledger.append({
        kind: 'human_decision_activation', operation, actor, lineage, origin: HOST, ...payload,
      });
    }
    return this.#ledger.append({
      kind: 'human_decision_choice', operation, actor, lineage, origin: HOST, ...payload,
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
    return this.#ledger.append({
      kind: 'command_result', id, lineage, run, attempt, command, exit,
      raw, subjects, inputs_used: inputsUsed, origin: HARNESS,
    });
  }

  // The package is the producer's account of what it produced, so its author is
  // checked against the mutation grant. It arrives as bytes and carries its own
  // identity, like the other three durable objects.
  recordPackage({ lineage, run, bytes, identity, submitter }) {
    const pkg = openObject(bytes, identity, EVIDENCE_PACKAGE, 'Evidence Package');
    const assignment = this.assignmentFor(lineage, run);
    if (!assignment) {
      fail('assignment_not_issued', 'no Assignment was issued for this run', { lineage, run });
    }
    if (submitter !== pkg.producer) {
      fail('identity_self_asserted', 'the submitter is not the producer it names', {
        submitter, producer: pkg.producer,
      });
    }
    if (assignment.grants.mutation_producer !== pkg.producer) {
      fail('mutation_producer_ungranted', 'changes submitted under an ungranted producer', {
        producer: pkg.producer,
      });
    }
    return this.#ledger.append({
      kind: 'evidence_package', id: pkg.id, lineage, run, bytes, identity,
    });
  }

  // A material input's identity as the Harness finds it now. Staleness compares
  // this against what the package recorded. It used to be a callback the caller
  // passed to the Gate, so the party being judged decided whether its own
  // evidence was still current.
  observeInput({ lineage, id, identity }) {
    return this.#ledger.append({
      kind: 'input_observed', lineage, id, identity, origin: HARNESS,
    });
  }

  inputGone({ lineage, id }) {
    return this.#ledger.append({ kind: 'input_gone', lineage, id, origin: HARNESS });
  }

  // The latest observation wins. `null` means the Harness looked and it was gone,
  // which is different from never having looked — a never-observed input has no
  // record at all, and the resolver says so by returning `undefined`.
  inputsNowFor(lineage) {
    const records = this.records().filter(
      (r) => (r.kind === 'input_observed' || r.kind === 'input_gone') && r.lineage === lineage,
    );
    return (id) => {
      for (let i = records.length - 1; i >= 0; i -= 1) {
        if (records[i].id !== id) continue;
        return records[i].kind === 'input_gone' ? null : records[i].identity;
      }
      return undefined;
    };
  }

  recordArtifact({ id, lineage, run, artifactKind, identity }) {
    return this.#ledger.append({
      kind: 'artifact_recorded', id, lineage, run, artifact_kind: artifactKind, identity,
    });
  }

  // --- the guarded operations --------------------------------------------

  // Approval fixes which bytes are judged, so it is where the Contract is
  // actually checked. An earlier version compared one digest and appended: a
  // schema-invalid Contract, or one whose obligations named no observation, was
  // approved and only failed later, somewhere else, as something else.
  //
  // `rendered` is the bytes the host displayed, not a digest of them. A digest a
  // caller computes is a claim about a rendering nobody else saw; the bytes can
  // be re-rendered and compared.
  approve({ lineage, revision, bytes, identity, predecessor, actor, rendered, render }) {
    const contract = openObject(bytes, identity, CONTRACT, 'Contract');
    if (contract.lineage !== lineage || contract.revision !== revision) {
      fail('identity_mismatch', 'the Contract names another lineage or revision', {
        lineage, revision, named: { lineage: contract.lineage, revision: contract.revision },
      });
    }
    const relations = checkContractRelations(contract);
    if (relations.length > 0) {
      fail('format_open', 'the Contract is schema-valid but incoherent', { problems: relations });
    }
    // AC-6, on the path rather than beside it. These checks existed and nothing
    // called them, so a Contract whose statements cited nothing was approved and
    // the citation check was something a test ran on a fixture.
    const formation = formationProblems(contract);
    if (formation.length > 0) {
      fail(formation[0].code, 'the Contract does not trace to its sources', {
        problems: formation,
      });
    }

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
      if (contract.predecessor !== last.identity.byte_sha256) {
        fail('lineage_predecessor_wrong', 'the Contract names another predecessor', { lineage });
      }
    }

    // What was shown must be what these bytes render to. Both halves are computed
    // here; neither is accepted.
    if (typeof rendered !== 'string' || rendered.length === 0) {
      fail('human_input_absent', 'approval must record what was shown', { lineage });
    }
    if (typeof render === 'function') {
      const expected = render(bytes);
      if (digestBytes(Buffer.from(expected, 'utf8')) !== digestBytes(Buffer.from(rendered, 'utf8'))) {
        fail('identity_mismatch', 'the recorded rendering is not what those bytes render to', {
          lineage,
        });
      }
    }
    const view = {
      renders_sha256: identity.byte_sha256,
      rendering_sha256: digestBytes(Buffer.from(rendered, 'utf8')),
    };

    const decision = this.collectHumanInput({
      operation: 'activation', actor, lineage, revision, view,
    });
    // Genesis and revision are separate shapes, so the key is absent rather than
    // present-and-undefined. `undefined` is still an own property, and a closed
    // schema counts it as one — which is the honest behaviour: "absent" cannot be
    // spelled as a value.
    const base = { lineage, revision, identity, bytes, decision: decision.seq };
    return this.#ledger.append(
      prior.length === 0
        ? { kind: 'contract_approved_genesis', ...base }
        : { kind: 'contract_approved_revision', ...base, predecessor },
    );
  }

  // The approved Contract, from the approved bytes. The Gate took this as an
  // argument, so the party being judged chose the obligations it would be judged
  // against — fewer of them, or `independence.required: none`.
  contractFor(lineage) {
    const prior = this.approvals().filter((a) => a.lineage === lineage);
    if (prior.length === 0) return null;
    const latest = prior[prior.length - 1];
    return {
      contract: openObject(latest.bytes, latest.identity, CONTRACT, 'Contract'),
      identity: latest.identity,
      revision: latest.revision,
    };
  }

  // The Assignment is issued by the Human Owner, bound to an approved revision,
  // and the party it grants may not issue it. A producer minting one that grants
  // itself what it wants is the regress this ends.
  //
  // It arrives as bytes. Its boundary and its grants live in those bytes and
  // nowhere else, so there is no second place for them to differ, and it has an
  // identity of its own as AC-3 requires of all four objects.
  issueAssignment({ lineage, run, bytes, identity, actor }) {
    const assignment = openObject(bytes, identity, ASSIGNMENT, 'Assignment');
    if (assignment.lineage !== lineage) {
      fail('identity_mismatch', 'the Assignment names another lineage', { lineage });
    }
    const granted = [assignment.grants.attempt_producer, assignment.grants.mutation_producer];
    if (granted.includes(actor)) {
      fail('assignment_self_issued', 'the party an Assignment grants may not issue it', {
        id: assignment.id,
      });
    }
    const current = this.currentRevision(lineage);
    if (current !== assignment.contract_revision) {
      fail('assignment_not_issued', 'an Assignment must bind the current approved revision', {
        id: assignment.id, contractRevision: assignment.contract_revision, current,
      });
    }
    const { contract } = this.contractFor(lineage);
    for (const obligation of assignment.grants.obligations) {
      if (!contract.obligations.includes(obligation)) {
        fail('authority_not_granted', 'an Assignment may not grant an obligation the Contract does not state', {
          obligation,
        });
      }
    }
    // One per run, not one per lineage. A lineage outlives its runs, and refusing
    // a second run's Assignment made retry impossible.
    const existing = this.records().filter(
      (r) => r.kind === 'assignment_issued' && r.lineage === lineage && r.run === run,
    );
    if (existing.length > 0) {
      fail('assignment_not_unique', 'a run holds exactly one Assignment', { id: assignment.id });
    }
    this.collectHumanInput({
      operation: 'assignment_issuance', actor, lineage, choice: 'issue',
    });
    return this.#ledger.append({
      kind: 'assignment_issued', lineage, run, id: assignment.id,
      contract_revision: assignment.contract_revision, actor, bytes, identity, origin: HOST,
    });
  }

  // The run's Assignment, from the issued bytes. Taking it as an argument let a
  // caller keep the issued id and widen the boundary.
  assignmentFor(lineage, run) {
    const issued = this.records().find(
      (r) => r.kind === 'assignment_issued' && r.lineage === lineage && r.run === run,
    );
    if (!issued) return null;
    return openObject(issued.bytes, issued.identity, ASSIGNMENT, 'Assignment');
  }

  // An attempt may be opened only by the producer the Assignment names, for the
  // obligations it grants, and the record of who opened it is written here rather
  // than claimed by the opener.
  openAttempt({ lineage, run, producer, obligations, submitter }) {
    if (submitter !== producer) {
      fail('identity_self_asserted', 'the submitter is not the producer it names', {
        submitter, producer,
      });
    }
    const assignment = this.assignmentFor(lineage, run);
    if (!assignment) {
      fail('assignment_not_issued', 'no Assignment was issued for this run', { lineage, run });
    }
    if (assignment.grants.attempt_producer !== producer) {
      fail('attempt_not_granted', 'only the granted producer may open an attempt', { producer });
    }
    // The grant names which obligations. Without this a producer granted one
    // obligation opened an attempt against another and the Gate never noticed,
    // because the check lived in a helper nothing called.
    for (const obligation of obligations) {
      if (!assignment.grants.obligations.includes(obligation)) {
        fail('authority_not_granted', 'the Assignment does not grant this obligation', {
          producer, obligation,
        });
      }
    }
    return this.#ledger.append({
      kind: 'attempt_opened', lineage, run, assignment: assignment.id,
      attempt: `${assignment.id}#${this.#ledger.seq}`, producer, obligations,
    });
  }

  // The dispatch carries what the Contract states, resolved here. `dispatchRecord`
  // builds it from the Contract and nothing else, which is AC-8's point: there is
  // no parameter through which an Assignment or a configuration could supply it.
  //
  // `substitutedFamily` and `answeredFamily` exist so a Harness can record that a
  // seat did in fact answer. They are not defaults — omitted, the keys are absent,
  // and their absence is what AC-8 checks.
  recordDispatch({ lineage, run, attempt, obligation, substitutedFamily, answeredFamily }) {
    const { contract } = this.contractFor(lineage);
    const built = dispatchRecord({ contract, lineage, run, attempt, obligation });
    return this.#ledger.append({
      ...built,
      requested: [...built.requested],
      ...(substitutedFamily ? { substituted_family: substitutedFamily } : {}),
      ...(answeredFamily ? { answered_family: answeredFamily } : {}),
    });
  }

  recordUnavailable({ lineage, run, obligation, attempt, requested }) {
    return this.#ledger.append({
      kind: 'capability_unavailable', lineage, run, obligation, attempt,
      requested, origin: HARNESS,
    });
  }

  recordDelivery({ lineage, to, carried, provenance }) {
    return this.#ledger.append({
      kind: 'delivery', lineage, to, carried, provenance, origin: HARNESS,
    });
  }

  // An observation names the runner's record; it does not carry one. The
  // separation is what stops a submission authoring its own raw result.
  //
  // Which Assignment and which revision it is bound to are resolved, not taken:
  // a submission that names them names the two things it is being judged against.
  submitObservation({ lineage, run, obligation, observation, attempt,
    producer, artifact, pkg, commandResult, submitter }) {
    if (submitter !== producer) {
      fail('identity_self_asserted', 'the submitter is not the producer it names', {
        submitter, producer,
      });
    }
    const assignment = this.assignmentFor(lineage, run);
    if (!assignment) {
      fail('assignment_not_issued', 'no Assignment was issued for this run', { lineage, run });
    }
    if (assignment.grants.attempt_producer !== producer) {
      fail('authority_not_granted', 'only the granted producer may submit evidence', { producer });
    }
    if (!assignment.grants.obligations.includes(obligation)) {
      fail('authority_not_granted', 'the Assignment does not grant this obligation', {
        producer, obligation,
      });
    }
    // No outcome parameter. What the run produced is in the runner's record; the
    // observation says which obligation it answers and which evidence it points
    // at, and stops there.
    return this.#ledger.append({
      kind: 'observation', lineage, run, obligation, observation, attempt,
      contract_revision: assignment.contract_revision, assignment: assignment.id,
      producer, artifact, package: pkg, command_result: commandResult,
    });
  }

  signOff({ lineage, run, contractRevision, deliverable, actor, acceptedReview }) {
    return this.#ledger.append({
      kind: 'human_signoff', lineage, run, contract_revision: contractRevision,
      deliverable, actor, origin: HOST,
      ...(acceptedReview ? { accepted_review: acceptedReview } : {}),
    });
  }

  // Private. A public one appended `completion_committed` without the write ever
  // happening, which is a record of a completion that does not exist.
  #recordCompletion({ lineage, run, acceptance, path }) {
    return this.#ledger.append({
      kind: 'completion_committed', lineage, run, acceptance, path,
    });
  }

  recordRun({ lineage, run, formationElapsed, changeElapsed, traceOutcome, wentWrong }) {
    return this.#ledger.append({
      kind: 'run_record', lineage, run,
      formation_elapsed: formationElapsed, change_elapsed: changeElapsed,
      trace_outcome: traceOutcome, went_wrong: wentWrong,
    });
  }

  // The index resolves from the log and takes nothing from a caller. An earlier
  // version accepted `index` and `inputsNow` as parameters, which let the party
  // being judged supply the evidence universe — packages and command results that
  // had never been recorded resolved fine and produced `passed`.
  // Scoped to one run. Unscoped, evidence recorded for `run1` resolved while
  // completing `run2`: every reference still pointed at a real record, and no
  // check asked whether it belonged to this execution.
  index({ lineage, run }) {
    const records = this.records().filter((r) => r.lineage === lineage && r.run === run);
    const findBy = (kind, field) => (value) => records.find(
      (r) => r.kind === kind && r[field] === value,
    ) || null;
    const packageRecord = findBy('evidence_package', 'id');
    return {
      commandResult: findBy('command_result', 'id'),
      attempt: findBy('attempt_opened', 'attempt'),
      artifact: findBy('artifact_recorded', 'id'),
      // Parsed through `verify`, so a consumer cannot reach a package whose byte
      // identity does not check out.
      dispatch: (attempt, obligation) => records.find(
        (r) => r.kind === 'dispatch_attempt' && r.attempt === attempt
          && r.obligation === obligation,
      ) || null,
      package: (id) => {
        const rec = packageRecord(id);
        if (!rec) return null;
        return openObject(rec.bytes, rec.identity, EVIDENCE_PACKAGE, 'Evidence Package');
      },
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
  outcomeReader({ lineage, run }) {
    const index = this.index({ lineage, run });
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

  // Two arguments, both names of things already recorded. The Contract, the
  // Assignment and the current identity of every material input used to come in
  // as parameters, so the party being judged supplied the standard, the authority
  // and the notion of "current" — three different ways to pass without changing
  // anything true.
  status({ lineage, run }) {
    const approved = this.contractFor(lineage);
    if (approved === null) {
      fail('assignment_not_issued', 'nothing is approved for this lineage', { lineage });
    }
    const { contract } = approved;
    const assignment = this.assignmentFor(lineage, run);
    if (!assignment) {
      fail('assignment_not_issued', 'no Assignment was issued for this run', { lineage, run });
    }
    const records = this.records();
    const index = this.index({ lineage, run });
    const inputsNow = this.inputsNowFor(lineage);
    const current = approved.revision;
    const admit = admissibility({
      contract, assignment, approvals: this.approvals(), index, inputsNow,
    });
    const result = reduceAll({
      records, lineage, run, obligations: contract.obligations, currentRevision: current,
      admit,
      inputsChanged: inputsChangedAgainst(index, inputsNow),
      outcomeOf: this.outcomeReader({ lineage, run }),
    });

    // The verdict is recorded, because completion relies on it and AC-13 says
    // everything either the Gate or the Human Owner relies on is recorded when it
    // happens. Without this, replay could reconstruct the inputs but not the
    // decision they produced — and "the Gate said passed" would be a claim with
    // nothing behind it.
    {
      for (const obligation of contract.obligations) {
        const v = result.byObligation[obligation];
        this.#ledger.append({
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
  complete({ lineage, run, actor, acceptedReview }) {
    const { contract, identity: contractIdentity, revision: current } = this.contractFor(lineage);
    const { byObligation, allPassed } = this.status({ lineage, run });
    if (!allPassed) {
      const first = contract.obligations.find((o) => byObligation[o].status !== 'passed');
      fail('not_all_passed', 'completion requires every obligation to be passed', {
        obligation: first, status: byObligation[first].status,
      });
    }

    // The unavailable arm is checked here too: a Contract that declared
    // cross-family cannot complete while its dispatch guarantees are unmet.
    this.checkUnavailableArm({ contract, lineage });

    const required = contract.independence.required === 'cross_family_required';
    if (required && !acceptedReview) {
      fail('review_required_absent', 'the Contract required a review and none is carried', {});
    }

    // The deliverable is the artifact the evidence attests to, resolved from the
    // record. Taking it as an argument let an Acceptance name one thing while the
    // evidence had exercised another.
    const deliverable = this.deliverableFor({ lineage, run, contract });

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
      contract_identity: contractIdentity,
      deliverable,
      decision: { outcome: 'accepted', origin: HOST, run, seq: signoff.seq },
      review: required
        ? { required: true, accepted_review: acceptedReview }
        : { required: false, statement: 'no independent review required by this Contract' },
    };

    // The write is the last step of this method, not a function a caller invokes
    // afterwards with whatever it likes. Its destination belongs to the Kernel,
    // and the verdicts it reads are the ones just recorded.
    if (!this.#completionRoot) {
      fail('writer_not_sole', 'this Kernel has no completion root, so it cannot complete', {
        run,
      });
    }
    const written = commitCompletion({
      root: this.#completionRoot,
      path: `${this.#completionRoot}/${lineage}.${run}.acceptance.json`,
      acceptance,
      recordedVerdicts: this.records().filter((r) => r.kind === 'gate_result'),
      obligations: contract.obligations,
      run,
      revision: current,
    });
    this.#recordCompletion({
      lineage, run, acceptance: digestBytes(Buffer.from(JSON.stringify(acceptance), 'utf8')),
      path: written.path,
    });
    return { acceptance, written };
  }

  // The artifact this run's evidence actually exercised. Every admissible
  // observation names one; they must agree, because two artifacts in one run
  // means the Acceptance would have to pick, and picking is not resolving.
  deliverableFor({ lineage, run, contract }) {
    const index = this.index({ lineage, run });
    const named = new Set();
    for (const obligation of contract.obligations) {
      for (const r of this.records()) {
        if (r.kind !== 'observation') continue;
        if (r.lineage !== lineage || r.run !== run || r.obligation !== obligation) continue;
        named.add(r.artifact);
      }
    }
    if (named.size !== 1) {
      fail('binding_cross_execution', 'the run does not name exactly one artifact', {
        run, artifacts: [...named],
      });
    }
    const record = index.artifact([...named][0]);
    if (!record) {
      fail('binding_unresolved', 'the artifact the evidence names is not recorded', { run });
    }
    return { kind: record.artifact_kind, identity: record.identity };
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
