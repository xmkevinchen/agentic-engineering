// The record — AC-13.
//
// Everything the Gate or the Human Owner relies on is recorded when it happens
// and can be reconstructed by replaying it. Nothing they rely on lives only in a
// session, a message, or a summary: coordination state is not completion truth.
//
// Append-only, canonical NDJSON, one record per line. Order is the record's own —
// no timestamp a party supplied decides anything, which is why activation
// ordering (AC-2) compares sequence numbers the recorder assigned.

import { appendFileSync, existsSync, readFileSync } from 'node:fs';
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
  delivery: { producer: 'harness', consumer: ['formation'] },
  human_decision: { producer: 'human', consumer: ['run', 'gate'] },
  human_signoff: { producer: 'human', consumer: ['completion'] },
  completion_committed: { producer: 'writer', consumer: ['replay', 'run'] },
  run_record: { producer: 'run', consumer: ['run', 'replay'] },
});

export class Ledger {
  constructor(path) {
    this.path = path;
    this.seq = this.read().length;
  }

  read() {
    if (!existsSync(this.path)) return [];
    const bytes = readFileSync(this.path);
    if (bytes.length === 0) return [];
    return parseNdjson(bytes);
  }

  // Rejection happens here, at the append boundary. A record outside the closed
  // set never becomes a record, so the Gate never sees it — and the Gate reporting
  // `pending` for an obligation nothing was validly submitted for is correct,
  // because nothing admissible exists.
  append(record) {
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
    const problems = validate(schema, { ...record, seq: this.seq });
    if (problems.length > 0) {
      fail('format_open', `record does not match its closed shape: ${record.kind}`, { problems });
    }
    // `encodeNdjson` canonicalizes on the way out, so the line on disk is the
    // canonical spelling and `parseNdjson` will refuse anything else later.
    const stamped = { ...record, seq: this.seq };
    appendFileSync(this.path, encodeNdjson([stamped]));
    this.seq += 1;
    return stamped;
  }

  // Replay is a check, not a re-enactment: the same records must reconstruct the
  // same state in a fresh process. A state reachable in the real flow that replay
  // cannot rebuild is the defect this exists to catch.
  // Bucketing is not reconstruction. `replay` sorts records so a caller can find
  // them; `reconstruct` rebuilds the state a run reached, which is what AC-13
  // actually asks for — including the Gate verdicts and the human decisions,
  // since those are what completion relied on.
  reconstruct(scope) {
    const matches = (r) => Object.entries(scope).every(([k, v]) => r[k] === v);
    const mine = this.read().filter(matches);
    const state = {
      approvedRevision: null,
      attempts: [],
      gateVerdicts: {},
      humanDecisions: {},
      signoff: null,
      completion: null,
      unavailable: null,
    };
    for (const r of mine) {
      switch (r.kind) {
        case 'contract_approved_genesis':
        case 'contract_approved_revision':
          state.approvedRevision = r.revision;
          break;
        case 'attempt_opened':
          state.attempts.push(r.attempt);
          break;
        case 'gate_result':
          state.gateVerdicts[r.obligation] = r.status;
          break;
        case 'human_decision':
          state.humanDecisions[r.operation] = r.choice || r.revision || true;
          break;
        case 'human_signoff':
          state.signoff = r.seq;
          break;
        case 'completion_committed':
          state.completion = r.acceptance;
          break;
        case 'capability_unavailable':
          state.unavailable = r.seq;
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
      unavailable: [],
      dispatches: [],
      deliveries: [],
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
      delivery: 'deliveries',
      human_decision: 'decisions',
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
    // named reader helper that takes the kind as an argument, or through a
    // reconstruction branch in the ledger itself. The helper form is spelled out
    // rather than matched loosely: `findBy('x', …)` is a real read of `x`, while
    // any mention of the string is not.
    const consumed = sources.some(({ name, text }) => (
      name !== 'ledger.mjs' && new RegExp(
        `===\\s*'${kind}'|'${kind}'\\s*===|findBy\\('${kind}'`,
      ).test(text)
    )) || new RegExp(`case '${kind}':`).test(
      sources.find((f) => f.name === 'ledger.mjs')?.text || '',
    );

    if (!produced) problems.push({ kind, code: 'kind_without_producer' });
    if (!consumed) problems.push({ kind, code: 'kind_without_consumer' });
  }
  return problems;
}
