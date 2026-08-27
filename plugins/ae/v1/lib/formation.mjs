// Formation trace — AC-6.
//
// Outbound: every material statement cites a specific source, and a statement
// derivable from none is listed as an agent proposal. Inbound: every obligation
// the verifiable sources place on Phase 1 is carried or visibly disposed, and a
// disposition names a landing that actually carries it.
//
// The landing check is the one that matters. Three consecutive drafts of this
// Contract claimed coverage in the disposition table for criteria that did not
// contain the obligation — always in the direction of claiming more. A table that
// checks itself is the only kind worth keeping.

import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

export function fileDigest(path) {
  return `sha256:${createHash('sha256').update(readFileSync(path)).digest('hex')}`;
}

// A cited source must exist and match the digest recorded for it. A citation to
// a source that has since changed is a citation to something else.
export function checkVerifiableSources(provenance, resolve) {
  const problems = [];
  for (const entry of provenance.verifiable) {
    let text;
    try {
      text = readFileSync(resolve(entry.source), 'utf8');
    } catch {
      problems.push({ id: entry.id, why: 'cited source does not resolve' });
      continue;
    }
    if (fileDigest(resolve(entry.source)) !== entry.sha256) {
      problems.push({ id: entry.id, why: 'cited digest does not match the file' });
      continue;
    }
    // The content, not only the file. A matching digest says the source has not
    // changed since it was cited; it says nothing about whether the source
    // contains what the citation rests on.
    if (!text.includes(entry.quote)) {
      problems.push({ id: entry.id, why: 'the cited source does not contain the quoted passage' });
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
      out.push({ id: row[1], text: line, cites: citesInDocument(line) });
      continue;
    }

    // Anything inside a criterion's body contributes citations to it.
    if (criterion) criterion.cites.push(...citesInDocument(line));
  }
  return out;
}

// The same question asked of a Contract *document*, which has no provenance object
// to look names up in — its provenance is a markdown table. `D`/`U`/`P`/`Q` is that
// document's own writing convention, so here the letters are the right instrument;
// they are the wrong one where a real provenance exists.
function citesInDocument(line) {
  const ids = [];
  for (const m of line.matchAll(/\b([DUPQ]-\d+)\b/g)) ids.push(m[1]);
  return ids;
}

// Which sources a statement rests on. The provenance decides what is citable; this
// only finds them.
//
// It matched `[DUPQ]-\d+` — a letter list written here — while the known set was
// built from the provenance. The two disagreed: an entry the provenance carried
// under any other letter was invisible, so its statement read as citing nothing.
// That refusal caught no defect and cost three rounds across the first two runs.
//
// Widening the letter list is not the fix: a statement mentioning `AC-9` or
// `BL-214` in prose would then be read as citing them. So the known ids are looked
// for by name, and a token is only reported as a *bad* citation when it uses a
// prefix this Contract's own provenance uses — `D-99` beside a provenance of
// `D-01…D-05` is a typo; `BL-214` in the same sentence is prose.
function citesIn(line, known) {
  const cites = [...known].filter((id) => new RegExp(`\\b${id}\\b`).test(line));
  const prefixes = new Set([...known].map((id) => id.split('-')[0]));
  const bad = [];
  for (const m of line.matchAll(/\b([A-Za-z]{1,4})-\d+\b/g)) {
    if (prefixes.has(m[1]) && !known.has(m[0])) bad.push(m[0]);
  }
  return { cites, bad };
}

// Outbound. A statement citing a broad entry that could support anything cites
// nothing: the check is that the cited id is specific, not merely present.
// The sources a statement may rest on. Unknowns are deliberately not among them:
// an open question is what a Contract has not settled, so resting a scope statement
// on one states nothing.
export function knownIds(provenance) {
  return new Set([
    ...provenance.verifiable.map((v) => v.id),
    ...provenance.transcribed.map((t) => t.id),
    ...provenance.proposals.map((p) => p.id),
  ]);
}

export function checkCitations(statements, provenance) {
  const known = knownIds(provenance);
  const broad = new Set(
    provenance.transcribed.filter((t) => t.broad === true).map((t) => t.id),
  );

  // Each problem carries its code. It carried a prose `why` that the caller
  // mapped to a code by matching the sentence, so rewording one silently changed
  // which refusal it produced.
  const problems = [];
  for (const s of statements) {
    // A mistyped citation before an absent one. Both leave the statement resting on
    // nothing, but "cites D-99, which is not a source" says where to look and
    // "cites nothing" does not — and a statement whose only citation is a typo used
    // to report the second.
    for (const id of s.bad || []) {
      problems.push({
        statement: s.id, code: 'citation_unknown', why: `cites unknown source ${id}`,
      });
    }
    if (!s.cites || s.cites.length === 0) {
      if (!(s.bad || []).length) {
        problems.push({ statement: s.id, code: 'statement_uncited', why: 'cites nothing' });
      }
      continue;
    }
    if (s.cites.every((id) => broad.has(id))) {
      problems.push({
        statement: s.id, code: 'citation_broad_only', why: 'cites only a broad entry',
      });
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

  const known = knownIds(provenance);
  const read = (text, id) => ({ id, ...citesIn(text, known) });
  const statements = [
    ...contract.scope.map((text, i) => read(text, `scope[${i}]`)),
    ...contract.non_goals.map((text, i) => read(text, `non_goals[${i}]`)),
    ...contract.required_evidence.map((text, i) => read(text, `required_evidence[${i}]`)),
  ];

  // One citation rule, called from both places that need it: here, over the
  // statements the Contract makes in its own fields, and over the statements read
  // out of a Contract document. Restating it made the enforced copy and the
  // checked-in-a-test copy free to drift.
  const problems = checkCitations(statements, provenance)
    .map(({ code, statement }) => ({ code, statement }));
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
