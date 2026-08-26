// Formation trace — AC-6.
//
// Outbound: every material statement cites a specific source, and a statement
// derivable from none is listed as an agent proposal. Inbound: every obligation
// the verifiable sources place on V1 is carried or visibly disposed, and a
// disposition names a landing that actually carries it.
//
// The landing check is the one that matters. Three consecutive drafts of this
// Contract claimed coverage in the disposition table for criteria that did not
// contain the obligation — always in the direction of claiming more. A table that
// checks itself is the only kind worth keeping.

import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fail } from './codes.mjs';

export function fileDigest(path) {
  return `sha256:${createHash('sha256').update(readFileSync(path)).digest('hex')}`;
}

// A cited source must exist and match the digest recorded for it. A citation to
// a source that has since changed is a citation to something else.
export function checkVerifiableSources(provenance, resolve) {
  const problems = [];
  for (const entry of provenance.verifiable) {
    let actual;
    try {
      actual = fileDigest(resolve(entry.source));
    } catch {
      problems.push({ id: entry.id, why: 'cited source does not resolve' });
      continue;
    }
    if (actual !== entry.sha256) {
      problems.push({ id: entry.id, why: 'cited digest does not match the file' });
    }
  }
  return problems;
}

// Read the statements out of the approved Contract rather than taking a caller's
// account of them. An earlier draft accepted both the statement list and the
// oracle that judged it, so a caller could describe a document that satisfied
// every rule and never mention the one that did not.
export function statementsFrom(contractBytes) {
  const text = Buffer.isBuffer(contractBytes) ? contractBytes.toString() : String(contractBytes);
  const lines = text.split('\n');
  const out = [];

  // Section-aware. `N1` means a non-goal under §3 and a knowledge clause under
  // AC-10, and reading them as one kind produced six phantom uncited statements
  // on the first run — the knowledge rows, which are cited once by the criterion
  // that contains them rather than individually.
  let section = null;
  let criterion = null;

  for (const line of lines) {
    const h2 = line.match(/^## (\d+)\. /);
    if (h2) { section = h2[1]; criterion = null; }

    const h3 = line.match(/^### (AC-\d+) — (.+)$/);
    if (h3) {
      criterion = { id: h3[1], text: h3[2], cites: [] };
      out.push(criterion);
      continue;
    }

    // Scope and non-goal rows are statements in their own right; they sit in
    // sections 2 and 3 and carry their own citation column.
    const row = line.match(/^\| (S\d+|N\d+) \|/);
    if (row && (section === '2' || section === '3')) {
      out.push({ id: row[1], text: line, cites: citesIn(line) });
      continue;
    }

    // Anything inside a criterion's body contributes citations to it.
    if (criterion) criterion.cites.push(...citesIn(line));
  }
  return out;
}

function citesIn(line) {
  const ids = [];
  for (const m of line.matchAll(/\b([DUPQ]-\d+)\b/g)) ids.push(m[1]);
  return ids;
}

// Outbound. A statement citing a broad entry that could support anything cites
// nothing: the check is that the cited id is specific, not merely present.
export function checkCitations(statements, provenance) {
  const known = new Set([
    ...provenance.verifiable.map((v) => v.id),
    ...provenance.transcribed.map((t) => t.id),
    ...provenance.proposals.map((p) => p.id),
  ]);
  const broad = new Set(
    provenance.transcribed.filter((t) => t.broad === true).map((t) => t.id),
  );

  const problems = [];
  for (const s of statements) {
    if (!s.cites || s.cites.length === 0) {
      problems.push({ statement: s.id, why: 'cites nothing' });
      continue;
    }
    for (const id of s.cites) {
      if (!known.has(id)) problems.push({ statement: s.id, why: `cites unknown source ${id}` });
    }
    if (s.cites.every((id) => broad.has(id))) {
      problems.push({ statement: s.id, why: 'cites only a broad entry' });
    }
  }
  return problems;
}

// AC-6 over the approved bytes, as one call, so approval can make it compulsory.
//
// Everything is derived from the Contract itself. The two halves used to take
// oracles — a statement list, and a `carriedBy` function that answered whether a
// criterion carried an obligation — so a caller could describe a document that
// satisfied every rule and never mention the one that did not.
//
// A material statement is one the Contract makes in prose: its scope, its
// non-goals, and the evidence it requires. Obligations are identifiers and carry
// no claim of their own; the observation named for each is where the claim is.
export function formationProblems(contract) {
  const { provenance } = contract;

  const statements = [
    ...contract.scope.map((text, i) => ({ id: `scope[${i}]`, cites: citesIn(text) })),
    ...contract.non_goals.map((text, i) => ({ id: `non_goals[${i}]`, cites: citesIn(text) })),
    ...contract.required_evidence.map((text, i) => ({
      id: `required_evidence[${i}]`, cites: citesIn(text),
    })),
  ];

  // One citation rule, called from both places that need it: here, over the
  // statements the Contract makes in its own fields, and over the statements read
  // out of a Contract document. Restating it made the enforced copy and the
  // checked-in-a-test copy free to drift.
  const problems = checkCitations(statements, provenance).map((p) => ({
    code: {
      'cites nothing': 'statement_uncited',
      'cites only a broad entry': 'citation_broad_only',
    }[p.why] || 'citation_unknown',
    statement: p.statement,
  }));
  const cited = new Set(statements.flatMap((s) => s.cites));

  // Inbound coverage, and the landing. A transcribed entry says what became of an
  // obligation a source placed on this work; `carried` means the Contract took it
  // on, and the Contract taking it on is visible as some statement citing it.
  for (const t of provenance.transcribed) {
    if (!t.disposition) {
      problems.push({ code: 'obligation_undisposed', source: t.id });
      continue;
    }
    if (t.disposition === 'carried' && !cited.has(t.id)) {
      problems.push({ code: 'disposition_lands_nowhere', source: t.id });
    }
  }
  return problems;
}
