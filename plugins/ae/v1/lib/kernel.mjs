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

  recordCommandResult({ lineage, run, attempt, command, raw, subjects, inputsUsed }) {
    return this.ledger.append({
      kind: 'command_result', lineage, run, attempt, command,
      raw, subjects, inputs_used: inputsUsed || [], origin: HARNESS,
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
  openAttempt({ lineage, assignment, producer, obligations, submitter }) {
    if (submitter !== producer) {
      fail('identity_self_asserted', 'the submitter is not the producer it names', {
        submitter, producer,
      });
    }
    if (assignment.grants.attempt_producer !== producer) {
      fail('attempt_not_granted', 'only the granted producer may open an attempt', { producer });
    }
    return this.ledger.append({
      kind: 'attempt_opened', lineage, assignment: assignment.id,
      attempt: `${assignment.id}#${this.ledger.seq}`, producer, obligations,
    });
  }

  // --- the reduction ------------------------------------------------------
  //
  // No optional admissibility. The Gate always runs the full check, because a
  // check a caller may omit is a check that does not exist.

  status({ contract, lineage, assignment, index, inputsNow }) {
    const records = this.records();
    const current = this.currentRevision(lineage);
    if (current === null) {
      fail('assignment_not_issued', 'nothing is approved for this lineage', { lineage });
    }
    const admit = admissibility({
      contract, assignment, approvals: this.approvals(), index, inputsNow,
    });
    return reduceAll({
      records, lineage, obligations: contract.obligations, currentRevision: current,
      admit, inputsChanged: inputsChangedAgainst(index, inputsNow),
    });
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
