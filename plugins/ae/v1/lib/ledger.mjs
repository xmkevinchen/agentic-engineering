// The closed set of record kinds, and the audit that keeps it honest — AC-12.
//
// The log itself lives in `kernel.mjs`. It was here, exported as `InternalLedger`
// so the Kernel could reach it, and "internal" is a name rather than a boundary:
// any code could import it and append a `command_result` with `origin: harness`,
// which is exactly the forgery §4 does not concede. A class no other module can
// name is the only version of "the Kernel is the only way in" that is true.
//
// The original header, which still describes the log:
//
// The record — AC-13.
//
// Everything the Gate or the Human Owner relies on is recorded when it happens
// and can be reconstructed by replaying it. Nothing they rely on lives only in a
// session, a message, or a summary: coordination state is not completion truth.
//
// Append-only, canonical NDJSON, one record per line. Order is the record's own —
// no timestamp a party supplied decides anything, which is why activation
// ordering (AC-2) compares sequence numbers the recorder assigned.


// Kinds this slice writes and reads. Each must have a real V1 producer and a real
// V1 consumer: a kind frozen for a future slice fails AC-12 as surely as a missing
// one. The consumer column is what makes that checkable rather than asserted.
export const KINDS = Object.freeze({
  contract_approved_genesis: { producer: 'activation', consumer: ['gate', 'identity'] },
  contract_approved_revision: { producer: 'activation', consumer: ['gate', 'identity'] },
  assignment_issued: { producer: 'human', consumer: ['authority', 'admissibility'] },
  attempt_opened: { producer: 'implementer', consumer: ['gate'] },
  command_result: { producer: 'harness', consumer: ['admissibility', 'gate'] },
  observation: { producer: 'implementer', consumer: ['gate'] },
  evidence_package: { producer: 'implementer', consumer: ['admissibility'] },
  artifact_recorded: { producer: 'implementer', consumer: ['admissibility'] },
  gate_result: { producer: 'gate', consumer: ['completion', 'replay'] },
  capability_unavailable: { producer: 'harness', consumer: ['gate'] },
  dispatch_attempt: { producer: 'harness', consumer: ['family', 'gate'] },
  input_observed: { producer: 'harness', consumer: ['gate'] },
  input_gone: { producer: 'harness', consumer: ['gate'] },
  human_decision_activation: { producer: 'human', consumer: ['identity', 'replay'] },
  human_decision_choice: { producer: 'human', consumer: ['run', 'replay'] },
  human_decision_unavailable: { producer: 'human', consumer: ['run', 'gate'] },
  human_signoff: { producer: 'human', consumer: ['completion'] },
  completion_committed: { producer: 'writer', consumer: ['replay', 'run'] },
  run_record: { producer: 'run', consumer: ['run', 'replay'] },
});

// Every declared kind must be produced and consumed by real code, not by a
// hand-written label. An earlier draft checked that the metadata rows had
// non-empty strings in them, which is a check on the comment rather than on the
// program: several labels were simply wrong.
//
// The universe scanned is this directory — closed, small, and stated. It is not a
// reachability proof over the whole host, which is X4b and needs a closed
// universe v1 does not have.
export function auditKinds({ readdirSync, readFileSync, dir }) {
  const sources = readdirSync(dir)
    .filter((f) => f.endsWith('.mjs'))
    .map((f) => ({ name: f, text: readFileSync(`${dir}/${f}`, 'utf8') }));

  const problems = [];
  for (const kind of Object.keys(KINDS)) {
    // Produced: something appends it.
    const produced = sources.some(({ name, text }) => name !== 'ledger.mjs'
      && new RegExp(`kind:\\s*'${kind}'`).test(text));
    // Consumed: something reads it back — by a direct kind comparison, through a
    // named reader helper that takes the kind as an argument, through membership
    // of a set the reduction selects on, or through a reconstruction branch in
    // the ledger itself. Each form is spelled out rather than matched loosely: a
    // mention of the string is not a read of the kind.
    //
    // Three readers used to exist only so this audit would find a comparison —
    // `find`, `deliveriesTo`, `observationsFor`, none of them on any path. An
    // audit that can be satisfied by writing a function nobody calls measures the
    // spelling and not the program, so the forms below name real reading shapes
    // and the unused readers are gone.
    const consumed = sources.some(({ name, text }) => (
      name !== 'ledger.mjs' && new RegExp(
        `===\\s*'${kind}'|'${kind}'\\s*===|findBy\\('${kind}'`
        + `|SUBMITTED_KINDS = new Set\\(\\[[^\\]]*'${kind}'|case '${kind}':`,
      ).test(text)
    ));

    if (!produced) problems.push({ kind, code: 'kind_without_producer' });
    if (!consumed) problems.push({ kind, code: 'kind_without_consumer' });
  }
  return problems;
}
