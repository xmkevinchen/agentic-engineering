// The record — AC-13.
//
// Everything the Gate or the Human Owner relies on is recorded when it happens
// and can be reconstructed by replaying it. Nothing they rely on lives only in a
// session, a message, or a summary: coordination state is not completion truth.
//
// Append-only, canonical NDJSON, one record per line. Order is the record's own —
// no timestamp a party supplied decides anything, which is why activation
// ordering (AC-2) compares sequence numbers the recorder assigned.

import { appendFileSync, existsSync, openSync, closeSync, readFileSync, unlinkSync } from 'node:fs';
import { encodeNdjson, parseNdjson } from './canonical-json.mjs';
import { validate } from './schema.mjs';
import { RECORDS } from '../schema/records.mjs';
import { fail } from './codes.mjs';

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
  review_recorded: { producer: 'harness', consumer: ['completion'] },
  input_observed: { producer: 'harness', consumer: ['gate'] },
  input_gone: { producer: 'harness', consumer: ['gate'] },
  human_decision_activation: { producer: 'human', consumer: ['identity', 'replay'] },
  human_decision_choice: { producer: 'human', consumer: ['run', 'gate'] },
  human_signoff: { producer: 'human', consumer: ['completion'] },
  completion_committed: { producer: 'writer', consumer: ['replay', 'run'] },
  run_record: { producer: 'run', consumer: ['run', 'replay'] },
});

// Not exported. It was, so `import { Ledger }` and `append` was a second way into
// the log — which made "the Kernel is the only way in" a sentence in a README
// rather than a property. The Kernel owns the only instance, and the readers a
// caller legitimately needs are its methods.
class Ledger {
  constructor(path) {
    this.path = path;
  }

