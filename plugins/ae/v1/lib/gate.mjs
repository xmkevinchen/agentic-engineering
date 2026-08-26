// The Gate — AC-4.
//
// One reduction. Every path that produces a status produces it here: the ordinary
// arm and the unavailable arm differ in their inputs and in nothing else. That is
// X4a, and the unavailable arm is what makes it observable rather than vacuous —
// with one path, "every path goes through this one" says nothing.
//
// The reduction is pure. It takes records and returns a status, and touches no
// clock, no filesystem, no environment, no model. Two processes given the same
// records return the same answer, which is what makes replay a check rather than
// a re-enactment.

import { canonicalDigest } from './canonical-json.mjs';

export const STATUS = Object.freeze({
  PENDING: 'pending',
  PASSED: 'passed',
  FAILED: 'failed',
  INVALID: 'invalid',
  UNAVAILABLE: 'unavailable',
  STALE: 'stale',
});

// Highest first. When several conditions hold at once this order decides, and it
// decides *within the selected candidate* — never across attempts.
export const PRECEDENCE = Object.freeze([
  STATUS.INVALID,
  STATUS.STALE,
  STATUS.UNAVAILABLE,
  STATUS.FAILED,
  STATUS.PASSED,
]);

function rank(status) {
  const i = PRECEDENCE.indexOf(status);
  return i === -1 ? PRECEDENCE.length : i;
}

// ---------------------------------------------------------------------------
// Stage 1 — selection.
//
// Reads the routing envelope and nothing else: which lineage, which obligation,
// which attempt. It does not look at whether a record is valid, whether its
// package resolves, whether its revision is current, or whether its attempt was
// authorized. Every one of those is a reduction verdict.
//
// Two earlier drafts filtered here — once on revision, once on validity — and each
// time the record a status exists to report was discarded before the status could
// be reached: a superseded revision surfaced as `pending`, and so did tampered
// evidence. Selection judges nothing.

export function select({ records, lineage, obligation }) {
  const attempts = records.filter(
    (r) => r.kind === 'attempt_opened' && r.lineage === lineage,
  );
  if (attempts.length === 0) return { attempt: null, records: [] };

  // "Latest" is the last appended. The log's order is its own; no timestamp a
  // party supplied is consulted.
  const latest = attempts[attempts.length - 1];

  return {
    attempt: latest,
    records: records.filter(
      (r) => r.lineage === lineage
        && r.obligation === obligation
        && r.attempt === latest.attempt,
    ),
  };
}

// ---------------------------------------------------------------------------
// Stage 2 — reduction, within the selected candidate only.

function verdictOf(record, ctx) {
  // An unavailable record is a verdict in itself: the capability could not be
  // used, which is neither a failure of the work nor an absence of evidence.
  if (record.kind === 'capability_unavailable') {
    return { status: STATUS.UNAVAILABLE, code: null, record };
  }

  if (record.kind !== 'observation') {
    return { status: STATUS.INVALID, code: 'kind_without_consumer', record };
  }

  // Admissibility first, so nothing inadmissible is read for content.
  const refusal = ctx.admit(record, ctx);
  if (refusal) return { status: STATUS.INVALID, code: refusal, record };

  // Two kinds of staleness, and both are stale: bound to a superseded revision,
  // or the material inputs it recorded have since changed.
  if (record.contract_revision !== ctx.currentRevision) {
    return { status: STATUS.STALE, code: null, record };
  }
  if (ctx.inputsChanged(record, ctx)) {
    return { status: STATUS.STALE, code: null, record };
  }

  // Only now is the observation's own claim read. A supplied `status` field is
  // consulted nowhere: the reduction recomputes from facts.
  return {
    status: record.satisfied === true ? STATUS.PASSED : STATUS.FAILED,
    code: null,
    record,
  };
}

export function reduce({
  records,
  lineage,
  obligation,
  currentRevision,
  admit = () => null,
  inputsChanged = () => false,
}) {
  const ctx = { currentRevision, admit, inputsChanged };
  const { attempt, records: selected } = select({ records, lineage, obligation });

  // The attempt opened and submitted nothing for this obligation. An older
  // attempt's pass is not retained: a retry that produced nothing is an absence,
  // not a pass.
  if (selected.length === 0) {
    return {
      status: STATUS.PENDING,
      code: null,
      attempt: attempt ? attempt.attempt : null,
      selected: null,
    };
  }

  const verdicts = selected.map((r) => verdictOf(r, ctx));

  // Contradiction within one attempt fails closed. Recency does not resolve it:
  // a `failed` and a `passed` for one obligation in one attempt means the attempt
  // does not know what happened, and neither does the Gate.
  const outcomes = new Set(
    verdicts
      .filter((v) => v.status === STATUS.PASSED || v.status === STATUS.FAILED)
      .map((v) => v.status),
  );
  if (outcomes.size > 1) {
    return {
      status: STATUS.INVALID,
      code: 'contradictory_observations',
      attempt: attempt.attempt,
      selected: null,
    };
  }

  let worst = verdicts[0];
  for (const v of verdicts) if (rank(v.status) < rank(worst.status)) worst = v;

  return {
    status: worst.status,
    code: worst.code,
    attempt: attempt.attempt,
    selected: worst.record ? canonicalDigest(worst.record) : null,
  };
}

// A run is complete only when every obligation the Contract states is `passed`.
// Not a seventh status — AC-1's precondition, computed from the same reduction
// rather than beside it.
export function reduceAll({
  records, lineage, obligations, currentRevision, admit, inputsChanged,
}) {
  const byObligation = {};
  for (const obligation of obligations) {
    byObligation[obligation] = reduce({
      records, lineage, obligation, currentRevision, admit, inputsChanged,
    });
  }
  const allPassed = obligations.length > 0
    && obligations.every((o) => byObligation[o].status === STATUS.PASSED);
  return { byObligation, allPassed };
}
