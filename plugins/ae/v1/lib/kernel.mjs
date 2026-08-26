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

import { resolve } from 'node:path';
import { Ledger } from './ledger.mjs';
import { reduceAll, STATUS } from './gate.mjs';
import { admissibility, inputsChangedAgainst } from './admissibility.mjs';
import { currentRevision as deriveCurrent, identify, verify } from './identity.mjs';
import { dispatchRecord } from './family.mjs';
import { assertInsideLocation, assertNoSymlinkComponents } from './write-path.mjs';
import { atomicFileNoReplace } from './fs-noreplace.mjs';
import { checkVerifiableSources, formationProblems } from './formation.mjs';
import { parseStrict, digestBytes } from './canonical-json.mjs';
import { validate } from './schema.mjs';
import {
  ACCEPTANCE, ASSIGNMENT, CONTRACT, EVIDENCE_PACKAGE, checkContractRelations,
} from '../schema/objects.mjs';
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

  // Where cited sources are resolved from. Approval checks the digest a Contract
  // records for each cited file against the file itself, so a citation to
  // something that has since changed is a citation to something else.
  #sourceRoot;

  // How the Contract is rendered for a human to read. Configured here, not passed
  // to `approve`: a renderer supplied by the party presenting the view is that
  // party judging its own presentation, and `render: () => rendered` approved
  // anything at all.
  #render;

  constructor(logPath, { completionRoot, sourceRoot, render } = {}) {
    this.#ledger = new Ledger(logPath);
    this.#completionRoot = completionRoot || null;
    this.#sourceRoot = sourceRoot || null;
    this.#render = typeof render === 'function' ? render : null;
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

  // --- host-collected inputs ---------------------------------------------
  //
  // The trust root, as a write path. `collectHumanInput` is the only producer of
  // a record with `origin: host`, and it is a method rather than a free function
  // so that holding one requires having gone through the Kernel.

  // Private. It was public, so `decideUnavailable`'s ordering check could be
  // walked around entirely: calling this with `operation: 'unavailable_decision'`
  // appended a valid choice before anything had been found unavailable. Being
  // the only stamper is not a property if the stamper is reachable directly.
  #collectHumanInput({ operation, actor, lineage, ...payload }) {
    // No guard against a caller-supplied origin here. Every call site is inside
    // this class and none passes one; the property that matters is that no public
    // method takes an origin at all, which `auditOriginSurface` reads off the
    // source. A guard nothing can trip is a claim with nothing behind it.
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

  recordCommandResult({
    id, lineage, run, attempt, command, artifact, exit, raw, subjects, inputsUsed,
  }) {
    // `inputsUsed` is not defaulted. An omitted argument became `[]`, which reads
    // as "used nothing" and made the later completeness check unreachable — the
    // vacuity the check exists to refuse, introduced by the channel that was
    // supposed to close it.
    if (!Array.isArray(inputsUsed)) {
      fail('material_input_incomplete', 'the runner must report which inputs it used', { id });
    }
    return this.#ledger.append({
      kind: 'command_result', id, lineage, run, attempt, command, artifact, exit,
      raw, subjects, inputs_used: inputsUsed, origin: HARNESS,
    });
  }

  // The package is the producer's account of what it produced, so its author is
  // checked against the mutation grant. It arrives as bytes and carries its own
  // identity, like the other three durable objects.
  recordPackage({ lineage, run, bytes, identity, submitter }) {
    const pkg = openObject(bytes, identity, EVIDENCE_PACKAGE, 'Evidence Package');
    // Its own bytes must name the lineage it is filed under. Only the envelope
    // was checked, so a package whose bytes named another lineage was recorded
    // and admitted here whenever the other identifiers happened to match.
    if (pkg.lineage !== lineage) {
      fail('binding_cross_execution', 'the package names another lineage', {
        lineage, named: pkg.lineage,
      });
    }
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

  // On the Harness surface, like the command result. It was the only evidential
  // record with no origin at all, which left the party being judged writing what
  // it had produced — and the Acceptance names that identity as the deliverable.
  recordArtifact({ id, lineage, run, artifactKind, identity }) {
    return this.#ledger.append({
      kind: 'artifact_recorded', id, lineage, run, artifact_kind: artifactKind, identity,
      origin: HARNESS,
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
  approve({ lineage, revision, bytes, identity, predecessor, actor, rendered }) {
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
    // And the cited files must still be what was cited. Checking the ids without
    // checking the digests establishes that a citation is well-formed, not that
    // it points at the content it claims.
    //
    // Not conditional on the caller having supplied a root: every Contract cites
    // at least one verifiable source, so a Kernel that cannot resolve them cannot
    // approve. Running the check only when a root happened to be configured is
    // the optional check this whole slice exists to stop having.
    if (!this.#sourceRoot) {
      fail('citation_unknown', 'this Kernel cannot resolve cited sources, so it cannot approve', {
        lineage,
      });
    }
    const stale = checkVerifiableSources(
      contract.provenance, (source) => `${this.#sourceRoot}/${source}`,
    );
    if (stale.length > 0) {
      fail('citation_unknown', 'a cited source does not resolve, or has changed', {
        problems: stale,
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
    // The Kernel's renderer, not one the approval supplied. AC-6 asks for a
    // derivation that is checkable; a caller passing both the rendering and the
    // function that judges it makes the check answer to itself.
    if (!this.#render) {
      fail('human_input_absent', 'this Kernel has no renderer, so it cannot approve', { lineage });
    }
    const expected = this.#render(bytes);
    if (digestBytes(Buffer.from(expected, 'utf8')) !== digestBytes(Buffer.from(rendered, 'utf8'))) {
      fail('identity_mismatch', 'the recorded rendering is not what those bytes render to', {
        lineage,
      });
    }
    const view = {
      renders_sha256: identity.byte_sha256,
      rendering_sha256: digestBytes(Buffer.from(rendered, 'utf8')),
    };

    // AC-5's table puts activation, sign-off and the unavailable decision in one
    // row: the Human Owner, and no model. The Contract names who that is, so
    // approval is the first place it can be checked — and a Contract approved by
    // someone it does not name is approved by nobody in particular.
    if (actor !== contract.final_signer) {
      fail('authority_not_granted', "only the Contract's final signer approves it", {
        actor, final_signer: contract.final_signer,
      });
    }

    const decision = this.#collectHumanInput({
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
    // Same reason as the Assignment: "no genesis yet" was checked and then written,
    // so two approvers could both open one. A lineage with two genesis records has
    // no single history to be current in.
    const genesis = prior.filter((a) => a.kind === 'contract_approved_genesis');
    if (genesis.length > 1) {
      fail('lineage_second_genesis', 'a lineage may open only one genesis', {
        lineage, count: genesis.length,
      });
    }
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
    // AC-5: issuing an Assignment at all is the Human Owner's, bound to an
    // approved revision. Any actor but the beneficiary was accepted, so a second
    // producer could hand the first its authority.
    const approvedContract = this.contractFor(lineage);
    if (approvedContract === null) {
      fail('assignment_not_issued', 'nothing is approved for this lineage', { lineage });
    }
    if (actor !== approvedContract.contract.final_signer) {
      fail('authority_not_granted', "only the Contract's final signer issues an Assignment", {
        actor, final_signer: approvedContract.contract.final_signer,
      });
    }
    const current = this.currentRevision(lineage);
    if (current !== assignment.contract_revision) {
      fail('assignment_not_issued', 'an Assignment must bind the current approved revision', {
        id: assignment.id, contractRevision: assignment.contract_revision, current,
      });
    }
    const { contract } = approvedContract;
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
    this.#collectHumanInput({
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
    const issued = this.records().filter(
      (r) => r.kind === 'assignment_issued' && r.lineage === lineage && r.run === run,
    );
    if (issued.length === 0) return null;
    // Uniqueness is enforced here, not only before the append. Checking the log
    // and then writing is two operations: two issuers both saw none and both
    // wrote one, and the run then had two — with the reader quietly taking the
    // first. A run that holds two Assignments holds no Assignment.
    if (issued.length > 1) {
      fail('assignment_not_unique', 'a run holds exactly one Assignment', {
        lineage, run, count: issued.length,
      });
    }
    return openObject(issued[0].bytes, issued[0].identity, ASSIGNMENT, 'Assignment');
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
    // No minted name. The attempt is identified by where its record landed, which
    // is a fact rather than a prediction: joining the Assignment id to the position
    // the log was about to reach let two writers predict the same one, and two
    // runs then shared an attempt.
    const opened = this.#ledger.append({
      kind: 'attempt_opened', lineage, run, assignment: assignment.id, producer, obligations,
    });
    // The latest attempt for this run, which is the one the Gate will select —
    // not "the record I just wrote".
    //
    // Two attempts opened at once by the same producer for the same obligations
    // are byte-identical records, so no writer can tell which line is its own.
    // That is not a gap to paper over: they are indistinguishable because there
    // is nothing to distinguish. What each opener needs is the attempt its
    // submissions must name, and an older one would simply never be selected.
    const mine = this.records().filter(
      (r) => r.kind === 'attempt_opened' && r.lineage === lineage && r.run === run,
    );
    return { ...opened, attempt: mine[mine.length - 1].seq };
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

  recordReview({ lineage, run, identity, family }) {
    return this.#ledger.append({
      kind: 'review_recorded', lineage, run, identity, family, origin: HARNESS,
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

  // AC-1 requires the sign-off to come after the Gate reported, and names a
  // pre-Gate sign-off as a case that must be rejected. It is refused here, where
  // a caller can actually attempt one: `complete` appends its own sign-off after
  // reducing, so a check downstream of that could never fail through it, and the
  // rejection AC-1 asks for was not being exercised at all.
  signOff({ lineage, run, contractRevision, deliverable, actor, acceptedReview }) {
    const reported = this.records().some(
      (r) => r.kind === 'gate_result' && r.lineage === lineage && r.run === run,
    );
    if (!reported) {
      fail('signoff_before_gate', 'the sign-off predates the Gate result', { lineage, run });
    }
    return this.#ledger.append({
      kind: 'human_signoff', lineage, run, contract_revision: contractRevision,
      deliverable, actor, origin: HOST,
      ...(acceptedReview ? { accepted_review: acceptedReview } : {}),
    });
  }

  // Private. A public one appended `completion_committed` without the write ever
  // happening, which is a record of a completion that does not exist.
  // Where a run's Acceptance goes. Named rather than inlined so the destination
  // can be checked without writing: the lineage and the run are the only two
  // things that shape it, and both come from records.
  completionPathFor({ lineage, run }) {
    if (!this.#completionRoot) {
      fail('writer_not_sole', 'this Kernel has no completion root, so it cannot complete', { run });
    }
    const path = `${this.#completionRoot}/${lineage}.${run}.acceptance.json`;
    assertNoSymlinkComponents(resolve(this.#completionRoot), resolve(path));
    assertInsideLocation(this.#completionRoot, resolve(path));
    return path;
  }

  #recordCompletion({ lineage, run, identity, path }) {
    return this.#ledger.append({
      kind: 'completion_committed', lineage, run, identity, path,
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
      attempt: findBy('attempt_opened', 'seq'),
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
    const result = this.#reduce({ lineage, run });
    const current = this.currentRevision(lineage);
    const { contract } = this.contractFor(lineage);

    // The verdict is recorded, because completion relies on it and AC-13 says
    // everything either the Gate or the Human Owner relies on is recorded when it
    // happens. Without this, replay could reconstruct the inputs but not the
    // decision they produced — and "the Gate said passed" would be a claim with
    // nothing behind it.
    for (const obligation of contract.obligations) {
      const v = result.byObligation[obligation];
      this.#ledger.append({
        kind: 'gate_result', lineage, run, contract_revision: current, obligation,
        status: v.status,
        ...(v.code ? { code: v.code } : {}),
        ...(v.attempt != null ? { attempt: v.attempt } : {}),
        ...(v.selected ? { selected: v.selected } : {}),
      });
    }
    return result;
  }

  #reduce({ lineage, run }) {
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
      contract, assignment, approvals: this.approvals(), index, inputsNow, run,
    });
    const result = reduceAll({
      records, lineage, run, obligations: contract.obligations, currentRevision: current,
      admit,
      inputsChanged: inputsChangedAgainst(index, inputsNow),
      outcomeOf: this.outcomeReader({ lineage, run }),
    });

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

    // The Contract names who signs. `actor` was whatever the caller wrote, so a
    // run could be signed off by a party the Contract never nominated.
    if (actor !== contract.final_signer) {
      fail('authority_not_granted', "only the Contract's final signer completes a run", {
        actor, final_signer: contract.final_signer,
      });
    }

    const required = contract.independence.required === 'cross_family_required';
    if (required) {
      if (!acceptedReview) {
        fail('review_required_absent', 'the Contract required a review and none is carried', {});
      }
      // And it must resolve. A digest the caller chose is a claim about a review
      // nobody else saw; this is the record it answers to.
      const recorded = this.records().find(
        (r) => r.kind === 'review_recorded' && r.lineage === lineage && r.run === run
          && r.identity === acceptedReview,
      );
      if (!recorded) {
        fail('review_required_absent', 'the review the Acceptance carries was never recorded', {
          acceptedReview,
        });
      }
    } else if (acceptedReview) {
      fail('review_required_absent', 'a review is carried where the Contract required none', {});
    }

    // The deliverable is the artifact the evidence attests to, resolved from the
    // record. Taking it as an argument let an Acceptance name one thing while the
    // evidence had exercised another.
    const deliverable = this.deliverableFor({ lineage, run, contract });

    const signoff = this.signOff({
      lineage, run, contractRevision: current,
      deliverable: deliverable.identity, actor, acceptedReview,
    });

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
    const written = this.#commitCompletion({
      acceptance, obligations: contract.obligations, run, revision: current,
    });
    // Two identities, like the other three durable objects. It used to record one
    // digest, which cannot tell a lexical mutation of the written file from the
    // same content spelled differently — the exact thing AC-3 keeps a pair for.
    this.#recordCompletion({
      lineage, run, identity: identify(written.bytes), path: written.path,
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

  // AC-7's choice, recorded when it is made. "After the capability was found
  // unavailable" is a property of the append — there is a record it must follow —
  // so it is checked here rather than at completion, where an unavailable run
  // never arrives: completion stops at `not_all_passed` first, which left the
  // ordering check sitting in a branch nothing could reach.
  decideUnavailable({ lineage, run, actor, choice }) {
    const approved = this.contractFor(lineage);
    if (approved === null) {
      fail('assignment_not_issued', 'nothing is approved for this lineage', { lineage });
    }
    if (actor !== approved.contract.final_signer) {
      fail('authority_not_granted', "only the Contract's final signer decides on an unavailable capability", {
        actor, final_signer: approved.contract.final_signer,
      });
    }
    if (!['wait', 'stop', 'amend'].includes(choice)) {
      fail('human_input_absent', 'the decision must be wait, stop, or amend', { choice });
    }
    const unavailable = this.records().find(
      (r) => r.kind === 'capability_unavailable' && r.lineage === lineage && r.run === run,
    );
    if (!unavailable) {
      // A pre-authorized choice is not a decision about something that had not
      // happened yet.
      fail('human_input_absent', 'nothing has been found unavailable in this run', {
        lineage, run,
      });
    }
    return this.#collectHumanInput({
      operation: 'unavailable_decision', actor, lineage, choice,
    });
  }



  // The completion write — AC-11. Private, and the last step of `complete`.
  //
  // It was an exported function taking a root, a path, an Acceptance and a verdict
  // array, which made it a second completion entry point however carefully the
  // Kernel called it: importing the module was enough to write an Acceptance with
  // no Gate, no sign-off and no record.
  // The reduction, run again over the log as it stands now — not a read of what
  // the last reduction recorded.
  //
  // Reading the recorded verdicts was the whole point missed: another writer can
  // open a newer attempt without reducing, so the newest `gate_result` still says
  // `passed` while the run is `pending`. A stale answer read twice is one answer.
  verdictsNow({ lineage, run }) {
    const { byObligation } = this.#reduce({ lineage, run });
    return new Map(Object.entries(byObligation).map(([o, v]) => [o, v.status]));
  }

  #commitCompletion({ acceptance, obligations, run, revision }) {
    const path = this.completionPathFor({ lineage: acceptance.lineage, run });

    // Re-derived here, not carried from the reduction above.
    //
    // This was deleted once as a duplicate of `complete`'s own check, and that
    // was wrong: several Kernels may share a log, and between the reduction and
    // this write another can open a newer attempt and reduce again, leaving the
    // run `pending` while an Acceptance says `accepted`. "The latest attempt
    // decides" is decided at the moment the bytes land.
    //
    // The suite cannot produce that interleave in one process — there is no seam
    // inside `complete` to schedule against, and adding one for a test would be
    // test-only machinery. `verdictsRecorded` is exercised directly instead, on a
    // log two Kernels advanced. Said plainly rather than left to look covered.
    const latest = this.verdictsNow({ lineage: acceptance.lineage, run });
    for (const obligation of obligations) {
      const status = latest.get(obligation);
      if (status === undefined) {
        fail('record_not_appended', 'no recorded verdict for an obligation', { obligation, run });
      }
      if (status !== 'passed') {
        fail('not_all_passed', 'the run stopped passing before the Acceptance landed', {
          obligation, status,
        });
      }
    }

    // The shape, checked against the schema rather than against truthiness — an
    // earlier version tested `if (!acceptance)` and wrote `{}`. This is the one
    // check left here: the verdict re-derivation that used to sit beside it read
    // the same records `complete` had just reduced, and no planted defect could
    // turn the copy red now that nothing else can call this.
    const problems = validate(ACCEPTANCE, acceptance);
    if (problems.length > 0) {
      fail('format_open', 'the Acceptance does not match its closed shape', { problems });
    }
    const bytes = Buffer.from(JSON.stringify(acceptance), 'utf8');

    // The destination was checked when it was derived; this is where it lands.
    const target = resolve(path);

    // What the preflight does not close: it walks the parents, then `O_EXCL` opens
    // the final component, and those are separate syscalls. A parent swapped for a
    // symlink between them redirects the write, and nothing here detects it. Closing
    // that needs directory handles held across both operations — `openat` relative
    // to a held fd — which Node does not expose.
    //
    // Under §2's boundary this is expected: swapping a parent mid-write requires
    // the same OS access that could edit the log directly. It is stated because the
    // preflight otherwise reads as a guarantee it is not.

    const result = atomicFileNoReplace({ path: target, bytes });
    if (result.outcome === 'exists') {
      fail('write_would_clobber', 'completion does not overwrite an existing target', { path: target });
    }
    // The resolved target, so what gets recorded is where the bytes actually went
    // rather than the path someone asked for.
    return { ...result, path: target, bytes: bytes.toString('utf8') };
  }

}

export { STATUS };