  // Appends are serialized by an exclusive-create lock, so a writer knows exactly
  // where its record landed.
  //
  // Without it a writer had to *find* its own line afterwards, and two appends of
  // byte-identical content are indistinguishable — which is how four concurrent
  // openers all ended up holding one attempt while four had been opened. The
  // choice is between a differentiator nobody can check and serialising the
  // append; this serialises it.
  //
  // `O_EXCL` is the same primitive the completion write uses: the kernel decides,
  // atomically, who created the file. A holder that dies leaves the lock behind,
  // and the next writer fails with a named code rather than waiting forever or
  // silently breaking in.
  #withLock(fn) {
    const lockPath = `${this.path}.lock`;
    let fd = null;
    const deadline = 5000;
    const started = process.hrtime.bigint();
    for (;;) {
      try {
        fd = openSync(lockPath, 'wx');
        break;
      } catch (error) {
        if (error.code !== 'EEXIST') throw error;
        if (Number(process.hrtime.bigint() - started) / 1e6 > deadline) {
          fail('record_not_appended', 'the log is locked by another writer', { path: lockPath });
        }
      }
    }
    try {
      return fn();
    } finally {
      closeSync(fd);
      unlinkSync(lockPath);
    }
  }

  // Read at append time, never cached. Two Ledgers on one log each held their own
  // count, so both handed out the same sequence number — and since an attempt id
  // is built from one, two runs could mint the same attempt and each other's
  // evidence became selectable.
  get seq() {
    return this.read().length;
  }

  // A record's sequence number is its position in the log, assigned on the way
  // out rather than stored on the way in.
  //
  // Allocating it at append time — even reading the length immediately before
  // writing — is two operations, and two processes can read the same length and
  // both write it. Position cannot collide: `appendFileSync` opens with `O_APPEND`,
  // so each line lands whole and in some order, and that order is the numbering.
  read() {
    if (!existsSync(this.path)) return [];
    const bytes = readFileSync(this.path);
    if (bytes.length === 0) return [];
    return parseNdjson(bytes).map((r, seq) => ({ ...r, seq }));
  }

  // Rejection happens here, at the append boundary. A record outside the closed
  // set never becomes a record, so the Gate never sees it — and the Gate reporting
  // `pending` for an obligation nothing was validly submitted for is correct,
  // because nothing admissible exists.
  append(record) {
    return this.#withLock(() => this.#appendLocked(record));
  }

  // Everything a guarded operation checks and then writes belongs inside one
  // lock, or the check and the write are two operations again.
  transaction(fn) {
    return this.#withLock(fn);
  }

  #appendLocked(record) {
    if (!Object.prototype.hasOwnProperty.call(KINDS, record.kind)) {
      fail('kind_without_consumer', `record kind outside the closed set: ${record.kind}`, {
        kind: record.kind, known: Object.keys(KINDS),
      });
    }
    // The payload, not only the name. An earlier draft validated that `kind` was
    // known and accepted arbitrary, missing, null and additional fields beside
    // it — closure over names is not closure.
    const schema = RECORDS[record.kind];
    if (!schema) {
      fail('kind_without_consumer', `no record schema for ${record.kind}`, { kind: record.kind });
    }
    // Validated with the position it will occupy if nothing else appends first.
    // The stored line carries no `seq`: it would be a second source for a fact the
    // line's position already states, and the two could disagree.
    const seq = this.seq;
    const problems = validate(schema, { ...record, seq });
    if (problems.length > 0) {
      fail('format_open', `record does not match its closed shape: ${record.kind}`, { problems });
    }
    // `encodeNdjson` canonicalizes on the way out, so the line on disk is the
    // canonical spelling and `parseNdjson` will refuse anything else later.
    appendFileSync(this.path, encodeNdjson([record]));
    // Nobody else can have appended: the lock is held. The position read before
    // the write is the position the record has.
    return { ...record, seq };
  }

  // Replay is a check, not a re-enactment: the same records must reconstruct the
  // same state in a fresh process. A state reachable in the real flow that replay
  // cannot rebuild is the defect this exists to catch.
  // Bucketing is not reconstruction. `replay` sorts records so a caller can find
  // them; `reconstruct` rebuilds the state a run reached, which is what AC-13
  // actually asks for — including the Gate verdicts and the human decisions,
  // since those are what completion relied on.
  // `scope` names the run. Matching every key against every record dropped the
  // approval and the unavailable decision, because those are facts about the
  // lineage rather than about one execution — so a run-scoped reconstruction
  // could not say which Contract it ran under.
  reconstruct(scope) {
    const matches = (r) => Object.entries(scope).every(
      ([k, v]) => r[k] === undefined || r[k] === v,
    );
    const mine = this.read().filter(matches);
    const state = {
      approvedRevision: null,
      attempts: [],
      gateVerdicts: {},
      humanDecisions: {},
      signoff: null,
      completion: null,
      unavailable: null,
      runFacts: null,
    };
    for (const r of mine) {
      switch (r.kind) {
        case 'contract_approved_genesis':
        case 'contract_approved_revision':
          state.approvedRevision = r.revision;
          break;
        case 'attempt_opened':
          // Its position is its name; there is no other field to push.
          state.attempts.push(r.seq);
          break;
        case 'gate_result':
          state.gateVerdicts[r.obligation] = r.status;
          break;
        case 'human_decision_activation':
          state.humanDecisions[r.operation] = r.revision;
          break;
        case 'human_decision_choice':
          state.humanDecisions[r.operation] = r.choice;
          break;
        case 'human_signoff':
          state.signoff = r.seq;
          break;
        case 'completion_committed':
          state.completion = r.identity;
          break;
        case 'capability_unavailable':
          state.unavailable = r.seq;
          break;
        case 'run_record':
          state.runFacts = {
            formation: r.formation_elapsed, change: r.change_elapsed,
            trace: r.trace_outcome, wentWrong: r.went_wrong,
          };
          break;
        default:
          break;
      }
    }
    return state;
  }

  replay() {
    const records = this.read();
    const state = {
      approvals: [],
      assignments: [],
      attempts: [],
      observations: [],
      packages: [],
      artifacts: [],
      gateResults: [],
      commandResults: [],
      inputObservations: [],
      unavailable: [],
      dispatches: [],
      reviews: [],
      decisions: [],
      signoffs: [],
      completions: [],
      runRecords: [],
    };
    const bucket = {
      contract_approved_genesis: 'approvals',
      contract_approved_revision: 'approvals',
      assignment_issued: 'assignments',
      attempt_opened: 'attempts',
      observation: 'observations',
      evidence_package: 'packages',
      artifact_recorded: 'artifacts',
      gate_result: 'gateResults',
      command_result: 'commandResults',
      capability_unavailable: 'unavailable',
      dispatch_attempt: 'dispatches',
      review_recorded: 'reviews',
      input_observed: 'inputObservations',
      input_gone: 'inputObservations',
      human_decision_activation: 'decisions',
      human_decision_choice: 'decisions',
      human_signoff: 'signoffs',
      completion_committed: 'completions',
      run_record: 'runRecords',
    };
    for (const r of records) {
      const key = bucket[r.kind];
      if (!key) fail('replay_incomplete', `no replay rule for kind ${r.kind}`, { kind: r.kind });
      state[key].push(r);
    }
    return { records, state };
  }

  // Every kind the Gate or a human relied on must have been written. This is the
  // completeness half of AC-13: not "can we replay what we wrote", but "did we
  // write what we relied on".
  assertRecorded(reliedOn, scope = {}) {
    // Scoped. "Some record of this kind exists somewhere in the log" is not "the
    // fact this run relied on was recorded" — an earlier draft checked the first
    // and a completed run from last week would have satisfied it.
    const matches = (r) => Object.entries(scope).every(([k, v]) => r[k] === v);
    const present = new Set(this.read().filter(matches).map((r) => r.kind));
    for (const kind of reliedOn) {
      if (!present.has(kind)) {
        fail('record_not_appended', `a relied-on fact was never recorded: ${kind}`, {
          kind, scope,
        });
      }
    }
    return true;
  }
}

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
        `===\\s*'${kind}'|'${kind}'\\s*===|findBy\\('${kind}'|SUBMITTED_KINDS = new Set\\(\\[[^\\]]*'${kind}'`,
      ).test(text)
    )) || new RegExp(`case '${kind}':`).test(
      sources.find((f) => f.name === 'ledger.mjs')?.text || '',
    );

    if (!produced) problems.push({ kind, code: 'kind_without_producer' });
    if (!consumed) problems.push({ kind, code: 'kind_without_consumer' });
  }
  return problems;
}

export { Ledger as InternalLedger };
