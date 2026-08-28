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


// Kinds this slice writes and reads. Each must have a real Phase 1 producer and a
// real Phase 1 consumer: a kind frozen for a future slice fails AC-12 as surely as a missing
// one.
//
// The entries were `{ producer, consumer }` labels, and nothing read them — the
// audit uses the keys and looks for real call sites, so the labels could drift to
// anything without failing. A set of names says what the set is; the audit says
// whether each is reached.
export const KINDS = Object.freeze({
  contract_approved_genesis: true,
  contract_approved_revision: true,
  assignment_issued: true,
  attempt_opened: true,
  command_result: true,
  observation: true,
  evidence_package: true,
  artifact_recorded: true,
  gate_result: true,
  gate_completed: true,
  capability_unavailable: true,
  dispatch_attempt: true,
  input_observed: true,
  input_gone: true,
  human_decision_activation: true,
  human_decision_choice: true,
  human_decision_unavailable: true,
  human_decision_judgement: true,
  human_signoff: true,
  completion_committed: true,
  review: true,
  formation_opened: true,
  run_record_clean: true,
  run_record_caught: true,
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
